export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'skills', label: 'Skill Registry' },
  { id: 'hivemind', label: 'Hive Mind' },
];

export const fixtures = {
  meta: {
    fixture: true,
    generatedAt: '2026-07-26T00:00:00Z',
    notice: 'Prototype fixtures — not canonical operational data',
  },
  sources: [
    { id: 'wiki', label: 'LLM Wiki', authority: 'Product claims and conclusions', state: 'fresh', freshness: 'Verified 18m ago', invalidatesClaims: false },
    { id: 'benchmarks', label: 'Frozen benchmark artifacts', authority: 'Final scores and run lineage', state: 'fresh', freshness: 'Verified 42m ago', invalidatesClaims: false },
    { id: 'runtime', label: 'Runtime telemetry', authority: 'Current service availability', state: 'stale', freshness: 'Last successful read 9h ago', invalidatesClaims: true },
    { id: 'skill-meta', label: 'Skill publication metadata', authority: 'Publication and stewardship state', state: 'missing', freshness: 'Adapter not connected', invalidatesClaims: true },
    { id: 'voice-performance', label: 'Prime voice benchmark', authority: 'Voice route latency, RTF, and reliability', state: 'fresh', freshness: 'Measured 2026-07-26', invalidatesClaims: false },
  ],
  voicePerformance: {
    id: 'voice-performance-2026-07-26',
    observedAt: '2026-07-26',
    source: 'Prime dev matched-route benchmark',
    method: 'Same sentence; median of three warm end-to-end requests per route through Prime dev. First byte for GPU Node B Qwen is streamed audio; WAV routes deliver on completion.',
    reliabilityNote: 'GPU Node B Qwen completed 2/3 matched trials; one request streamed runaway audio until the 90-second client timeout. A later bounded confirmation retry completed in 7.14 seconds.',
    routes: [
      { id: 'edge-a-kokoro-mlx', host: 'Edge Node A', engine: 'Kokoro MLX', firstByteSeconds: 0.337, completeSeconds: 0.344, rtf: 0.095, successfulTrials: 3, totalTrials: 3, timeouts: 0, position: 'Fastest' },
      { id: 'gpu-b-kokoro-fp32', host: 'GPU Node B', engine: 'Kokoro FP32', firstByteSeconds: 0.440, completeSeconds: 0.444, rtf: 0.153, successfulTrials: 3, totalTrials: 3, timeouts: 0, position: 'Near-instant' },
      { id: 'edge-a-gpt-sovits-mlx', host: 'Edge Node A', engine: 'GPT-SoVITS MLX', firstByteSeconds: 2.210, completeSeconds: 2.216, rtf: 0.436, successfulTrials: 3, totalTrials: 3, timeouts: 0, position: 'Fastest clone' },
      { id: 'gpu-b-qwen3-rocm', host: 'GPU Node B', engine: 'Qwen3-TTS ROCm', firstByteSeconds: 1.662, completeSeconds: 5.987, rtf: 1.565, successfulTrials: 2, totalTrials: 3, timeouts: 1, position: 'Early audio / watch' },
      { id: 'edge-a-qwen-cpu', host: 'Edge Node A', engine: 'Qwen CPU', firstByteSeconds: 13.628, completeSeconds: 13.631, rtf: 2.543, successfulTrials: 3, totalTrials: 3, timeouts: 0, position: 'Baseline' },
      { id: 'edge-a-qwen-mlx', host: 'Edge Node A', engine: 'Qwen MLX', firstByteSeconds: 14.303, completeSeconds: 14.305, rtf: 3.031, successfulTrials: 3, totalTrials: 3, timeouts: 0, position: 'Slowest current' },
    ],
  },
  products: [
    {
      id: 'voice-lab', name: 'Voice Lab', kind: 'Product', state: 'Human gate', verified: '2026-07-26', source: 'Prime voice benchmark',
      value: 'Reusable intranet-first voice interaction core for tutors, agents, avatars, calls, and meetings.',
      outcome: 'Six configured voice routes are now compared end-to-end; Edge Node A Kokoro leads at 0.344 seconds while GPU Node B Kokoro follows at 0.444 seconds.',
      limitation: 'GPU Node B Qwen produced one runaway 90-second timeout in the matched set; voice quality remains a subjective human gate.',
      worksNow: ['Six-route performance comparison', 'Non-speech rejection', 'Profile-driven output'],
      evidence: ['Voice performance snapshot · 2026-07-26', 'Prime acceptance suite', 'Audio sample set'], evaluations: ['eval-voice-runtime-comparison', 'eval-voice-latency'],
    },
    {
      id: 'model-serving', name: 'Local Model Service', kind: 'Capability', state: 'Usable', availabilityAuthority: 'runtime', verified: '42m ago', source: 'Frozen benchmark artifacts',
      value: 'Private local inference for bounded agent and evaluation workloads.',
      outcome: 'Qwen3.6 AWQ condition is deployable with a defined context/output envelope.',
      limitation: 'Current availability is unknown while runtime telemetry is stale.',
      worksNow: ['OpenAI-compatible endpoint', 'Condition manifests', 'Bounded outputs'],
      evidence: ['Frozen run manifests', 'Service acceptance record'], evaluations: ['eval-model-condition'],
    },
    {
      id: 'benchmark-program', name: 'Benchmark Program', kind: 'Capability', state: 'Usable', verified: '42m ago', source: 'Frozen benchmark artifacts',
      value: 'Comparable model-condition evidence across tool use, reasoning, and offline-safe coding.',
      outcome: 'Release-scoped canonical results and run lineage are available.',
      limitation: 'Cross-release rankings are intentionally prohibited.',
      worksNow: ['BFCL', 'GPQA Diamond', 'BigCodeBench-Hard'],
      evidence: ['Frozen manifests', 'Canonical result index'], evaluations: ['eval-model-condition'],
    },
    {
      id: 'release-platform', name: 'Release Platform', kind: 'Product', state: 'Production', verified: '1h ago', source: 'LLM Wiki',
      value: 'Public home for durable projects, demonstrations, and released artifacts.',
      outcome: 'Repository-backed publishing path is operational.',
      limitation: 'ACC does not publish or edit content.',
      worksNow: ['Project pages', 'Repository evidence', 'Public-CA TLS'],
      evidence: ['Production URL', 'Deployment record'], evaluations: [],
    },
  ],
  modelFamilies: [
    { id: 'qwen36', name: 'Qwen3.6 35B-A3B', publisher: 'Qwen', architecture: 'MoE', license: 'Known in source manifest', roles: ['Local agent', 'Evaluation candidate'] },
    { id: 'gpt56', name: 'GPT-5.6', publisher: 'OpenAI', architecture: 'Hosted', license: 'Provider terms', roles: ['Review lane'] },
    { id: 'devstral', name: 'Devstral Small 2 24B', publisher: 'Mistral AI', architecture: 'Dense', license: 'Known in source manifest', roles: ['Offline-safe coding candidate'] },
  ],
  conditions: [
    {
      id: 'qwen36-awq-vllm', familyId: 'qwen36', shortName: 'Qwen3.6 35B · AWQ · vLLM', provider: 'GPU Node B', runtime: 'vLLM', quantization: 'AWQ', reasoning: 'Direct', host: 'GPU Node B',
      context: '128K tested', output: '16K cap', availability: 'unknown', availabilityNote: 'Runtime telemetry stale',
      fingerprint: 'qwen36-35b-a3b|awq|vllm|direct|ctx128k|out16k|gpu-node-b',
      results: [],
    },
    {
      id: 'gpt56-max-api', familyId: 'gpt56', shortName: 'GPT-5.6 · Max · API', provider: 'OpenAI', runtime: 'Responses API', quantization: 'Provider managed', reasoning: 'Max', host: 'Cloud',
      context: 'Provider envelope', output: 'Provider envelope', availability: 'available', availabilityNote: 'Prototype fixture only',
      fingerprint: 'gpt56|max|responses-api|provider-managed|cloud',
      results: [],
    },
    {
      id: 'devstral-fp8-vllm', familyId: 'devstral', shortName: 'Devstral Small 2 · FP8 · vLLM', provider: 'GPU Node B', runtime: 'vLLM', quantization: 'FP8', reasoning: 'Direct', host: 'GPU Node B',
      context: '64K tested', output: '8K cap', availability: 'unavailable', availabilityNote: 'Not currently loaded',
      fingerprint: 'devstral-small2-24b|fp8|vllm|direct|ctx64k|out8k|gpu-node-b',
      results: [],
    },
  ],
  results: [
    { id: 'r-bfcl-gpt', conditionId: 'gpt56-max-api', domain: 'tool-use', release: 'bfcl-v3', score: 89.4, denominator: 1000, status: 'canonical', runIds: ['run-bfcl-gpt'] },
    { id: 'r-bfcl-qwen', conditionId: 'qwen36-awq-vllm', domain: 'tool-use', release: 'bfcl-v3', score: 84.1, denominator: 1000, status: 'canonical', runIds: ['run-bfcl-qwen'] },
    { id: 'r-bfcl-dev', conditionId: 'devstral-fp8-vllm', domain: 'tool-use', release: 'bfcl-v3', score: 76.2, denominator: 1000, status: 'canonical', runIds: ['run-bfcl-dev'] },
    { id: 'r-bfcl-qwen-provisional', conditionId: 'qwen36-awq-vllm', domain: 'tool-use', release: 'bfcl-v4-preview', score: 88.8, denominator: 400, status: 'provisional', runIds: ['run-bfcl-qwen-preview'] },
    { id: 'r-gpqa-gpt', conditionId: 'gpt56-max-api', domain: 'reasoning', release: 'gpqa-diamond-2026-06', score: 88.0, denominator: 198, status: 'canonical', runIds: ['run-gpqa-gpt'] },
    { id: 'r-gpqa-qwen', conditionId: 'qwen36-awq-vllm', domain: 'reasoning', release: 'gpqa-diamond-2026-06', score: 74.7, denominator: 198, status: 'canonical', runIds: ['run-gpqa-qwen'] },
    { id: 'r-code-dev', conditionId: 'devstral-fp8-vllm', domain: 'coding', release: 'bigcodebench-hard-2026-06', score: 61.8, denominator: 148, status: 'canonical', runIds: ['run-code-dev'] },
    { id: 'r-code-gpt', conditionId: 'gpt56-max-api', domain: 'coding', release: 'bigcodebench-hard-2026-06', score: 65.5, denominator: 148, status: 'canonical', runIds: ['run-code-gpt'] },
    { id: 'r-code-qwen', conditionId: 'qwen36-awq-vllm', domain: 'coding', release: 'bigcodebench-hard-2026-06', score: 57.4, denominator: 148, status: 'canonical', runIds: ['run-code-qwen'] },
  ],
  runs: [
    { id: 'run-bfcl-gpt', label: 'BFCL canonical run · GPT-5.6', manifest: 'bfcl-v3.freeze.json', calls: 1000, failures: 4, inputTokens: 1820000, outputTokens: 248000, reasoningTokens: 611000, wall: '2h 18m', cost: '$74.20 direct', source: 'Frozen artifact' },
    { id: 'run-bfcl-qwen', label: 'BFCL canonical run · Qwen3.6 AWQ', manifest: 'bfcl-v3.freeze.json', calls: 1000, failures: 17, inputTokens: 1815000, outputTokens: 291000, reasoningTokens: null, wall: '5h 41m', cost: 'Unknown', source: 'Frozen artifact' },
    { id: 'run-bfcl-dev', label: 'BFCL canonical run · Devstral FP8', manifest: 'bfcl-v3.freeze.json', calls: 1000, failures: 21, inputTokens: 1818000, outputTokens: 306000, reasoningTokens: null, wall: '4h 52m', cost: 'Unknown', source: 'Frozen artifact' },
    { id: 'run-bfcl-qwen-preview', label: 'BFCL preview · Qwen3.6 AWQ', manifest: 'bfcl-v4.preview.json', calls: 400, failures: 8, inputTokens: 721000, outputTokens: 116000, reasoningTokens: null, wall: '2h 02m', cost: 'Unknown', source: 'Provisional artifact' },
    { id: 'run-gpqa-gpt', label: 'GPQA canonical run · GPT-5.6', manifest: 'gpqa-diamond-2026-06.json', calls: 198, failures: 0, inputTokens: 238000, outputTokens: 144000, reasoningTokens: 480000, wall: '1h 06m', cost: '$31.40 direct', source: 'Frozen artifact' },
    { id: 'run-gpqa-qwen', label: 'GPQA canonical run · Qwen3.6 AWQ', manifest: 'gpqa-diamond-2026-06.json', calls: 198, failures: 3, inputTokens: 236000, outputTokens: 169000, reasoningTokens: null, wall: '2h 44m', cost: 'Unknown', source: 'Frozen artifact' },
    { id: 'run-code-dev', label: 'BigCodeBench-Hard · Devstral FP8', manifest: 'bcb-hard-2026-06.json', calls: 148, failures: 7, inputTokens: 562000, outputTokens: 287000, reasoningTokens: null, wall: '3h 21m', cost: 'Unknown', source: 'Frozen artifact' },
    { id: 'run-code-gpt', label: 'BigCodeBench-Hard · GPT-5.6', manifest: 'bcb-hard-2026-06.json', calls: 148, failures: 2, inputTokens: 557000, outputTokens: 248000, reasoningTokens: 192000, wall: '1h 48m', cost: '$48.10 direct', source: 'Frozen artifact' },
    { id: 'run-code-qwen', label: 'BigCodeBench-Hard · Qwen3.6 AWQ', manifest: 'bcb-hard-2026-06.json', calls: 148, failures: 9, inputTokens: 559000, outputTokens: 302000, reasoningTokens: null, wall: '4h 03m', cost: 'Unknown', source: 'Frozen artifact' },
  ],
  evaluations: [
    {
      id: 'eval-voice-runtime-comparison', title: 'Prime voice runtime comparison', stage: 'Human gate', findingStatus: 'final', decision: 'Keep both Kokoro routes; prefer GPT-SoVITS for the fastest cloned voice; retain GPU Node B Qwen as a reliability investigation.', progress: 100,
      question: 'Which configured route best serves instant speech, cloned voice identity, and streaming character quality?',
      finding: 'Edge Node A Kokoro is fastest at 0.344 seconds; GPU Node B Kokoro is near-instant at 0.444 seconds; GPT-SoVITS is the fastest cloned route at 2.216 seconds. GPU Node B Qwen streams earlier but had one runaway timeout.',
      comparisonId: 'voice-performance-2026-07-26',
      affectedObjects: [{ type: 'product', id: 'voice-lab', label: 'Voice Lab' }],
    },
    {
      id: 'eval-voice-latency', title: 'Voice interaction latency envelope', stage: 'Running', findingStatus: 'provisional', decision: 'No decision', progress: 68,
      question: 'Can the local voice core sustain conversational turn latency without accepting non-speech?',
      finding: 'Non-speech rejection is stable; interruption and tail latency remain under evaluation.',
      affectedObjects: [{ type: 'product', id: 'voice-lab', label: 'Voice Lab' }],
    },
    {
      id: 'eval-model-condition', title: 'Qwen3.6 production condition', stage: 'Verifying', findingStatus: 'provisional', decision: 'Re-run', progress: 84,
      question: 'Which bounded Qwen3.6 condition should become the default local agent profile?',
      finding: 'AWQ vLLM is deployable, but runtime telemetry must be restored before availability can be claimed.',
      affectedObjects: [{ type: 'product', id: 'model-serving', label: 'Local Model Service' }, { type: 'condition', id: 'qwen36-awq-vllm', label: 'Qwen3.6 AWQ vLLM' }],
    },
    {
      id: 'eval-skill-publishing', title: 'Skill publication contract', stage: 'Inconclusive', findingStatus: 'inconclusive', decision: 'No decision', progress: 100,
      question: 'What repository metadata can establish authorship, stewardship, validation, and publication?',
      finding: 'Lifecycle axes are defined; the canonical metadata adapter does not yet exist.',
      affectedObjects: [{ type: 'skill', id: 'autobots', label: '/autobots' }],
    },
  ],
  skills: [
    { id: 'autobots', name: '/autobots', category: 'Agent orchestration', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'candidate', validation: 'validated', lastValidated: 'today', envelope: 'Claude CLI + Codex CLI; isolated transport', repo: 'Metadata unavailable' },
    { id: 'voice-profile', name: 'voice-profile', category: 'Voice', provenance: 'authored here', stewardship: 'maintained here', publication: 'internal', validation: 'validated', lastValidated: '3d ago', envelope: 'macOS; local Qwen3-TTS', repo: 'Internal source' },
  ],
};

