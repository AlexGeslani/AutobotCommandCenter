# Autobot Command Center showcase film

**Runtime:** 68 seconds

**Format:** 1440×900, 25 fps, H.264/AAC, GitHub-inline compatible

**Visual source:** the actual standalone ACC application rendered with an authorized sanitized snapshot

**Sound:** original locally generated narration plus restrained synthesized interface tones; no copyrighted music or character audio

## Timeline

| Time | Visual | Narration |
|---:|---|---|
| 0:00–0:05 | Dark boot card: `AUTOBOT COMMAND CENTER` / `PROJECT AGENT` / `VERIFY REALITY` | “Building AI systems is easy. Knowing what actually works is harder.” |
| 0:05–0:15.5 | Fast application cuts: overview → Portfolio → Model Observatory → Analytics | “My agents ship products. Local and frontier models compete for workloads. Real systems generate evidence every day. I wanted one place to see what was real.” |
| 0:15.5–0:28 | Portfolio detail, outcome and provenance highlights | “Portfolio tracks what we've actually shipped, what each system can do, and where the evidence came from.” |
| 0:28–0:43 | Model Observatory, exact-condition comparison and measured-suite highlights | “The Model Observatory answers the question I care about most: which model actually performs best for my workloads?” / “No vibes. Exact model. Exact quant. Exact benchmark. Exact result.” |
| 0:43–0:53.5 | Aggregate Analytics, coverage and trust-boundary highlights | “Real analytics come in too, but only as privacy-safe aggregates.” / “Missing data stays missing. Unknown never magically becomes zero.” |
| 0:53.5–0:62.8 | Unified application overview | “One evidence layer. Multiple interfaces. No second source of truth.” / “This is how I'm building my own AI operating system.” |
| 0:62.8–0:68 | Payoff card: `PROJECT AGENT` / `BUILD → VERIFY → LEARN` / `ALEX GESLANI` | Visual tail and synthesized interface tone |

## Voice direction

Original, non-imitative cinematic robotic-command delivery: deep, calm, warm, authoritative, deliberate, and slightly synthetic. The narration is generated locally with Qwen3-TTS and receives only bounded level/timing treatment for the film. No hosted speech API or source voice material is published.

## Capture integrity

- The presentation layer adds only title cards, section labels, highlights, and camera-like pacing.
- Product screens are rendered by the real ACC application; no product behavior is fabricated in post-production.
- Inputs are deterministic sanitized fixtures or owner-authorized safe aggregates copied to ignored local scratch.
- Mutable runtime projections and local narration source artifacts are not committed.
- Public release requires `npm run security:media` and the human checks in [`docs/PUBLIC_MEDIA_CHECKLIST.md`](../PUBLIC_MEDIA_CHECKLIST.md).
