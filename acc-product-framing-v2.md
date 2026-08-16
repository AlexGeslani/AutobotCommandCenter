# Autobot Command Center — Product Framing v2

Status: Prime working hypothesis; not yet submitted to Autobots
Date: 2026-07-26

## Product sentence

The Autobot Command Center is a read-only, mobile-first visual projection of what the system has produced, what has been learned, what is available now, and what is being evaluated next.

It is not a Wiki, task manager, session browser, or second configuration surface.

## Why the prior framing was wrong

The first SVG over-weighted current operations. “Outcomes & Exceptions” and “Prime Now” made the ACC resemble a mission-control/task dashboard. Hermes already has Sessions, Chat, Analytics, Models, Logs, Cron, Kanban, Skills, Profiles, and Config for those concerns.

The legacy ACC was a Markdown map-of-content for doctrine, decisions, questions, projects, and links. Recreating that structure visually would produce another parallel information architecture that needs maintenance and competes with the canonical Wiki.

The ACC should instead answer four durable human questions:

1. What have we built or made usable?
2. What did our evaluations establish?
3. Which model conditions and system capabilities are available now?
4. What promising bets are still being evaluated?

## Proposed information architecture

### 1. Overview

A compressed outcome plane, not a generic dashboard.

- Recently landed: verified changes, completed evaluations, and product milestones.
- Product/capability readiness: compact cards for Voice Lab, model serving, benchmark program, agent workflows, Release Platform, and future products.
- Model snapshot: current leaders by separate capability area, never a misleading universal winner.
- Active evaluations: only high-signal experiments with hypothesis, progress, and expected decision.
- Resource exceptions: quota exhausted, service unavailable, stale source, or missing authoritative telemetry.
- Small “Hermes activity” strip linking to existing Chat, Sessions, Kanban, Cron, and Logs rather than duplicating them.

### 2. Portfolio

The durable showcase of products, capabilities, initiatives, and curated future bets.

Internal views:

- Products & Capabilities: things that graduated from evaluation into something usable.
- Initiatives: coherent outcome-seeking programs that may contain multiple evaluations or products.
- Next Bets: Near, Explore, and Parked opportunities with expected value, decision gap, dependency, and what graduation would create.

Evaluations are embedded evidence records on the portfolio item they inform. A product or initiative click-in shows its evaluation timeline, hypotheses, provisional/final findings, decisions, and the state changes those decisions caused. Portfolio may offer an `All evaluations` filter for discovery, but Evaluation is not a separate primary destination.

Each product/capability has:

- Name and one-sentence value.
- Lifecycle state: Prototype, Usable, Production, Paused, Retired.
- Last verified time and source status.
- What works now.
- Evidence/results gallery: screenshots, audio samples, benchmark deltas, demos, or artifacts.
- Current operating envelope and meaningful limitations.
- Related evaluations and canonical Wiki link.
- Next decision, not a task backlog.

Examples include Voice Lab, local model service, benchmark system, Teams meeting pipeline, HER2 Compass, and Release Platform only when source-backed.

### 3. Model Observatory

A permanent, public-leaderboard-style surface listing all evaluated model conditions.

The row identity is a model condition, not merely a model name: model/checkpoint, provider/runtime, reasoning setting, quantization, context/output envelope, and deployment geometry where material.

Primary views:

- Leaderboards: separate sortable rankings for Tool Use, GPQA Diamond, and Offline-safe Coding. No cross-domain aggregate.
- All Models: current, candidate, historical, retired, cloud, GPU Node B, and Edge Node A filters.
- Compare: selected conditions with identical score definitions and explicit comparability warnings.
- Model Profile: stable model-family identity, publisher, architecture/license where known, available variants, hosting locations, current roles, and every evaluated/deployed condition.
- Condition Detail: exact checkpoint/provider/runtime, host, quantization, reasoning setting, sampling, context/output geometry, MTP, scores, reliability, throughput/latency, resource footprint, current availability, and evidence lineage.
- Benchmark Run Detail: suite denominators, input/output/reasoning tokens where reported, calls, summed request wall, failures/timeouts/invalids, direct cost or clearly labeled API-equivalent cost where calculable, provider-plan/quota interpretation, frozen manifest/release, and source artifacts.
- Benchmark Releases: frozen suite/manifest generations, denominator changes, methodology, and comparability boundaries.