for (const condition of fixtures.conditions) {
  condition.results = fixtures.results.filter((result) => result.conditionId === condition.id);
}

export const RELEASES = {
  'tool-use': 'bfcl-v3',
  reasoning: 'gpqa-diamond-2026-06',
  coding: 'bigcodebench-hard-2026-06',
};

export function getCondition(id) {
  return fixtures.conditions.find((condition) => condition.id === id) || null;
}

export function getFamily(id) {
  return fixtures.modelFamilies.find((family) => family.id === id) || null;
}

export function getRun(id) {
  return fixtures.runs.find((run) => run.id === id) || null;
}

export function getRunLineage({ conditionId, resultId, domain, release, runId }) {
  const condition = getCondition(conditionId);
  const result = fixtures.results.find((item) => item.id === resultId);
  if (!condition || !result) return null;
  if (result.status !== 'canonical' || result.conditionId !== condition.id || result.domain !== domain || result.release !== release || !result.runIds.includes(runId)) return null;
  const run = getRun(runId);
  return run ? { condition, result, run } : null;
}

export function getEffectiveAvailability(condition) {
  const authority = fixtures.sources.find((source) => source.id === 'runtime');
  return authority?.invalidatesClaims ? 'unknown' : condition.availability;
}

export function getEffectiveProductClaims(product) {
  const authority = product.availabilityAuthority
    ? fixtures.sources.find((source) => source.id === product.availabilityAuthority)
    : null;
  if (authority?.invalidatesClaims) return { state: 'unknown', worksNow: null };
  return { state: product.state, worksNow: product.worksNow };
}

