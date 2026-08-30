export const FILM_DURATION_SECONDS = 68;

export const SHOWCASE_SCENES = Object.freeze([
  { id: 'boot', start: 0, end: 5 },
  { id: 'rapid-overview', start: 5, end: 15.5 },
  { id: 'portfolio', start: 15.5, end: 28 },
  { id: 'model-observatory', start: 28, end: 43 },
  { id: 'analytics', start: 43, end: 53.5 },
  { id: 'unified', start: 53.5, end: 62.8 },
  { id: 'payoff', start: 62.8, end: FILM_DURATION_SECONDS },
]);

export const NARRATION_SEGMENTS = Object.freeze([
  {
    id: 'hook',
    start: 0.4,
    text: 'Building AI systems is easy. Knowing what actually works is harder.',
  },
  {
    id: 'system',
    start: 5.2,
    text: 'My agents ship products. Local and frontier models compete for workloads. Real systems generate evidence every day. I wanted one place to see what was real.',
  },
  {
    id: 'portfolio',
    start: 15.7,
    text: "Portfolio tracks what we've actually shipped, what each system can do, and where the evidence came from.",
  },
  {
    id: 'model-question',
    start: 28.4,
    text: 'The Model Observatory answers the question I care about most: which model actually performs best for my workloads?',
  },
  {
    id: 'exactness',
    start: 36.8,
    text: 'No vibes. Exact model. Exact quant. Exact benchmark. Exact result.',
  },
  {
    id: 'aggregates',
    start: 43.2,
    text: 'Real analytics come in too, but only as privacy-safe aggregates.',
  },
  {
    id: 'unknowns',
    start: 47.8,
    text: 'Missing data stays missing. Unknown never magically becomes zero.',
  },
  {
    id: 'evidence-layer',
    start: 53.5,
    text: 'One evidence layer. Multiple interfaces. No second source of truth.',
  },
  {
    id: 'payoff',
    start: 58.3,
    text: "This is how I'm building my own AI operating system.",
  },
]);