Click behavior is condition-aware: clicking a leaderboard row opens the exact tested condition, nested within its model-family profile. This prevents a score from being misread as applying to every quantization, reasoning level, provider, or deployment of the model.

Borrow from Artificial Analysis:

- Searchable/sortable model matrix.
- Facets for reasoning, status, deployment class, and availability.
- Performance/cost/context columns.

Borrow from LiveBench:

- Explicit benchmark release selector.
- Category-first views.
- Expandable condition rows and subtask detail.
- Cost/consumption adjacent to capability results.

Do not borrow:

- A single opaque intelligence number.
- Implied comparability across materially different harness generations.
- Provider quota guesses.

### 4. Skill Registry

A durable catalog of the skills we created, substantially maintain, adopted, or may publish.

Hermes OOTB already owns operational skill management: list/search/filter, profile scoping, enable/disable, create/edit `SKILL.md`, Learn a skill, hub discovery/install/update, and toolset configuration. ACC should deep-link to that surface rather than reproduce it.

ACC adds the missing artifact-lifecycle views:

- Ours: authored here.
- Maintained: forked or substantially adapted here.
- Adopted: installed upstream/community skills we use but do not own.
- Publish Queue: skills being prepared for the shared GitHub repository.
- Published: repository/release link, version, license, and upstream relationship.
- Deprecated: retained provenance and successor.

Each skill record should show origin, category, profile scope, lifecycle status, version, last changed, last validated, platform/dependency envelope, linked files, consumers, Git/repository state, publication readiness, and quality/security checks. A skill detail page can show changelog, validation evidence, portability blockers, and links to the Hermes editor or repository workflow.

### Embedded Evaluation Records

Evaluations are the conversion pipeline from question to product/capability decision, but not a top-level navigation silo.

Each evaluation shows:

- Hypothesis or decision sought.
- Target product/capability.
- Stage: Proposed, Designing, Running, Verifying, Decided, Inconclusive.
- Evidence completion, not task completion.
- Current finding with provisional/final distinction.
- Decision outcome: Promote, Retain, Reject, Re-run, or No decision.
- What it changed when completed: product readiness, model ranking, deployment profile, or no change.

Completed evaluations remain browsable as provenance through the portfolio item, model condition, benchmark run, or skill they affected. Cross-cutting search/filter can expose all evaluations without creating a parallel home for them.

## Lifecycle model

Evaluation is not a sibling of product; it is the mechanism that changes product/capability state.

```text
Question / opportunity
        ↓
Evaluation
        ↓
Decision ──→ no change / rejected / archived evidence
        ↓
Capability or product state changes
        ↓
Overview shows the landed outcome
```

Benchmark evaluations also publish into the permanent Model Observatory after final verification.

Skill work follows a parallel artifact lifecycle:

```text
Reusable workflow
        ↓
Skill draft
        ↓
Validation and real use
        ↓
Maintained internal asset
        ↓
Publish candidate → GitHub release / upstream contribution
```

## Hermes Dashboard integration

Recommendation: implement ACC as one native web-dashboard plugin tab with its own internal routes.

Verified installed contract:

- Hermes version: 0.18.2.
- Dashboard plugin SDK contract: 1.1.0.
- A plugin manifest can add a tab at a chosen position, hide the tab, or override a built-in route.
- The JavaScript bundle registers a React component through `window.__HERMES_PLUGINS__`.
- The SDK exposes authenticated API helpers, Hermes theme-aware UI primitives, hooks, utilities, and plugin slots.
- A Python FastAPI router can provide backend endpoints under `/api/plugins/<name>/`.
- Plugin CSS and Subresource Integrity are supported.

Recommended integration behavior:

- Add one `Command Center` tab; do not override Hermes Overview.
- Use internal subnavigation: Overview, Portfolio, Benchmarks, Skills.
- Deep-link to existing Hermes Chat, Sessions, Kanban, Cron, Logs, Models, and Config where the action belongs.
- Keep ACC read-only in v1. No inline Wiki editing, provider configuration, benchmark execution, task mutation, or approval actions.
- Use Hermes theme variables/components so ACC survives theme changes.
- Treat public/non-loopback exposure as operator access to Hermes; keep the established authentication/trust boundary.

## Mobile-first behavior

Hermes already switches from the desktop sidebar to a fixed mobile top bar below 1024px. The plugin must own its internal responsive behavior.

### Mobile Overview