export function getEffectiveSkillClaims(skill) {
  const authority = fixtures.sources.find((source) => source.id === 'skill-meta');
  if (!authority?.invalidatesClaims) return { stewardship: skill.stewardship, publication: skill.publication };
  return { stewardship: 'unknown', publication: 'unknown' };
}

export function getLeaderboard(domain, release = RELEASES[domain]) {
  return fixtures.results
    .filter((result) => result.domain === domain && result.release === release && result.status === 'canonical')
    .map((result) => ({ ...result, condition: getCondition(result.conditionId) }))
    .sort((a, b) => b.score - a.score);
}

export function getCapabilityRollup() {
  const labels = { 'tool-use': 'Tool Use', reasoning: 'Reasoning', coding: 'Coding' };
  const knownConditions = new Set(fixtures.conditions.map((condition) => condition.id));
  const domainState = Object.entries(RELEASES).map(([id, release]) => {
    const grouped = new Map();
    for (const result of fixtures.results) {
      if (result.domain !== id || result.release !== release || result.status !== 'canonical' || !knownConditions.has(result.conditionId)) continue;
      const group = grouped.get(result.conditionId) || [];
      group.push(result);
      grouped.set(result.conditionId, group);
    }
    const resultByCondition = new Map(
      [...grouped.entries()].filter(([, results]) => results.length === 1).map(([conditionId, results]) => [conditionId, results[0]]),
    );
    const eligible = [...resultByCondition.values()];
    return { id, label: labels[id], release, best: eligible.length ? Math.max(...eligible.map((result) => result.score)) : null, resultByCondition };
  });
  const rows = fixtures.conditions.map((condition) => {
    const domainScores = {};
    const resultIds = [];
    const normalized = [];
    for (const domain of domainState) {
      const result = domain.resultByCondition.get(condition.id) || null;
      const contribution = result && domain.best ? (result.score / domain.best) * 100 : null;
      domainScores[domain.id] = contribution;
      if (result && contribution != null) {
        resultIds.push(result.id);
        normalized.push(contribution);
      }
    }
    const coverage = normalized.length;
    return {
      condition,
      index: coverage ? Number((normalized.reduce((sum, score) => sum + score, 0) / coverage).toFixed(1)) : null,
      coverage,
      totalDomains: domainState.length,
      complete: coverage === domainState.length,
      domainScores,
      resultIds,
    };
  });
  const byIndex = (a, b) => (b.index ?? -1) - (a.index ?? -1);
  return {
    domains: domainState.map(({ resultByCondition, ...domain }) => domain),
    complete: rows.filter((row) => row.complete).sort(byIndex),
    partial: rows.filter((row) => !row.complete).sort(byIndex),
  };
}

export function getEvaluationIndex() {
  return [...fixtures.evaluations].sort((a, b) => a.title.localeCompare(b.title));
}

export function getVoicePerformance(id = fixtures.voicePerformance.id) {
  return id === fixtures.voicePerformance.id ? fixtures.voicePerformance : null;
}

export function getSourceTrust() {
  return fixtures.sources;
}

export function buildAccUrl(state = {}, basePath = '/autobot-command-center') {
  const params = new URLSearchParams();
  for (const key of ['view', 'domain', 'product', 'condition', 'result', 'release', 'run', 'skill', 'evaluation']) {
    if (state[key]) params.set(key, state[key]);
  }
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}`;
}

export function parseAccUrl(input) {
  const url = new URL(input, 'http://localhost');
  const state = {};
  for (const key of ['view', 'domain', 'product', 'condition', 'result', 'release', 'run', 'skill', 'evaluation']) {
    const value = url.searchParams.get(key);
    if (value) state[key] = value;
  }
  if (!state.view) state.view = 'overview';
  return state;
}
