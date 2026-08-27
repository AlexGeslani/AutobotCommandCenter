export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'analytics', label: 'Analytics' },
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
      id: 'autobot-command-center', name: 'Autobot Command Center', kind: 'Product', state: 'Development', verified: '2026-08-16', source: 'ACC dev acceptance checks',
      value: 'A read-only answer plane for durable products, analytics, provider usage, benchmark evidence, and reusable skills.',
      outcome: 'Development now projects six durable destinations through one responsive dashboard without becoming a second operational control plane.',
      limitation: 'Portfolio and registry records remain curated projections until their canonical metadata adapters are connected.',
      worksNow: ['Responsive product projection', 'Provider-usage snapshots', 'Web analytics destination', 'Evidence-linked benchmark views'],
      evidence: ['Browser acceptance matrix', 'Application test suite', 'Public-safety scanner'], evaluations: [],
    },
    {
      id: 'jarvis', name: 'Jarvis Voice Agent', kind: 'Product', state: 'Development', verified: '2026-08-16', source: 'Development acceptance record',
      value: 'A thin push-to-talk assistant joining local speech, web research, and home-control capabilities behind explicit boundaries.',
      outcome: 'Development Web and Watch surfaces share the same bounded voice path while production remains frozen for acceptance.',
      limitation: 'Web Search, Home Assistant, and physical-device behavior must pass the development gate before production promotion.',
      worksNow: ['Development web client', 'Watch push-to-talk client', 'Local speech path', 'Bounded tool integration'],
      evidence: ['Development browser checks', 'Voice route acceptance records'], evaluations: ['eval-voice-latency'],
    },
    {
      id: 'voice-lab', name: 'Prime Voice Lab', kind: 'Product', state: 'Human gate', verified: '2026-07-26', source: 'Prime voice benchmark',
      value: 'Reusable intranet-first voice interaction core for tutors, agents, avatars, calls, and meetings.',
      outcome: 'Six configured voice routes are compared end-to-end; the fastest instant and cloned-voice paths are identified separately.',
      limitation: 'One experimental route produced a runaway timeout in the matched set; voice identity and quality remain subjective human gates.',
      worksNow: ['Six-route performance comparison', 'Non-speech rejection', 'Profile-driven output'],
      evidence: ['Voice performance snapshot · 2026-07-26', 'Prime acceptance suite', 'Audio sample set'], evaluations: ['eval-voice-runtime-comparison', 'eval-voice-latency'],
    },
    {
      id: 'web-analytics', name: 'Web Analytics Projection', kind: 'Capability', state: 'Development', verified: '2026-08-16', source: 'Cloudflare edge aggregate projection',
      value: 'One evidence-aware reporting destination for web properties without inventing missing geography or visitor semantics.',
      outcome: 'Two web properties now share daily, monthly, and yearly edge-aggregate views with explicit source coverage and provenance.',
      limitation: 'Aggregate analytics are not raw request logs; unavailable state-level dimensions remain unknown rather than inferred.',
      worksNow: ['Multi-property routing', 'Daily/monthly/yearly ranges', 'Coverage-aware world views', 'Explicit null gaps'],
      evidence: ['Projection schema tests', 'Compiler tests', 'Browser analytics routes'], evaluations: [],
    },
    {
      id: 'model-serving', name: 'Local AI Runtime', kind: 'Capability', state: 'Usable', availabilityAuthority: 'runtime', verified: '2026-08-16', source: 'Frozen benchmark artifacts',
      value: 'Private local inference for bounded agent, tool-use, and evaluation workloads.',
      outcome: 'A quantized serving condition has a defined runtime, context, output envelope, and immutable evidence identity.',
      limitation: 'Current availability is unknown while runtime telemetry is stale.',
      worksNow: ['OpenAI-compatible endpoint', 'Condition manifests', 'Bounded outputs'],
      evidence: ['Frozen run manifests', 'Service acceptance record'], evaluations: ['eval-model-condition'],
    },
    {
      id: 'benchmark-program', name: 'Model Evaluation Program', kind: 'Capability', state: 'Usable', verified: '2026-08-16', source: 'Frozen benchmark artifacts',
      value: 'Comparable condition-level evidence across tool use, reasoning, and offline-safe coding.',
      outcome: 'Release-scoped canonical results, exact condition fingerprints, and supporting run lineage are represented separately from runtime availability.',
      limitation: 'Cross-release rankings are intentionally prohibited.',
      worksNow: ['BFCL', 'GPQA Diamond', 'BigCodeBench-Hard'],
      evidence: ['Frozen manifests', 'Canonical result index'], evaluations: ['eval-model-condition'],
    },
  ],
  modelFamilies: [
    { id: 'qwen36', name: 'Qwen3.6 35B-A3B', publisher: 'Qwen', architecture: 'MoE', license: 'Known in source manifest', roles: ['Local agent', 'Evaluation candidate'] },
    { id: 'gpt56', name: 'GPT-5.6', publisher: 'OpenAI', architecture: 'Hosted', license: 'Provider terms', roles: ['Review lane'] },
    { id: 'devstral', name: 'Devstral Small 2 24B', publisher: 'Mistral AI', architecture: 'Dense', license: 'Known in source manifest', roles: ['Offline-safe coding candidate'] },
    { id: 'gpt56-luna', name: 'GPT-5.6 Luna', publisher: 'OpenAI', architecture: 'Hosted', license: 'Provider terms', roles: ['Cloud reference', 'Agent benchmark'] },
    { id: 'gpt56-sol', name: 'GPT-5.6 Sol', publisher: 'OpenAI', architecture: 'Hosted', license: 'Provider terms', roles: ['Cloud reference', 'Agent benchmark'] },
    { id: 'qwen38-2b', name: 'Qwen 3.8 2B Distill', publisher: 'Community', architecture: 'Dense', license: 'See source model card', roles: ['Local baseline', 'Instruction-following candidate'] },
    { id: 'qwen36-35b', name: 'Qwen3.6 35B-A3B', publisher: 'Qwen', architecture: 'MoE', license: 'Known in source manifest', roles: ['Local flagship', 'Agent candidate'] },
    { id: 'qwen36-27b', name: 'Qwen3.6 27B', publisher: 'Qwen', architecture: 'Dense', license: 'Known in source manifest', roles: ['Local reasoning', 'Agent candidate'] },
    { id: 'bonsai', name: 'Bonsai 8B', publisher: 'Community', architecture: 'Dense', license: 'Evaluation manifest pending', roles: ['Efficient local agent', 'Shadow candidate'] },
    { id: 'qwen35-4b', name: 'Qwen3.5 4B', publisher: 'Qwen', architecture: 'Dense', license: 'Known in source manifest', roles: ['Small local baseline', 'Edge candidate'] },
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
    {
      id: 'gpt56-luna-max', familyId: 'gpt56-luna', shortName: 'GPT-5.6 Luna · Max', provider: 'ChatGPT', runtime: 'Codex Luna bridge', quantization: 'Provider managed', reasoning: 'Max', host: 'Cloud',
      context: 'Provider envelope', output: 'Suite-defined', availability: 'unknown', availabilityNote: 'Availability is separate from benchmark evidence',
      fingerprint: 'gpt-5.6-luna|max|codex-luna-bridge|ootb-intake-v1', results: [],
    },
    {
      id: 'gpt56-sol-max', familyId: 'gpt56-sol', shortName: 'GPT-5.6 Sol · Max', provider: 'ChatGPT', runtime: 'Codex Sol bridge', quantization: 'Provider managed', reasoning: 'Max', host: 'Cloud',
      context: 'Provider envelope', output: 'Suite-defined', availability: 'unknown', availabilityNote: 'Benchmark collection is complete; runtime availability is not inferred',
      fingerprint: 'gpt-5.6-sol|max|codex-sol-bridge|ootb-intake-v1', results: [],
    },
    {
      id: 'qwen38-2b-mlx', familyId: 'qwen38-2b', shortName: 'Qwen 3.8 2B Distill · 4-bit MLX', provider: 'The Ark', runtime: 'MLX/Metal', quantization: 'Affine 4-bit · group 64', reasoning: 'Thinking off', host: 'The Ark Mac',
      context: '256K tested', output: '8K cap', availability: 'unknown', availabilityNote: 'Benchmark evidence does not establish current runtime availability',
      fingerprint: 'ark-qwen38-2b-distill|mlx-metal|affine-4bit-g64|thinking-off|ctx256k|out8k|ootb-intake-v1', results: [],
    },
    {
      id: 'qwen36-35b-a3b', familyId: 'qwen36-35b', shortName: 'Qwen3.6 35B-A3B · Q6', provider: 'GPU Node B', runtime: 'llama.cpp', quantization: 'Q6', reasoning: 'Direct', host: 'GPU Node B',
      context: 'Example envelope', output: 'Example envelope', availability: 'unknown', availabilityNote: 'Illustrative Dev fixture', fingerprint: 'example|qwen3.6-35b-a3b|q6|llamacpp|direct', results: [],
    },
    {
      id: 'qwen36-27b', familyId: 'qwen36-27b', shortName: 'Qwen3.6 27B · Q6', provider: 'GPU Node B', runtime: 'llama.cpp', quantization: 'Q6', reasoning: 'Direct', host: 'GPU Node B',
      context: 'Example envelope', output: 'Example envelope', availability: 'unknown', availabilityNote: 'Illustrative Dev fixture', fingerprint: 'example|qwen3.6-27b|q6|llamacpp|direct', results: [],
    },
    {
      id: 'bonsai-8b', familyId: 'bonsai', shortName: 'Bonsai 8B · Q8', provider: 'Edge Node A', runtime: 'llama.cpp', quantization: 'Q8', reasoning: 'Direct', host: 'Edge Node A',
      context: 'Example envelope', output: 'Example envelope', availability: 'unknown', availabilityNote: 'Illustrative Dev fixture', fingerprint: 'example|bonsai-8b|q8|llamacpp|direct', results: [],
    },
    {
      id: 'qwen35-4b', familyId: 'qwen35-4b', shortName: 'Qwen3.5 4B · Q8', provider: 'Edge Node A', runtime: 'llama.cpp', quantization: 'Q8', reasoning: 'Direct', host: 'Edge Node A',
      context: 'Example envelope', output: 'Example envelope', availability: 'unknown', availabilityNote: 'Illustrative Dev fixture', fingerprint: 'example|qwen3.5-4b|q8|llamacpp|direct', results: [],
    },
  ],
  benchmarkComparison: [
    {
      conditionId: 'gpt56-luna-max', evidence: 'measured', note: 'All three frozen suites passed final verification. tau2 uses the versioned acc-tau2-fixed-judge-v1.1 profile (effective GPT-5.5 Low); future comparisons must use that same judge profile.',
      operational: {
        evidence: 'verified-aggregate',
        candidateUsage: { inputTokens: 18549208, outputTokens: 1603165, totalTokens: 20152373, cachedInputTokens: null, reasoningTokens: null, retainedBridgeEvents: 4304 },
        performance: {
          class: 'frontier-route', successfulResponses: 4290, bridgeErrorEvents: 14,
          latencySeconds: { minimum: 1.1463, median: 6.3779, mean: 8.8543, p95: 21.8786, maximum: 296.4456, total: 37984.9964 },
          endToEndOutputTokensPerSecond: 42.2052,
          measurementBoundary: 'Client bridge end-to-end wall time on the ChatGPT/Codex subscription route',
          variability: 'Route-window evidence, not intrinsic model speed; network path, provider queueing, service demand, and bridge overhead remain variables.',
        },
        judgeUsage: { role: 'Fixed tau2 judge', totalTokens: 19655 },
        billing: {
          route: 'ChatGPT/Codex subscription', marginalApiChargeUsd: 0, monthlySubscriptionUsd: 200,
          candidateApiEquivalentUsd: 5.63, judgeApiEquivalentUsd: 0.12,
          subscriptionAttribution: 'Flat existing plan · not allocated per benchmark request',
        },
        pricing: {
          source: 'OpenAI standard model pricing reviewed 2026-08-26',
          candidateRates: '$0.20/M input · $1.20/M output', judgeRates: '$5/M input · $30/M output',
          assumption: 'All retained input priced as uncached', longContextRequests: 0,
        },
        outcomes: [
          ['IFEval strict misses', '7 / 40 prompts · 8 / 95 instructions'],
          ['BFCL custody', '150 scored cases · category-level grader evidence retained'],
          ['BFCL bridge non-OK events', '9 · retained under the frozen scoring rules'],
          ['tau2 unsuccessful', '26 / 50 tasks · includes 5 provider transport failures'],
        ],
      },
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 82.5, evidence: 'verified', denominator: '33 / 40 strict prompts', detail: [['Instruction checks', '87 / 95 · 91.6%'], ['Mean request', '35.1s'], ['Completion tokens', '74,587']] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 45.89, evidence: 'verified', denominator: '150 frozen scored cases', detail: [['Non-live AST', '86.7%'], ['Live', '37.5%'], ['Multi-turn tools', '56.3%'], ['Memory', '63.0%'], ['Latency mean / p95', '6.37s / 14.48s']] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: 48.0, evidence: 'verified', denominator: '24 / 50 frozen tasks', detail: [['Retail', '12 / 25 · 48.0%'], ['Telecom', '12 / 25 · 48.0%'], ['Provider transport failures', '5 · retained as scored zeros'], ['Harness errors', '0'], ['Fixed judge profile', 'acc-tau2-fixed-judge-v1.1 · GPT-5.5 Low']] },
      },
    },
    {
      conditionId: 'gpt56-sol-max', evidence: 'measured', note: 'All three frozen suites passed final verification: IFEval 90.00%, BFCL 48.55%, and tau2 70.00%. The secondary 69.52% equal-weight macro is the unweighted mean of those three primary suite scores. tau2 used acc-tau2-fixed-judge-v1.1 and retained two post-dispatch provider transport failures plus six completed empty model responses as denominator-preserving zeros; harness errors are zero.',
      operational: {
        evidence: 'verified-aggregate',
        candidateUsage: { inputTokens: 22636604, outputTokens: 1851898, totalTokens: 24488502, cachedInputTokens: null, reasoningTokens: null, retainedBridgeEvents: 4657 },
        performance: {
          class: 'frontier-route', successfulResponses: 4586, bridgeErrorEvents: 71,
          latencySeconds: { minimum: 1.4928, median: 8.7603, mean: 13.3428, p95: 35.5755, maximum: 435.3947, total: 61189.9788 },
          endToEndOutputTokensPerSecond: 30.2647,
          measurementBoundary: 'Client bridge end-to-end wall time on the ChatGPT/Codex subscription route',
          variability: 'Route-window evidence, not intrinsic model speed; network path, provider queueing, service demand, and bridge overhead remain variables.',
        },
        judgeUsage: { role: 'Fixed tau2 judge', totalTokens: 40330 },
        billing: {
          route: 'ChatGPT/Codex subscription', marginalApiChargeUsd: 0, monthlySubscriptionUsd: 200,
          candidateApiEquivalentUsd: 127.58, judgeApiEquivalentUsd: 0.23,
          subscriptionAttribution: 'Flat existing plan · not allocated per benchmark request',
        },
        pricing: {
          source: 'OpenAI standard model pricing reviewed 2026-08-26',
          candidateRates: '$4/M input · $20/M output', judgeRates: '$5/M input · $30/M output',
          assumption: 'All retained input priced as uncached', longContextRequests: 0,
        },
        outcomes: [
          ['IFEval strict misses', '4 / 40 prompts · 4 / 95 instructions'],
          ['Pre-dispatch control stops', '65 · 61 recovered/accounted denials plus 4 later safe halts · not provider failures'],
          ['BFCL operational failures', '4 provider transport-error rows retained as scored zeros'],
          ['tau2 unsuccessful', '15 / 50 tasks · includes 2 transport failures and 6 empty responses'],
        ],
      },
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 90.0, evidence: 'verified', denominator: '36 / 40 strict prompts', detail: [['Instruction checks', '91 / 95 · 95.8%'], ['Mean request', '37.6s'], ['Completion tokens', '55,171'], ['Final verification', 'Passed · exact response model']] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 48.55, evidence: 'verified', denominator: '150 / 150 scored rows', detail: [['Generated traces', '261 / 261'], ['Provider transport-error rows', '4 · retained'], ['Recovered denial rows', '61 · exact replay'], ['Final verification', 'Passed']] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: 70.0, evidence: 'verified', denominator: '35 / 50 frozen tasks', detail: [['Retail', '22 / 25 · 88.0%'], ['Telecom', '13 / 25 · 52.0%'], ['Provider transport failures', '2 · retained as scored zeros'], ['Empty model responses', '6 · retained as scored zeros'], ['Harness errors', '0'], ['Fixed judge profile', 'acc-tau2-fixed-judge-v1.1 · GPT-5.5 Low'], ['Final verification', 'Passed']] },
      },
    },
    {
      conditionId: 'qwen38-2b-mlx', evidence: 'measured', note: 'IFEval is final-verified across two exact matched runs: both scored 9 / 40 strict prompts and 47 / 95 instructions, with 40 / 40 response texts matching exactly. BFCL and tau2 were not run, so their primary scores remain Pending rather than zero. The local performance figures describe the exact 4-bit MLX/Metal condition; non-streaming wall time includes transport, prompt evaluation, and generation.',
      operational: {
        evidence: 'verified-repeat',
        candidateUsage: { inputTokens: 2596, outputTokens: 123437, totalTokens: 126033, cachedInputTokens: 0, reasoningTokens: null, retainedBridgeEvents: 40, basis: 'Latest matched repeat · 40 requests' },
        performance: {
          class: 'local-runtime', successfulResponses: 40, bridgeErrorEvents: 0,
          latencySeconds: { minimum: 0.9922, median: 6.2165, mean: 51.2856, p95: 136.3943, maximum: 144.2473, total: 2051.4235 },
          endToEndOutputTokensPerSecond: 60.1714,
          measurementBoundary: 'Client end-to-end non-streaming request wall time',
          variability: 'Matched repeat mean was 51.75s versus 51.29s; all 40 response texts and usage records matched exactly. TTFT, pure decoder throughput, peak RSS, Metal memory, and thermal/power state were not captured.',
        },
        localRuntime: {
          host: 'The Ark Mac', backend: 'MLX/Metal', modelRevision: 'SiddhJagani/Qwen3.8-2B-mlx-4Bit · pinned revision',
          quantization: 'Affine 4-bit · group size 64', context: '262,144 tokens', outputCap: '8,192 tokens', slots: 1, concurrency: 1, retries: 0, thinking: 'Off', streaming: 'No',
        },
        outcomes: [
          ['IFEval repeated result', '9 / 40 prompts · 47 / 95 instructions · identical across two runs'],
          ['Repeat consistency', '40 / 40 exact response-text matches · 40 / 40 exact usage matches'],
          ['Coverage boundary', 'BFCL and tau2 not run · scores withheld as Pending'],
        ],
        methodNote: 'Local performance is specific to this host, runtime, quantization, context/output envelope, serial slot, and warm-state collection. Pure generation speed and resource peaks were unavailable in the retained evidence.',
      },
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 22.5, evidence: 'verified', denominator: '9 / 40 strict prompts', detail: [['Instruction checks', '47 / 95 · 49.5%'], ['Matched repeats', '2 · identical scores'], ['Exact response matches', '40 / 40'], ['Repeat mean / p95', '51.29s / 136.39s'], ['Completion tokens', '123,437'], ['Final verification', 'Passed · both runs']] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: null, evidence: 'pending', denominator: 'Not run · score withheld', detail: [['Admission observation', 'Native tool call not emitted'], ['Scoring state', 'Pending full frozen inventory']] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: null, evidence: 'pending', denominator: 'Not run · score withheld', detail: [['Scoring state', 'Pending full frozen inventory']] },
      },
    },
    {
      conditionId: 'qwen36-35b-a3b', evidence: 'illustrative', note: 'Illustrative values only — used to test comparison density and drill-down behavior before this condition is benchmarked.',
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 77.4, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 51.2, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: 43.8, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
      },
    },
    {
      conditionId: 'qwen36-27b', evidence: 'illustrative', note: 'Illustrative values only — used to test comparison density and drill-down behavior before this condition is benchmarked.',
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 74.1, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 47.6, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: 46.5, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
      },
    },
    {
      conditionId: 'bonsai-8b', evidence: 'illustrative', note: 'Illustrative values only — used to test comparison density and drill-down behavior before this condition is benchmarked.',
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 68.3, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 35.7, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: 38.9, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
      },
    },
    {
      conditionId: 'qwen35-4b', evidence: 'illustrative', note: 'Illustrative values only — used to test comparison density and drill-down behavior before this condition is benchmarked.',
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 61.8, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 28.4, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: 31.6, evidence: 'illustrative', denominator: 'Example metric', detail: [] },
      },
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
      affectedObjects: [{ type: 'product', id: 'voice-lab', label: 'Prime Voice Lab' }],
    },
    {
      id: 'eval-voice-latency', title: 'Voice interaction latency envelope', stage: 'Running', findingStatus: 'provisional', decision: 'No decision', progress: 68,
      question: 'Can the local voice core sustain conversational turn latency without accepting non-speech?',
      finding: 'Non-speech rejection is stable; interruption and tail latency remain under evaluation.',
      affectedObjects: [{ type: 'product', id: 'voice-lab', label: 'Prime Voice Lab' }],
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
    { id: 'autobots', name: '/autobots', category: 'Agent orchestration', purpose: 'Runs bounded specialist coding lanes with explicit pause, resume, review, and delivery contracts.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'Claude CLI + Codex CLI; isolated transport', repo: 'Local SKILL.md metadata snapshot' },
    { id: 'dashboard-product-design', name: 'operational-dashboard-product-design', category: 'Product design', purpose: 'Designs evidence-backed command centers that answer durable questions without duplicating operational systems.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'Dashboard IA, source authority, desktop/mobile acceptance', repo: 'Local SKILL.md metadata snapshot' },
    { id: 'local-model-evaluation', name: 'local-model-evaluation', category: 'Model evaluation', purpose: 'Builds frozen, executable comparisons across local and hosted inference conditions.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'Local/cloud OpenAI-compatible runtimes; evidence-first', repo: 'Local SKILL.md metadata snapshot' },
    { id: 'portable-safety-harnesses', name: 'portable-integration-safety-harnesses', category: 'Integration safety', purpose: 'Creates secret-safe integration checks that travel across environments without carrying private infrastructure assumptions.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'Portable fixtures, fail-closed checks, redacted evidence', repo: 'Local SKILL.md metadata snapshot' },
    { id: 'intranet-recovery', name: 'intranet-app-versioning-recovery', category: 'Reliability', purpose: 'Versions, backs up, restore-tests, and safely publishes private application baselines.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'Private intranet applications; reversible releases', repo: 'Local SKILL.md metadata snapshot' },
    { id: 'container-hosting', name: 'macos-container-hosting-operations', category: 'Platform operations', purpose: 'Operates LAN-only container hosting with validated routing, bind-mount safety, and independent-client acceptance.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'macOS container hosts; shared Caddy ingress', repo: 'Local SKILL.md metadata snapshot' },
    { id: 'event-film', name: 'mixed-media-event-film-production', category: 'Media production', purpose: 'Assembles mixed-source footage into a scene-tagged event film with selective restoration and conservative finishing.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'Mixed photo/video/audio; reviewable editorial stages', repo: 'Local SKILL.md metadata snapshot' },
    { id: 'repository-docs', name: 'repository-documentation-operations', category: 'Documentation', purpose: 'Keeps a repository README aligned with the actual default-branch product and operating state.', provenance: 'authored here', stewardship: 'owned and maintained here', publication: 'internal', validation: 'validated', lastValidated: '2026-08-16', envelope: 'Repository-backed products; evidence-based documentation', repo: 'Local SKILL.md metadata snapshot' },
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

export function getBenchmarkComparison(conditionId = null) {
  const profiles = fixtures.benchmarkComparison.map((profile) => ({ ...profile, condition: getCondition(profile.conditionId) }));
  return conditionId ? profiles.find((profile) => profile.conditionId === conditionId) || null : profiles;
}

export function getMeasuredBenchmarkVisuals() {
  const suiteOrder = ['instruction', 'tools', 'agent'];
  const measured = getBenchmarkComparison().filter((profile) => profile.evidence === 'measured');
  return {
    profiles: measured.map((profile) => ({
      conditionId: profile.conditionId,
      shortName: profile.condition.shortName,
      provider: profile.condition.provider,
      runtime: profile.condition.runtime,
      coverage: Object.fromEntries(suiteOrder.map((suiteId) => [suiteId, profile.scores[suiteId].evidence])),
    })),
    suites: suiteOrder.map((suiteId) => ({
      id: suiteId,
      label: measured[0].scores[suiteId].benchmark,
      rows: measured
        .map((profile) => ({
          conditionId: profile.conditionId,
          shortName: profile.condition.shortName,
          value: profile.scores[suiteId].value,
          denominator: profile.scores[suiteId].denominator,
          evidence: profile.scores[suiteId].evidence,
        }))
        .filter((row) => row.value != null && row.evidence === 'verified')
        .sort((a, b) => b.value - a.value),
    })),
  };
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
  const representedRows = rows.filter((row) => row.coverage > 0);
  const byIndex = (a, b) => (b.index ?? -1) - (a.index ?? -1);
  return {
    domains: domainState.map(({ resultByCondition, ...domain }) => domain),
    complete: representedRows.filter((row) => row.complete).sort(byIndex),
    partial: representedRows.filter((row) => !row.complete).sort(byIndex),
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

export function getOverviewProjection() {
  return {
    sectionOrder: ['provider-usage', 'source-exceptions', 'destinations', 'recently-landed'],
    sourceExceptions: getSourceTrust().filter((source) => source.invalidatesClaims),
    destinations: [
      { id: 'portfolio', label: 'Portfolio', summary: 'Products and durable capabilities' },
      { id: 'analytics', label: 'Analytics', summary: 'Traffic, service usage, and coverage' },
      { id: 'benchmarks', label: 'Benchmarks', summary: 'Measured model evidence' },
      { id: 'skills', label: 'Skills', summary: 'Reusable delivery knowledge' },
    ],
  };
}

export function buildAccUrl(state = {}, basePath = '/autobot-command-center') {
  const params = new URLSearchParams();
  for (const key of ['view', 'domain', 'subject', 'range', 'mode', 'product', 'condition', 'result', 'release', 'run', 'skill', 'evaluation']) {
    if (state[key]) params.set(key, state[key]);
  }
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}`;
}

export function parseAccUrl(input) {
  const url = new URL(input, 'http://localhost');
  const state = {};
  for (const key of ['view', 'domain', 'subject', 'range', 'mode', 'product', 'condition', 'result', 'release', 'run', 'skill', 'evaluation']) {
    const value = url.searchParams.get(key);
    if (value) state[key] = value;
  }
  if (!state.view) state.view = 'overview';
  return state;
}

export function canonicalizeAccRoute(route = {}) {
  if (route.view === 'usage') return { view: 'analytics', domain: 'ai', subject: 'provider-usage' };
  return { ...route };
}
