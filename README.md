# BelAgent: Beldex MCP payment-approval proof of concept

**Status (3 November 2026): Runnable local architecture POC; simulated approval tested; real Beldex wallet testnet send integration implemented against the published browser provider protocol but NOT yet verified against a funded wallet.**

BelAgent demonstrates **AI requests payment -> deterministic local policy checks -> human opens local review page -> Beldex browser wallet prompts and signs (testnet mode) -> agent can query outcome**.

It is **not** an autonomous spending wallet, deployed production payment processor, or evidence of a confirmed Beldex transaction. No mainnet path and no storage/access to private keys exist in this project.

## Quick start (zero dependencies)

Requires Node.js 20+.

```bash
npm test
npm run demo
npm start
```

`npm run demo` creates a request through the actual MCP stdio protocol, simulates the two-stage approval over HTTP, and reads the status through MCP. The demo's placeholder recipient has no valid checksum and MUST NOT be used in a real testnet send.

To inspect the UI manually while `npm start` is running, configure your MCP client with the server below and call `belagent_request_payment` with a legitimate **Beldex testnet** recipient address, e.g. with `amount_bdx: "0.25"` and `reason: "POC service fee"`. Open the `approval_url` returned by the tool.

```json
{
  "mcpServers": {
    "belagent": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/belagent-poc/src/server.mjs"],
      "env": {"BELAGENT_MODE":"demo", "BELAGENT_PORT":"7417"}
    }
  }
}
```

For manual demo mode only, an address that passes the shape pre-screen can be generated for **simulation only** with `"9" + "A".repeat(94)` in JavaScript. It is NOT a valid destination for an actual wallet.

## Connecting a real Beldex Extension Wallet on testnet

1. Install the Beldex browser extension from the official Beldex site. Use a **dedicated, disposable testnet wallet**, with the extension set to **Testnet**.
2. Obtain **testnet BDX** from the official faucet. Do not use mainnet BDX or a production recovery phrase.
3. Obtain a genuine checksummed testnet recipient address from a separate testnet wallet. **Copy the exact address**.
4. Start in locked-down testnet mode with the recipient allowlisted:

```bash
BELAGENT_MODE=testnet BELAGENT_ALLOWLIST='PASTE_GENUINE_TESTNET_RECIPIENT' BELAGENT_MAX_PAYMENT_BDX=1 BELAGENT_MAX_DAILY_BDX=2 npm start
```

5. Configure the MCP client and request `0.1` BDX to the allowlisted address. Open the returned local `approval_url` **in the same browser profile as the Beldex extension**.
6. Press **Continue to Beldex wallet**, approve the connection, inspect the amount, full recipient, chain, and fee within the extension, and only approve if all data are correct.
7. Observe the returned state. **`submitted_unverified` means the browser reported a transaction hash, NOT independent on-chain payment confirmation.** Check the Beldex testnet wallet/explorer independently before asserting settlement. If it returns `outcome_unknown`, NEVER blindly retry.

### Architecture and deliberate limits

```text
  Untrusted AI / MCP client
            |
            v
  MCP stdio server (NO spend/view keys)
  - validates BDX decimal amounts as BigInt atomic units
  - testnet-only address pre-screen, allowlist (live mode)
  - per-request cap and reserved daily cap
  - immutable request id, reason, destination, amount, SHA-256 intent hash
  - single-use, 10-minute local approval capability URL
            |
  127.0.0.1 browser approval page (local only)
  - visible amount, destination, purpose, hash
  - explicit human click; one-time transition to wallet_prompt
            |
  Injected Beldex wallet provider (live testnet mode)
  - request connect -> verify testnet -> request user-approved send
  - cryptographic keys stay inside wallet extension
            |
  Browser reports tx hash to local status store (UNVERIFIED)
            |
  MCP client polls belagent_payment_status
```

**SDK integration note:** The browser adapter currently uses the published `window.beldex.request()` wire protocol (`bdx_connect`, `bdx_getNetwork`, `bdx_sendTransaction`) to avoid external runtime dependencies. The official `@bdxi/web3js` SDK documents the same extension provider and `sendTransactionSafe` / idempotency flows. Porting the adapter to the official SDK, independent reconciliation, and funded-wallet e2e testing are required before any real use.

## What is actually demonstrated?

| Claim | Status |
| --- | --- |
| A standards-shaped MCP stdio server with real `initialize`, `tools/list`, and `tools/call` | **Implemented & tested** |
| Browser-based explicit approval and rejection, local HTTP API | **Implemented & tested** |
| Exact-value decimal amount conversion and BDX testnet shape pre-screen | **Implemented & tested** |
| Policy limits, per-request capability, short expiration, single-use state transitions | **Implemented & tested** |
| Simulation-only full workflow including status query | **Implemented & tested; no BDX sent** |
| Testnet Beldex injected-provider integration path | **Implemented from docs; requires actual extension verification** |
| Successful real Beldex testnet transfer | **NOT demonstrated** |
| On-chain settlement proof / independent verification | **NOT implemented** |
| External security audit, production key recovery, audit trail, persistent anti-replay | **NOT implemented** |

## Why this matters for the grant

This design does not promise autonomous AI signing. The wallet always retains transaction authority, and the MCP server has no private keys. It focuses on the missing compatibility layer between AI MCP clients and Beldex's user-controlled privacy payment stack, with reproducible tests that reviewers can run quickly.

**Please do not claim we built Zcash MCP or have four committed team members unless independently evidenced.** Prior work, team experience, and community interest must be supported by links/names/consent before submitting.

## Security notes / non-goals

- `127.0.0.1` binding, literal host checking, same-origin POST protection, no CORS, Content Security Policy, no browser third-party scripts, no telemetry.
- The **capability URL is a bearer secret**. Do not paste it into public chat or publish screenshots with it. It expires automatically; there is no authentication beyond its unguessable token in this POC.
- A localhost client with the approval URL might submit a fake success callback. Browser-reported hashes are therefore **never called confirmed**.
- In-memory state does not survive restart. An interrupted send may have happened; restarting is never evidence that it did not.
- Prompt injection can induce an AI to propose a bad payment within the agent's permissions. Deterministic policy and final wallet user review reduce this risk; they do not make a model immune to manipulation.
- The testnet address check is **only a shape check**, not checksum verification. The actual extension enforces final address validation before signing.
- The local policy counters do not capture other payments made directly in the wallet or on other BelAgent devices. They are **per-instance limits**, not global financial controls.
- User approval in the browser alone is not equivalent to a real cryptographically signed transfer; in testnet mode the extension is the final authority.

References: [Beldex Web3 SDK official overview](https://beldex.io/blog/building-privacy-first-apps-on-beldex-with-the-web3js-sdk), [Beldex-Coin official SDK repository](https://github.com/Beldex-Coin/bdx-web3js), [Beldex grant rules](https://beldex.io/grants).
