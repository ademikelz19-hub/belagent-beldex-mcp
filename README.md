# BelAgent: Beldex MCP payment-approval proof of concept (v0.2.0)

**Status (3 November 2026): Runnable local architecture POC; simulated approval tested; real Beldex wallet testnet send integration implemented against the published browser provider protocol; file persistence, cancellation, request listing, and active UI polling supported.**

BelAgent demonstrates **AI requests payment -> deterministic local policy checks -> human opens local review page -> Beldex browser wallet prompts and signs (testnet mode) -> agent can query or cancel outcome**.

It is **not** an autonomous spending wallet, deployed production payment processor, or evidence of a confirmed Beldex transaction. No mainnet path and no storage/access to private keys exist in this project.

## Quick start (zero dependencies)

Requires Node.js 20+.

```bash
npm test
npm run demo
npm start
```

- `npm test`: Runs deterministic test suite (20 unit and integration tests).
- `npm run demo`: Creates a request through the actual MCP stdio protocol, lists pending requests, simulates approval, and reads final status.
- `npm start`: Starts the local approval web server and MCP stdio listener on port 7417 (or `BELAGENT_PORT`).

To inspect the UI manually while `npm start` is running, configure your MCP client with the server below and call `belagent_request_payment` with a legitimate **Beldex testnet** recipient address (e.g. `amount_bdx: "0.25"` and `reason: "POC service fee"`). Open the `approval_url` returned by the tool.

```json
{
  "mcpServers": {
    "belagent": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/belagent-beldex-mcp/src/server.mjs"],
      "env": {
        "BELAGENT_MODE": "demo",
        "BELAGENT_PORT": "7417",
        "BELAGENT_STORE_PATH": "./.belagent-data.json"
      }
    }
  }
}
```

For manual demo mode only, an address that passes the shape pre-screen can be generated for **simulation only** with `"9" + "A".repeat(94)` in JavaScript. It is NOT a valid destination for an actual wallet.

## Connecting a real Beldex Extension Wallet on testnet

1. Install the Beldex browser extension from the official Beldex site. Use a **dedicated, disposable testnet wallet**, with the extension set to **Testnet**.
2. Obtain **testnet BDX** from the official faucet. Do not use mainnet BDX or a production recovery phrase.
3. Obtain a genuine checksummed testnet recipient address from a separate testnet wallet. **Copy the exact address**.
4. Start in locked-down testnet mode with the recipient allowlisted and persistent storage enabled:

```bash
BELAGENT_MODE=testnet BELAGENT_ALLOWLIST='PASTE_GENUINE_TESTNET_RECIPIENT' BELAGENT_MAX_PAYMENT_BDX=1 BELAGENT_MAX_DAILY_BDX=2 BELAGENT_STORE_PATH=./.belagent-data.json npm start
```

5. Configure the MCP client and request `0.1` BDX to the allowlisted address. Open the returned local `approval_url` **in the same browser profile as the Beldex extension**.
6. Press **Continue to Beldex wallet**, approve the connection, inspect the amount, full recipient, chain, and fee within the extension, and only approve if all data are correct.
7. Observe the returned state. **`submitted_unverified` means the browser reported a transaction hash, NOT independent on-chain payment confirmation.** Check the Beldex testnet wallet/explorer independently before asserting settlement. If it returns `outcome_unknown`, NEVER blindly retry.

## MCP Tools Provided

BelAgent exposes 5 tools over MCP standard I/O:

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `belagent_capabilities` | none | Query mode, chain, caps, and persistence state. |
| `belagent_request_payment` | `to`, `amount_bdx`, `reason`, `requester?` | Create an immutable payment intent and return a local time-bound `approval_url`. |
| `belagent_payment_status` | `request_id` | Check the current lifecycle status of a specific payment request. |
| `belagent_cancel_payment` | `request_id`, `reason?` | Cancel an open `pending` request, releasing reserved daily budget. |
| `belagent_list_requests` | `status?`, `limit?` | List recent payment requests (filters: `pending`, `all`, `cancelled`, etc.). |

## Architecture and Deliberate Limits

```text
  Untrusted AI / MCP client
            |
            v
  MCP stdio server (NO spend/view keys)
  - validates BDX decimal amounts as BigInt atomic units
  - testnet-only address pre-screen, allowlist (live mode)
  - per-request cap and reserved daily cap (survives restart via BELAGENT_STORE_PATH)
  - immutable request id, reason, destination, amount, SHA-256 intent hash
  - single-use, 10-minute local approval capability URL
  - cancellation and listing tools for autonomous context management
            |
  127.0.0.1 browser approval page (local only)
  - visible amount, destination, purpose, intent hash, one-click copy buttons
  - live status polling & missing extension detector
  - explicit human click; one-time transition to wallet_prompt
  - direct link to Beldex Testnet Explorer when tx hash reported
            |
  Injected Beldex wallet provider (live testnet mode)
  - request connect -> verify testnet -> request user-approved send
  - cryptographic keys stay inside wallet extension
            |
  Browser reports tx hash to local status store (UNVERIFIED)
            |
  MCP client polls belagent_payment_status or lists active items
```

## Security notes / non-goals

- `127.0.0.1` binding, literal host checking, same-origin POST protection, no CORS, Content Security Policy, no browser third-party scripts, no telemetry.
- The **capability URL is a bearer secret**. Do not paste it into public chat or publish screenshots with it. It expires automatically; there is no authentication beyond its unguessable token in this POC.
- A localhost client with the approval URL might submit a fake success callback. Browser-reported hashes are therefore **never called confirmed**.
- Setting `BELAGENT_STORE_PATH` enables atomic JSON disk persistence, preventing daily cap bypass across server restarts.
- Automatic memory pruning sweeps terminal records older than 24 hours to prevent memory leaks in daemon environments.
- Prompt injection can induce an AI to propose a bad payment within the agent's permissions. Deterministic policy, cancellation capability, and final wallet user review reduce this risk; they do not make a model immune to manipulation.
- The testnet address check is **a shape check**, not checksum verification. The actual extension enforces final address validation before signing.
- User approval in the browser alone is not equivalent to a real cryptographically signed transfer; in testnet mode the extension is the final authority.

References: [Beldex Web3 SDK official overview](https://beldex.io/blog/building-privacy-first-apps-on-beldex-with-the-web3js-sdk), [Beldex-Coin official SDK repository](https://github.com/Beldex-Coin/bdx-web3js), [Beldex grant rules](https://beldex.io/grants).