- Single vertical outcome feed.
- First screen: system/source trust strip, latest landed outcome, product readiness, and any critical resource exception.
- Horizontal chips for Products, Models, Evaluations, and Bets; no miniature desktop grid.
- Expand details into full-screen sheets/pages rather than tiny drawers.

### Mobile Model Observatory

Do not squeeze the desktop leaderboard table onto a phone.

- Metric selector first: Tool Use, GPQA, Coding, Throughput, Context, Availability.
- Compact ranked rows: rank, model condition short name, selected metric, status badge.
- Tap opens the exact condition inside a full-screen model profile.
- Compare mode limited to two or three selected conditions.
- Secondary columns available in the detail view, not through horizontal-scroll dependence.

### Mobile Products

- Visual cards with state, last verified, one key outcome, and one limitation.
- Evidence gallery supports screenshots/audio where appropriate.
- Product detail is narrative and visual, not a dense table.

### Mobile Skills

- Filter chips for Ours, Maintained, Adopted, Publish Queue, and Published.
- Compact rows show skill name, lifecycle, validation state, and repository status.
- Skill detail opens full-screen; editing continues in the existing Hermes Skills surface.

### Mobile Evaluation Evidence

- Evaluations appear inside their product, initiative, model-condition, benchmark-run, or skill detail.
- Portfolio can expose an `All evaluations` filter with stage chips and compact evidence-progress bars.
- Provisional/final status always visible without opening detail.
- Completed evaluation shows the product/model state it changed.

### Mobile ergonomics

- Touch targets at least 44px.
- Safe-area aware fixed elements.
- No hover-only explanation.
- Sticky local section switcher only if it does not conflict with Hermes’s mobile header.
- Reduced-motion support and accessible non-color status encoding.

## Data and truth boundaries

ACC is a projection layer. It should read source-specific adapters and never become the source of truth.

- Canonical conclusions and product descriptions: active LLM Wiki.
- Final benchmark results and metric lineage: finalized verification artifacts plus canonical production model baseline.
- Current Hermes usage/activity: Hermes dashboard APIs.
- Current service state: verified service/model endpoints or retained health artifacts.
- Provider quota: only authoritative provider telemetry or explicit retained quota state. Hermes token analytics are local usage estimates, not provider balance.
- Images/audio/demos: immutable or repository-managed artifact references.
- Skill inventory and enabled/profile state: Hermes Skills APIs and filesystem metadata.
- Skill authorship, maintenance, validation, and publication state: repository-backed metadata or a deterministic projection from skill/repository history; never a second manually maintained catalog.

Every visual datum should carry source class and freshness. Missing authority renders as Unknown, not zero or healthy.

## Acceptance tests before implementation

1. In ten seconds, Alphatrion can identify one landed outcome, one current product capability, one model leader for a selected domain, and one meaningful evaluation in flight.
2. The same answers are reachable on phone without horizontal scrolling.
3. No ACC datum must be manually maintained in two places.
4. Clicking an operational action routes to the existing Hermes surface rather than duplicating it.
5. A stale/missing source degrades visibly and never presents old state as live.
6. Benchmark rankings remain condition-aware and category-separated.
7. A completed evaluation visibly changes a product, capability, or benchmark record—or records that it changed nothing.
8. Every maintained skill has visible origin, validation, and publication state without duplicating its `SKILL.md` content.

## Questions for the eventual Autobots MoA

The MoA should challenge this product hypothesis, not brainstorm from zero:

1. Is Portfolio + Model Observatory + Skill Registry the correct durable core, with evaluation evidence embedded rather than separately navigated?
2. What should Overview show to prove value without becoming another operations dashboard?
3. Is a single Hermes plugin tab with internal routes the safest low-maintenance integration?
4. What is the minimum mobile information density that still feels like a command center?
5. How should condition-level benchmark ranking remain understandable to a non-research glance?
6. Which source adapters can be built without introducing a second truth store?
7. What should be explicitly excluded from v1?
8. What is the leanest repository metadata contract that distinguishes authored, maintained, adopted, publish-ready, and published skills?

## Proposed v1 exclusion list

- Wiki editing.
- Skill editing or enable/disable controls; use the existing Hermes Skills page.
- Git commit, repository publication, release, or upstream-submission controls.
- Kanban/task mutation.
- Benchmark launch controls.
- Provider/model configuration.
- Secrets or raw environment values.
- Universal aggregate model score.
- Quota estimates without authoritative telemetry.
- Autonomous product/project state changes.
- Public-internet exposure work.
