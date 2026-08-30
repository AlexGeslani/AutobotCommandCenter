# Autobot Command Center

<p align="center">
  <strong>A read-only evidence dashboard for portfolio work, privacy-safe web analytics, and exact-condition model evaluation.</strong><br>
  <sub>One validated projection model. Two delivery surfaces. No second source of truth.</sub>
</p>

<p align="center">
  <img src="docs/demo/autobot-command-center-demo-preview.gif" width="800" alt="Matrix-themed Autobot Command Center walkthrough of alexgeslani.com analytics, Portfolio, and measured Benchmarks">
</p>

https://github.com/user-attachments/assets/b8c132d9-6462-4b7c-a922-8d2dfe1f1aa9

<p align="center">
  <sub>Narrated Matrix walkthrough — plays inline through GitHub's authenticated video player.</sub>
</p>

> **Dated showcase snapshot — 2026-08-29.** The screenshots and walkthrough use authorized, sanitized projections of current Portfolio and Benchmark evidence plus real aggregate `alexgeslani.com` analytics through 2026-08-28. They contain no credentials, account identity, prompts, billing data, raw provider payloads, raw request logs, private hostnames, or filesystem paths. Mutable runtime JSON remains untracked.

## Why I built it

Operational evidence tends to fragment: product outcomes live in project documentation, benchmark scores live in frozen artifacts, and analytics live behind a separate reporting boundary. That makes a basic question—**“What do we know, how recently do we know it, and what is still uncertain?”**—more expensive than it should be.

Autobot Command Center turns those artifacts into a compact executive and engineering view without replacing their authoritative sources. It is intentionally read-only. Every projected state preserves provenance, observation time, validation, and explicit stale or missing behavior.

## Resume case study

This repository demonstrates my ability to:

- design a **portable React dashboard core** that ships as both a Hermes plugin and a standalone static application;
- turn heterogeneous evidence into **closed, versioned JSON contracts** instead of coupling the UI to one private setup;
- retain real web analytics as **privacy-safe aggregates**, with coverage gaps and freshness visible rather than converted into reassuring zeros;
- present model results as **exact tested conditions** with frozen releases, denominators, and pending-score withholding;
- build a **fail-closed publication path** that validates complete candidates and preserves last-good state;
- keep mutable telemetry, credentials, deployment bindings, and raw source responses outside Git.

## Architecture

![Matrix-themed Autobot Command Center architecture showing authorized sources, strict projection validation, fail-closed state, one read-only React core, two delivery surfaces, and tracked-versus-runtime separation](docs/diagrams/acc-architecture.svg)

ACC is split into three narrow layers:

1. **Core** owns rendering, routing, calculations, sorting, responsive behavior, and trust semantics.
2. **Edition** is immutable JSON selecting known modules, labels, branding, stable IDs, and approved relative projection locations. It cannot define executable code, trust policy, arbitrary paths, or UI behavior.
3. **Projection** is versioned JSON carrying sanitized facts with explicit authority and generation time.

Runtime writers validate an entire candidate before atomic publication. Invalid replacements are isolated, the last-good value remains available, and the dashboard reports stale, invalid, missing, or withheld states instead of silently appearing fresh or complete.

## Product evidence

### Real alexgeslani.com analytics

![Matrix analytics view showing the dated alexgeslani.com aggregate snapshot, source coverage, requests, visits, transfer, cache share, and daily traffic](docs/screenshots/analytics.png)

The authorized 30-day projection records **36,148 edge requests**, **22,630 Cloudflare Visits**, and **114.1 MB** transferred across **20 observed calendar days**, with data through **2026-08-28**. The capture leaves source freshness and archive coverage visible so a reader can distinguish an observed value from a current claim.

![Matrix analytics continuation showing the daily traffic line and country-level request aggregates](docs/screenshots/analytics-details.png)

Analytics retains aggregate daily traffic and country totals, not raw request logs, people, sessions, or inferred US states. Gaps are never plotted as zero.

### Full Portfolio

![Matrix Portfolio view showing three allowlisted public GitHub projects and the beginning of five dated internal capability records](docs/screenshots/portfolio.png)

The Portfolio joins three allowlisted public projects—**Jarvis**, **StackLogic**, and **8-Ball**—with five dated internal capability records. Public evidence and private operating capability remain visibly separate.

![Matrix Portfolio continuation showing all five internal products and capabilities with outcomes, state, authority, and verification dates](docs/screenshots/portfolio-details.png)

Each capability carries a scoped outcome, operating state, evidence authority, verification date, and limitation. Historical proof stays historical; it is not promoted into an unsupported availability claim.

### Actual measured Benchmarks

