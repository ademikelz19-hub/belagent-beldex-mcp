# BelAgent Technical Proof of Concept: Reviewer Notes (v0.2.0)

**Prepared:** 3 November 2026  
**Scope:** Non-custodial Beldex BDX testnet wallet approval via a local MCP server, not autonomous payments.

## User story

An AI tool requests a 0.25 BDX testnet payment for a documented service. BelAgent creates an immutable request, checks deterministic spending policy, and generates a time-bound local approval URL. The human verifies recipient, amount and purpose in a local web interface. If the AI agent aborts the workflow, it can explicitly cancel the pending request to release the reserved daily spending limit. In live testnet mode, the browser asks the Beldex Extension Wallet to connect and to send; the wallet performs its own user approval and signing. A status tool reports results without claiming settlement before independent verification.

## Trust boundaries

**1. AI to MCP:** AI text is untrusted. Only strict tool arguments are processed. The server cannot execute a payment or alter a user's wallet. Requiring a local allowlist in testnet mode limits destination substitution, though allowlists are not a substitute for wallet approval. Agents can also cancel requests or list pending requests.

**2. MCP to browser:** The local review page is served from `127.0.0.1`. Requests have 192-bit random identifier plus separate 192-bit bearer capability; 10-minute expiration, single-use transitions, host and origin checks, CSP, no third-party remote assets. Approval URL possession is necessary but not sufficient for a cryptographic transfer.

**3. Browser to wallet:** `window.beldex` provider, connection permission, network check (`testnet`), transaction request. The wallet maintains keys and fee estimation. User must approve within the extension. No private keys, seeds or signing capabilities ever pass through the MCP process.

**4. Browser to status:** The browser may supply a tx hash, but this is a report from an untrusted client. The POC labels this `submitted_unverified` and does not create a cryptographic receipt or settlement proof. A production integration must reconcile against authoritative wallet operation status and testnet transaction evidence.

## State machine

```
pending -> declined | expired | wallet_prompt | cancelled

wallet_prompt -> demo_approved | submitted_unverified | declined | outcome_unknown
```

- When in `pending`, a user can `decline`, the TTL can transition to `expired`, the agent can invoke `cancel`, or the user can click `start` to enter `wallet_prompt`.
- When in `cancelled` or `declined`, reserved daily spending budget is released.
- On timeout during `wallet_prompt`, transition to `outcome_unknown` and block automatic retry. Success is never inferred from the existence of a hash. No transition from a terminal state back to `pending` is available.
- Terminal records older than the retention window (default 24h) are pruned automatically by a background sweep.

## Security control matrix

| Attack | POC mitigation | Remaining risk |
| --- | --- | --- |
| Prompt injection instructs agent to send money | No MCP send tool, caps, allowlist in live mode, human + wallet approval | Human may be misled; compare destination independently |
| AI changes recipient after review | Immutable server-side intent, intent hash, one-time transition | Malicious extension/browser itself is outside the POC trust model |
| Agent context lost during conversation | `belagent_list_requests` allows checking existing pending items | Token limit in context window |
| Overspending via server restart | Optional `BELAGENT_STORE_PATH` atomic persistence retains daily aggregates | Server file permissions must be secure |
| Memory leak in standing MCP daemon | Periodic pruning of stale terminal states past retention window | Unusually high churn within a single day |
| Wrong chain | testnet-only destination prescreen + wallet network check | Wallet API/browser compatibility must be verified |
| Duplicate payment from retries | single-use state and no retry after ambiguous send | Memory is volatile unless persistent store configured |
| CSRF / off-host access | strict loopback host, same-origin writes, no CORS, no third-party assets | Hostile local code or stolen capability URL remains a risk |
| Fake successful payment | `submitted_unverified` state (never `confirmed`) | Independent settlement proof not yet available |
| Overspending | local per-payment and reserved daily caps | Caps apply only to current process, not global wallet balance |
| Address redirection | live-mode allowlist and full-address review | Shape check does not validate checksum; wallet must reject malformed address |

## Acceptance criteria for this POC

1. `npm test` passes all deterministic unit and integration tests (20 tests covering core, MCP, HTTP, wallet bridge, persistence, cancellation, and pruning).
2. `npm run demo` initializes a real MCP session; lists tools; creates a payment; queries pending list; simulates user approval; queries resulting status.
3. Browser review page contains full amount, recipient, chain, reason, intent hash, copy buttons, live polling, and explicit approval actions.
4. Fraudulent cross-origin requests fail and second approval attempt fails.
5. No seed, spend key, remote execution, mainnet endpoint, blockchain broadcast from Node MCP server or autonomous signing.
6. Testnet integration is identified as **unverified pending a real wallet**, not represented as a live transaction.
