# BelAgent Technical Proof of Concept: Reviewer Notes

**Prepared:** 3 November 2026  
**Scope:** Non-custodial Beldex BDX testnet wallet approval via a local MCP server, not autonomous payments.

## User story

An AI tool requests a 0.25 BDX testnet payment for a documented service. BelAgent makes a request, runs deterministic policy, and provides a time-bound local approval URL. The human verifies recipient, amount and purpose. In live testnet mode, the browser asks the Beldex Extension Wallet to connect and to send; the wallet performs its own user approval and signing. A status tool reports results without claiming settlement before independent verification.

## Trust boundaries

**1. AI to MCP:** AI text is untrusted. Only strict tool arguments are processed. The server cannot execute a payment or alter a user's wallet. Requiring a local allowlist in testnet mode limits destination substitution, though allowlists are not a substitute for wallet approval.

**2. MCP to browser:** The local review page is served from `127.0.0.1`. Requests have 192-bit random identifier plus separate 192-bit bearer capability; 10-minute expiration, single-use transitions, host and origin checks, CSP, no third-party remote assets. Approval URL possession is necessary but not sufficient for a cryptographic transfer.

**3. Browser to wallet:** `window.beldex` provider, connection permission, network check (`testnet`), transaction request. The wallet maintains keys and fee estimation. User must approve within the extension. No private keys, seeds or signing capabilities ever pass through the MCP process.

**4. Browser to status:** The browser may supply a tx hash, but this is a report from an untrusted client. The POC labels this `submitted_unverified` and does not create a cryptographic receipt or settlement proof. A production integration must reconcile against authoritative wallet operation status and testnet transaction evidence.

## State machine

`pending -> declined | expired | wallet_prompt`

`wallet_prompt -> demo_approved | submitted_unverified | declined | outcome_unknown`

On timeout during `wallet_prompt`, transition to `outcome_unknown` and block automatic retry. Success is never inferred from the existence of a hash. No transition from a terminal state back to `pending` is available.

## Testnet SDK integration plan

The public official SDK documents `BeldexWeb3.connect()`, `getNetwork()`, `sendTransaction()`, and `sendTransactionSafe()` with `idempotencyKey`, plus `getOperationStatus()`. This POC's no-dependency browser adapter targets the injected `window.beldex` RPC provider directly and is deliberately described as **not live-tested**. The next iteration should use official SDK for safer handling of unknown outcomes, and verify browser/extension compatibility on a funded disposable testnet wallet.

Transaction amounts are **string decimals** at the MCP boundary, converted exactly to BDX atomic units (`1 BDX = 10^9` units), then sent to the provider as atomic-unit strings. The wallet must validate the destination checksum, network and spendable balance before signing.

## Security control matrix

| Attack | POC mitigation | Remaining risk |
| --- | --- | --- |
| Prompt injection instructs agent to send money | No MCP send tool, caps, allowlist in live mode, human + wallet approval | Human may be misled; compare destination independently |
| AI changes recipient after review | Immutable server-side intent, intent hash, one-time transition | Malicious extension/browser itself is outside the POC trust model |
| Wrong chain | testnet-only destination prescreen + wallet network check | Wallet API/browser compatibility must be verified |
| Duplicate payment from retries | single-use state and no retry after ambiguous send | Memory is volatile and status source untrusted; persistent idempotency needed |
| CSRF / off-host access | strict loopback host, same-origin writes, no CORS, no third-party assets | Hostile local code or stolen capability URL remains a risk |
| Fake successful payment | `submitted_unverified` state (never `confirmed`) | Independent settlement proof not yet available |
| Overspending | local per-payment and reserved daily caps | Caps apply only to current process, not global wallet balance |
| Address redirection | live-mode allowlist and full-address review | Shape check does not validate checksum; wallet must reject malformed address |

## Acceptance criteria for this POC

1. `npm test` passes all supplied deterministic unit/integration tests.
2. `npm run demo` initializes a real MCP session; lists tools; creates a payment; simulates user approval; queries resulting status.
3. Browser review page contains full amount, recipient, chain, reason, intent hash and separately explicit approval action.
4. Fraudulent cross-origin requests fail and second approval attempt fails.
5. No seed, spend key, remote execution, mainnet endpoint, blockchain broadcast from Node MCP server or autonomous signing.
6. Testnet integration is identified as **unverified pending a real wallet**, not represented as a live transaction.

## Eight-week development proposal (draft; dependent on team costing)

- **Weeks 1–2 ($2,800):** refine MCP tools, threat model, testnet wallet compatibility. Acceptance: repeatable tool calls and verified adapter against current extension.
- **Weeks 3–4 ($4,600):** funded testnet transfer, explicit wallet approval, rejection and ambiguous result handling. Acceptance: redacted wallet demo and hashes independently checked.
- **Weeks 5–6 ($4,400):** persistent journal, resumption/idempotency, server-side verification policy, security review. Acceptance: negative test matrix incl. prompt injection and replay.
- **Weeks 7–8 ($2,600):** packaging, docs, MIT release, independent contributor integration demo and acceptance walkthrough. Acceptance: repeatable installs, supported 90-day bug-fix process.

**Total proposed: $14,400 USD**. Budget is indicative, not an offer or proven cost until team commitments, hourly effort, and grant milestones are confirmed.

## Original application items not yet verified

- Four actual team members and work links: **missing**.
- Earlier Zcash MCP repository: **missing/unverified**.
- Community developers and letters of interest: **missing/unverified**.
- Original BelAgent application: **not recovered**.

These must be resolved in the reply, rather than silently invented.
