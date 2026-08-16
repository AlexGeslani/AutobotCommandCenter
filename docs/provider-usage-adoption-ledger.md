# ACC provider-usage MVP — adoption ledger

Date: 2026-07-27
Scope: development-only, read-only provider subscription-window projection.

## Decision

No community package, skill, generated client, or runtime dependency is installed or vendored. All collector and projection code in this repository is authored for ACC's fail-closed contract.

The community scan is retained at:

- `.hermes/plans/2026-07-27_024308-provider-usage-community-scan.md`
- `.hermes/plans/2026-07-27_070400-provider-usage-autobots-adjudication.md`

## Reference patterns — not copied

| Reference class | What informed the design | What ACC did instead | Runtime/dependency status | Removal path |
|---|---|---|---|---|
| CodexBar / T3 Code community work | Short-lived Codex app-server lifecycle, quota-window normalization, bounded process cleanup | Minimal native JSON-RPC client with a four-method allowlist and public projection | No package or source imported | Remove `collector/adapters/codex-app-server.mjs` and its registry entry |
| Claude Code usage monitor patterns | Versioned snapshots, freshness semantics, status-line parsing | Native stdin sink that persists only `rate_limits` windows | No package or source imported | Remove sink, `statusLine` setting, and private cache |
| `ai-usagebar` atomic-cache pattern | Temporary-file then rename publication | Native `writeAtomicJson()` implementation | No package or source imported | Remove collector writer and public snapshot |
| Codeburn degradation patterns | Per-provider isolation and explicit non-healthy state | Native collector fallback records | No package or source imported | Remove collector and provider view |

## Authority and refresh policy

- Codex uses only the installed signed-in `codex app-server --stdio` read path.
- Claude uses only documented `statusLine.rate_limits` observations; no observation is `not_configured`/`not_yet_observed`, never zero.
- Antigravity remains `unsupported` for automated consumer quota.
- Public snapshots contain no API keys, cookies, account identity, prompts, session IDs, project IDs, local paths, raw responses, balances, or billing data.
- The scheduled snapshot is mutable operational state and is intentionally excluded from version control.

## Reversal

1. Boot out `com.example.acc-provider-usage` from the current user launchd domain.
2. Remove `~/Library/LaunchAgents/com.example.acc-provider-usage.plist`.
3. Restore the timestamped `~/.claude/settings.json.acc-provider-usage-backup-*` file or remove only `statusLine`.
4. Remove `~/.acc-provider-usage/` and both public snapshot copies.
5. Remove the provider-usage source/UI only through a reviewed application change.