![Matrix Benchmarks view comparing six measured model conditions across instruction following, native tool use, and multi-turn agent work](docs/screenshots/benchmarks.png)

The dated benchmark projection compares **six measured conditions** across three complementary capabilities: instruction following, native tool use, and sustained multi-turn work. Every score belongs to an exact condition and frozen suite release.

![Matrix Benchmarks continuation showing pending-score withholding and the measured IFEval, BFCL V4 Hard-50, and tau2 Hard-24 tables](docs/screenshots/benchmarks-details.png)

Complete and partial coverage are not cross-ranked. Pending suites remain queued or withheld rather than being treated as zero, while measured zeroes remain legitimate results.

## Narration transcript

<details>
<summary><strong>Low-variance Prime-clone walkthrough transcript</strong></summary>

Autobot Command Center brings real analytics, portfolio evidence, and model evaluations into one read-only decision surface. This walkthrough uses the Matrix theme.

The dated alexgeslani.com snapshot covers thirty-six thousand, one hundred forty-eight requests and twenty-two thousand, six hundred thirty visits through August twenty-eighth, twenty twenty-six. Coverage gaps remain visible. They never become zeros.

Portfolio shows three public projects and five internal capability records. Each entry keeps its source, refresh date, outcome, and limitation, so historical proof stays historical and current capability remains clearly scoped.

Benchmarks compare six measured model conditions across instruction following, native tool use, and sustained multi-turn work. Frozen releases, exact denominators, and pending lanes remain visible. Scores without complete evidence are withheld rather than treated as zero. Autobot Command Center projects the evidence and fails closed. It does not become another source of truth.

</details>

The narration was rendered locally with `Qwen/Qwen3-TTS-12Hz-0.6B-Base` and the approved `optimus-prime` clone profile using the accepted low-variance decoding settings. It is **clone-conditioned, not instruction-conditioned**. No hosted speech API was used.

## Trust and privacy model

- **No secrets or local deployment configuration belong in Git.**
- Mutable provider usage, real web analytics JSON, runtime projections, host bindings, environment files, keys, and certificates are Git-ignored.
- The tracked media is a dated, user-authorized projection of selected Portfolio, Benchmark, and aggregate analytics evidence—not a tracked copy of mutable runtime JSON.
- Collectors and projections use closed identity, source, and field allowlists.
- The browser receives sanitized aggregates—not credentials, cookies, account identity, prompts, billing data, raw provider responses, or raw request logs.
- Invalid, stale, missing, pending, and measured-zero states remain distinct.
- Country-level analytics evidence is not used to infer people, sessions, or US states.

See [SECURITY.md](SECURITY.md) for the complete reporting and deployment boundary.

## Two build targets

| Target | Output | Purpose |
|---|---|---|
| Hermes dashboard plugin | `.hermes/plugins/autobot-command-center/dashboard/dist/index.js` | Native read-only Command Center route inside Hermes |
| Standalone application | `standalone/public/` | Static review, browser testing, and portable deployment artifact |

Both targets are generated from the same source and contracts. Generated bundles are rebuilt—never hand-edited.

## Local development

**Requirements:** Node.js 22+ and npm.

```bash
npm ci
npm test
npm run build
npm run test:standalone
npm run security:public
```

Preview the standalone artifact:

```bash
node scripts/serve-standalone.mjs
```

Then open `http://127.0.0.1:9130/`.

## Project structure

```text
src/                  React Core, runtime contracts, analytics, and trust semantics
config/               immutable, sanitized Edition and showcase policy
fixtures/demo/         deterministic demonstration projection for a clean clone
collector/             bounded provider and aggregate-analytics adapters
bridge/                optional protected knowledge-search bridge
standalone/            static entry point and generated artifact
.hermes/plugins/       Hermes plugin manifest and generated dashboard bundle
scripts/               build, publication, safety, and showcase-capture tools
tests/                 unit, contract, accessibility, and browser acceptance tests
docs/                  architecture, dated screenshots, demo video, and recovery notes
```

## Design boundary

Autobot Command Center projects evidence; it does not operate the systems it observes. Account switching, benchmark launch, workflow mutation, and arbitrary browser-configured data sources are intentionally out of scope.

## Status

Public portfolio showcase. The repository includes sanitized demonstration data so a clean clone remains reviewable without private infrastructure. Dated authorized media may show selected real aggregate evidence, while mutable deployment projections remain outside Git.

## Trademark notice

The Autobot name and emblem are third-party marks, are not covered by this repository’s software license, and do not imply affiliation or endorsement.

## License

[MIT](LICENSE) © Alex Geslani. Third-party marks are excluded.

<!-- Maintainers: keep shipped routes, capture provenance, screenshots, demo media, architecture, and README claims synchronized. -->
