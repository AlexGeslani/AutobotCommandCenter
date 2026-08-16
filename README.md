# Autobot Command Center

![Autobot Command Center benchmark view](docs/screenshots/benchmarks.png)

A read-only, mobile-first evidence dashboard for products, model evaluations, skills, and provider usage. It turns scattered operational artifacts into a claim-safe visual projection without becoming a second source of truth.

> The checked-in application uses clearly labeled demonstration fixtures. Private deployment bindings, credentials, account data, runtime snapshots, hostnames, addresses, and local filesystem paths are intentionally excluded.

## What it demonstrates

- **Evidence-first product UX** — every state carries authority, freshness, and explicit stale or missing behavior.
- **Condition-aware model evaluation** — scores belong to an exact model condition, benchmark release, and supporting run lineage.
- **Fail-closed provider usage** — missing telemetry is never presented as zero, healthy, unlimited, or current.
- **Responsive information architecture** — desktop matrices become focused, touch-friendly detail views on mobile.
- **One source, two surfaces** — the same React application builds as a Hermes dashboard plugin and as a standalone static review artifact.
- **Protected search boundary** — an optional server-side bridge uses strict request bounds, collection allowlists, origin checks, and file-mounted credentials.

## Screenshots

| Portfolio | Model observatory |
|---|---|
| ![Portfolio view](docs/screenshots/portfolio.png) | ![Benchmark view](docs/screenshots/benchmarks.png) |

## Architecture

```text
Authoritative artifacts and provider telemetry
                  │
        bounded source adapters
                  │
       sanitized snapshot / fixtures
                  │
      ┌───────────┴───────────┐
      │                       │
Hermes dashboard plugin   standalone static build
      │                       │
      └────── read-only UI ───┘
```

The browser never receives raw provider responses, account identity, prompts, credentials, protected filesystem paths, or billing data. Mutable provider snapshots are ignored by Git.

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm ci
npm test
npm run build
```

To preview the standalone artifact:

```bash
cd standalone/public
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8080/`.

## Project structure

```text
src/                  shared application and data contracts
collector/            bounded, fail-closed provider adapters
bridge/               optional protected knowledge-search bridge
standalone/            static entry point and generated artifact
.hermes/plugins/       Hermes dashboard plugin manifest and build
ops/                   public-safe deployment templates only
tests/                 model, adapter, browser, and boundary tests
docs/                  design contracts and showcase material
```

## Security and privacy

- No secrets or local deployment configuration belong in this repository.
- `standalone/public/data/provider-usage.v1.json` is mutable runtime state and is ignored.
- Public examples use placeholders and synthetic fixture identities.
- The original project mark is custom artwork; no third-party franchise logo is included.
- See [SECURITY.md](SECURITY.md) for reporting and deployment guidance.

## Status

Active portfolio project. The dashboard remains read-only by design; mutation, account switching, benchmark launch, and configuration controls are intentionally out of scope.

## License

[MIT](LICENSE) © Alex Geslani
