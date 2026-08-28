import showcaseProjectionSnapshot from './generated/showcase-projection.v1.json' with { type: 'json' };
import { getPortfolioProjection, getSkillsProjection, validateShowcaseProjection } from './showcase/projection.mjs';

const showcaseProjection = validateShowcaseProjection(showcaseProjectionSnapshot);

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'skills', label: 'Skill Registry' },
  { id: 'search', label: 'Search' },
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
    { id: 'qwen38-27b', name: 'Qwen 3.8 27B RVN Heretic', publisher: 'Community', architecture: 'Dense', license: 'Apache-2.0', roles: ['Local agent candidate', 'Current measured condition'] },
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
      id: 'qwen38-2b-mlx', familyId: 'qwen38-2b', shortName: 'Qwen 3.8 2B Distill · 4-bit MLX', provider: 'Edge Node A', runtime: 'MLX/Metal', quantization: 'Affine 4-bit · group 64', reasoning: 'Thinking off', host: 'Edge Node A',
      context: '256K tested', output: '8K cap', availability: 'unknown', availabilityNote: 'Benchmark evidence does not establish current runtime availability',
      fingerprint: 'edge-node-a|qwen38-2b-distill|mlx-metal|affine-4bit-g64|thinking-off|ctx256k|out8k|ootb-intake-v1', results: [],
    },
    {
      id: 'qwen36-35b-heretic-gpu-b', familyId: 'qwen36-35b', shortName: 'Qwen3.6 35B Heretic · Q4_K_M · MTP-N2', provider: 'GPU Node B', runtime: 'llama.cpp b9172', quantization: 'Q4_K_M Heretic', reasoning: 'Thinking on', host: 'GPU Node B',
      context: '256K total · 128K per slot', output: '32K cap', availability: 'unknown', availabilityNote: 'Benchmark evidence is immutable; current runtime availability is tracked separately',
      fingerprint: 'qwen3.6-35b-a3b-heretic|q4-k-m|mtp-n2|llamacpp-b9172|thinking-on|ctx262144|2slots|out32768|gpu-node-b|ootb-intake-v1', results: [],
    },
    {
      id: 'qwen38-27b-rvn-heretic-gpu-b', familyId: 'qwen38-27b', shortName: 'Qwen3.8 27B RVN Heretic · Q4_K_M · MTP-N1', provider: 'GPU Node B', runtime: 'llama.cpp b10448', quantization: 'Q4_K_M Heretic', reasoning: 'Thinking on · medium', host: 'GPU Node B',
      context: '128K · 1 slot', output: '32K cap', availability: 'unknown', availabilityNote: 'Active benchmark evidence does not establish general runtime availability',
      fingerprint: 'qwen3.8-27b-rvn-heretic|q4-k-m|mtp-n1|llamacpp-b10448|thinking-on-medium|ctx131072|1slot|out32768|gpu-node-b|ootb-intake-v1', results: [],
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
      conditionId: 'qwen38-2b-mlx', evidence: 'measured', note: 'IFEval and BFCL are final-verified for the exact 4-bit MLX/Metal condition. IFEval repeated exactly at 9 / 40 strict prompts and 47 / 95 instructions; BFCL scored 8.72% across the frozen 150-case selection after all 261 required rows were generated. tau2 Retail is complete at 25 / 25 and Telecom is active at 6 / 25 in the captured progress snapshot, so the tau2 primary score stays Pending rather than zero.',
      operational: {
        evidence: 'verified-partial',
        candidateUsage: { inputTokens: 9839500, outputTokens: 1130727, totalTokens: 10970227, cachedInputTokens: 2135136, reasoningTokens: null, retainedBridgeEvents: 1648, basis: 'Final-verified IFEval matched repeat plus final-verified BFCL · incomplete tau2 usage excluded' },
        performance: {
          class: 'local-runtime', successfulResponses: 1608, bridgeErrorEvents: 0,
          latencySeconds: { minimum: 1.2452, median: 11.6742, mean: 21.2696, p95: 78.2772, maximum: 367.2935, total: 34201.4525 },
          endToEndOutputTokensPerSecond: 29.4517,
          measurementBoundary: 'BFCL bridge end-to-end non-streaming request wall time across all retained prerequisite and scored requests',
          variability: 'The displayed runtime distribution is BFCL-specific and includes transport, prompt evaluation, and generation. IFEval repeat performance remains in the instruction-score detail. TTFT, pure decoder throughput, peak RSS, Metal memory, and thermal/power state were not captured.',
        },
        localRuntime: {
          hardwareProfile: 'edge-node-a-mac-mini-m2-24gb-20260826', capturedAt: '2026-08-26', machine: 'Mac mini', processor: 'Apple M2 · 8-core CPU', memory: '24 GB unified memory', accelerator: 'Apple M2 · 10-core GPU · Metal', os: 'macOS 26.5.2',
          host: 'Edge Node A', backend: 'MLX/Metal', modelRevision: 'SiddhJagani/Qwen3.8-2B-mlx-4Bit · pinned revision',
          quantization: 'Affine 4-bit · group size 64', context: '262,144 tokens', outputCap: '8,192 tokens', slots: 1, concurrency: 1, retries: 0, thinking: 'Off', streaming: 'No',
          competingWorkload: 'One benchmark slot; broader host workload telemetry unavailable',
        },
        outcomes: [
          ['IFEval repeated result', '9 / 40 prompts · 47 / 95 instructions · identical across two runs'],
          ['Repeat consistency', '40 / 40 exact response-text matches · 40 / 40 exact usage matches'],
          ['BFCL final result', '8.72% · 261 / 261 generated · 150 / 150 scored · final verification passed'],
          ['BFCL custody', '1,608 / 1,608 bridge requests succeeded · 0 transport errors · 0 retries'],
          ['tau2 progress snapshot', '31 / 50 frozen tasks completed · Retail 25 / 25 · Telecom 6 / 25 active · score withheld as Pending'],
        ],
        methodNote: 'Local performance is specific to this host, runtime, quantization, context/output envelope, serial slot, and warm-state collection. Candidate usage includes only final-verified IFEval and BFCL evidence; incomplete tau2 usage is excluded. Pure generation speed and resource peaks were unavailable in the retained evidence.',
      },
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 22.5, evidence: 'verified', denominator: '9 / 40 strict prompts', detail: [['Instruction checks', '47 / 95 · 49.5%'], ['Matched repeats', '2 · identical scores'], ['Exact response matches', '40 / 40'], ['Repeat mean / p95', '51.29s / 136.39s'], ['Completion tokens', '123,437'], ['Final verification', 'Passed · both runs']] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 8.72, evidence: 'verified', denominator: '150 / 150 frozen scored cases', detail: [['Generated traces', '261 / 261'], ['Non-live AST', '39.17%'], ['Live', '0.00%'], ['Multi-turn tools', '1.25%'], ['Memory', '7.14%'], ['Bridge requests', '1,608 / 1,608 succeeded · 0 transport errors · 0 retries'], ['Latency median / mean / p95', '11.67s / 21.27s / 78.28s'], ['Final verification', 'Passed']] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: null, evidence: 'pending', denominator: '31 / 50 live · score withheld', progress: { current: 31, total: 50, label: '31 / 50 frozen tasks · Retail 25 / 25 · Telecom 6 / 25', state: 'in-progress', capturedAt: '2026-08-28T02:33:10Z' }, detail: [['Frozen inventory', '25 Retail + 25 Telecom'], ['Completed simulations', 'Retail 25 / 25 · Telecom 6 / 25 · 31 / 50 total'], ['Harness errors', '0 observed in current progress artifact'], ['Current workload', 'Telecom active'], ['Scoring state', 'Pending full frozen inventory and final verification']] },
      },
    },
    {
      conditionId: 'qwen36-35b-heretic-gpu-b', evidence: 'measured', note: 'All three suites are final-verified for the exact GPU Node B Qwen3.6 35B Heretic Q4_K_M MTP-N2 condition. IFEval scored 77.50%, BFCL scored 51.76% across the exact frozen 150-case selection after all 261 required rows were generated, and tau2 scored 66.00% across all 50 frozen tasks. The BFCL evaluator used subset mode to score the exact frozen selection; final verification confirmed complete ID equality, exact denominators, and zero duplicates. Hardware identity beyond the retained public-safe host label and runtime/deployment geometry was not captured and is shown as unavailable rather than inferred.',
      operational: {
        evidence: 'verified-aggregate',
        candidateUsage: { inputTokens: 36561557, outputTokens: 5484306, totalTokens: 42045863, cachedInputTokens: null, reasoningTokens: null, retainedBridgeEvents: 3800, basis: 'All three final-verified suites · IFEval + BFCL + tau2' },
        judgeUsage: { inputTokens: 27087, outputTokens: 680, totalTokens: 27767, requests: 6, successes: 6, basis: 'tau2 fixed-judge events only' },
        performance: {
          class: 'local-runtime', successfulResponses: 2633, bridgeErrorEvents: 25,
          latencySeconds: { minimum: 0.0966, median: 3.8922, mean: 25.1470, p95: 36.1704, maximum: 528.2671, total: 66840.7149 },
          endToEndOutputTokensPerSecond: 69.7602,
          measurementBoundary: 'BFCL single-flight bridge end-to-end non-streaming request wall time',
          variability: 'The displayed runtime distribution is BFCL-specific and includes transport, prompt evaluation, and generation. IFEval and tau2 retain their own latency/throughput evidence in the suite details. A cross-suite median or p95 is not synthesized. TTFT, pure decoder throughput, peak RSS, accelerator memory, thermal state, and competing-host workload were not retained.',
        },
        localRuntime: {
          hardwareProfile: 'gpu-node-b-hardware-unresolved-20260826', capturedAt: '2026-08-26', machine: 'Not captured in retained run evidence', processor: 'Not captured', memory: 'Not captured', accelerator: 'Not captured', os: 'Not captured',
          host: 'GPU Node B', backend: 'llama.cpp b9172 lineage', modelRevision: 'Qwen3.6-35B-A3B-Heretic-Q4_K_M-MTP-N2', quantization: 'Q4_K_M Heretic · MTP-N2',
          context: '262,144 total · 131,072 per slot', outputCap: '32,768 tokens', slots: 2, concurrency: 1, retries: 0, thinking: 'On', streaming: 'No', competingWorkload: 'Requests serialized; broader host workload telemetry unavailable',
        },
        outcomes: [
          ['IFEval final result', '77.50% · 31 / 40 prompts · 86 / 95 instructions · final verification passed'],
          ['IFEval performance', '40 / 40 requests succeeded · median 38.25s · mean 45.71s · p95 109.71s · 86.15 output tok/s'],
          ['BFCL final result', '51.76% · 261 / 261 generated · 150 / 150 scored · final verification passed'],
          ['BFCL custody', '2,633 / 2,658 bridge requests succeeded · 25 prerequisite provider failures · 0 scored-case provider failures'],
          ['BFCL performance', 'Median 3.89s · mean 25.15s · p95 36.17s · 69.76 output tok/s'],
          ['tau2 final result', '66.00% · 33 / 50 tasks · Retail 10 / 25 · Telecom 23 / 25 · final verification passed'],
          ['tau2 custody', '1,102 / 1,102 candidate requests succeeded · 10 empty responses retained as scored zeros · 0 harness errors'],
          ['tau2 performance', 'Median 2.77s · mean 7.65s · p95 18.97s · 78.77 output tok/s'],
          ['Fixed judge custody', '6 / 6 requests succeeded · 27,767 tokens · fixed profile retained'],
          ['Hardware boundary', 'Processor, RAM, accelerator, and OS were not captured in retained run evidence'],
        ],
        methodNote: 'Candidate usage aggregates all three final-verified suites. The displayed runtime distribution remains BFCL-specific; IFEval and tau2 performance is reported in their suite details and outcomes. No cross-suite latency quantiles are synthesized. Pure generation speed and resource peaks were unavailable in retained evidence.',
      },
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 77.5, evidence: 'verified', denominator: '31 / 40 strict prompts', detail: [['Instruction checks', '86 / 95 · 90.5%'], ['Median / mean request', '38.25s / 45.71s'], ['Request p95', '109.71s'], ['Completion tokens', '157,506'], ['End-to-end output throughput', '86.15 tok/s'], ['Final verification', 'Passed · exact model and runtime lineage']] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: 51.76, evidence: 'verified', denominator: '150 / 150 frozen scored cases', detail: [['Generated traces', '261 / 261'], ['Frozen scored IDs', '150 / 150 exact · zero duplicates'], ['Non-live AST', '89.44%'], ['Live', '87.50%'], ['Multi-turn tools', '69.58%'], ['Memory', '45.97%'], ['Bridge requests', '2,633 / 2,658 succeeded · 25 prerequisite provider failures · 0 scored-case provider failures'], ['Latency median / mean / p95', '3.89s / 25.15s / 36.17s'], ['End-to-end output throughput', '69.76 tok/s'], ['Final verification', 'Passed']] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: 66.0, evidence: 'verified', denominator: '33 / 50 frozen tasks', detail: [['Retail', '10 / 25 · 40.0%'], ['Telecom', '23 / 25 · 92.0%'], ['Empty model responses', '10 · retained as scored zeros'], ['Provider transport failures', '0'], ['Harness errors', '0'], ['Candidate requests', '1,102 / 1,102 succeeded'], ['Latency median / mean / p95', '2.77s / 7.65s / 18.97s'], ['End-to-end output throughput', '78.77 tok/s'], ['Fixed judge', '6 / 6 requests · 27,767 tokens · fixed profile'], ['Final verification', 'Passed · exact 50-task frozen inventory']] },
      },
    },
    {
      conditionId: 'qwen38-27b-rvn-heretic-gpu-b', evidence: 'measured', note: 'IFEval is final-verified at 32 / 40 strict prompts and 86 / 95 instructions for the exact Qwen3.8 27B RVN Heretic Q4_K_M MTP-N1 medium-thinking condition. BFCL is actively collecting its frozen 261 required generated rows, with 1 row persisted at this snapshot. tau2 is queued behind BFCL. Pending lanes remain score-withheld rather than zero.',
      operational: {
        evidence: 'verified-partial',
        candidateUsage: { inputTokens: 2596, outputTokens: 77738, totalTokens: 80334, cachedInputTokens: 0, reasoningTokens: null, retainedBridgeEvents: 40, basis: 'Final-verified IFEval only · active BFCL and queued tau2 excluded' },
        performance: {
          class: 'local-runtime', successfulResponses: 40, bridgeErrorEvents: 0,
          latencySeconds: { minimum: 9.7965, median: 68.1601, mean: 102.1141, p95: 209.9175, maximum: 933.1993, total: 4084.5648 },
          endToEndOutputTokensPerSecond: 19.0321,
          measurementBoundary: 'IFEval single-flight bridge end-to-end non-streaming wall time',
          variability: 'IFEval-specific route evidence including transport, prompt evaluation, and generation. BFCL and tau2 performance are not projected before their own final verification. TTFT, pure decoder throughput, resource peaks, and thermal/power state were not captured.',
        },
        localRuntime: {
          hardwareProfile: 'gpu-node-b-hardware-unresolved-20260827', capturedAt: '2026-08-27', machine: 'Not captured in retained run evidence', processor: 'Not captured', memory: 'Not captured', accelerator: 'Not captured', os: 'Not captured',
          host: 'GPU Node B', backend: 'llama.cpp b10448 lineage', modelRevision: 'Qwen3.8-27B-RVN-Q4_K_M-MTP-N1-128K', quantization: 'Q4_K_M Heretic · MTP-N1',
          context: '131,072 tokens · one slot', outputCap: '32,768 tokens', slots: 1, concurrency: 1, retries: 0, thinking: 'On · medium', streaming: 'No', competingWorkload: 'Requests serialized; broader host workload telemetry unavailable',
        },
        outcomes: [
          ['IFEval final result', '80.00% · 32 / 40 prompts · 86 / 95 instructions · final verification passed'],
          ['IFEval custody', '40 / 40 requests succeeded · 0 provider or measurement-path failures'],
          ['IFEval performance', 'Median 68.16s · mean 102.11s · p95 209.92s · 19.03 end-to-end output tok/s'],
          ['BFCL progress snapshot', '1 / 261 required generated rows persisted · collection active · score withheld'],
          ['tau2 state', 'Queued behind BFCL · 0 / 50 · score withheld'],
          ['Hardware boundary', 'Processor, RAM, accelerator, and OS were not captured in retained run evidence'],
        ],
        methodNote: 'Candidate usage and performance include only final-verified IFEval evidence. BFCL collection completion is operational progress, not a capability estimate. Pending suites are excluded from the current average until their own final verification passes.',
      },
      scores: {
        instruction: { label: 'Instruction following', benchmark: 'IFEval', value: 80.0, evidence: 'verified', denominator: '32 / 40 strict prompts', detail: [['Instruction checks', '86 / 95 · 90.5%'], ['Median / mean request', '68.16s / 102.11s'], ['Request p95', '209.92s'], ['Completion tokens', '77,738'], ['End-to-end output throughput', '19.03 tok/s'], ['Final verification', 'Passed · exact model and runtime lineage']] },
        tools: { label: 'Native tool use', benchmark: 'BFCL V4', value: null, evidence: 'pending', denominator: '1 / 261 generated · score withheld', progress: { current: 1, total: 261, label: '1 / 261 required generated rows · collection active', state: 'in-progress', capturedAt: '2026-08-28T02:51:29Z' }, detail: [['Frozen inventory', '261 required generated rows · 150 scored cases'], ['Completed generated rows', '1 / 261 persisted'], ['Current workload', 'BFCL collection active'], ['Scoring state', 'Pending complete generation, evaluation, and final verification']] },
        agent: { label: 'Multi-turn agent', benchmark: 'tau2', value: null, evidence: 'pending', denominator: '0 / 50 queued · score withheld', progress: { current: 0, total: 50, label: '0 / 50 frozen tasks · queued behind BFCL', state: 'queued', capturedAt: '2026-08-28T02:46:25Z' }, detail: [['Frozen inventory', '25 Retail + 25 Telecom'], ['Completed simulations', '0 / 50'], ['Current workload', 'Queued behind BFCL'], ['Scoring state', 'Pending collection and final verification']] },
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
  skills: showcaseProjection.operationalSkills,
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
  const profiles = fixtures.benchmarkComparison.map((profile) => {
    const verifiedScores = Object.values(profile.scores).filter((score) => score.evidence === 'verified' && score.value != null);
    const currentAverage = verifiedScores.length
      ? Number((verifiedScores.reduce((sum, score) => sum + score.value, 0) / verifiedScores.length).toFixed(2))
      : null;
    return {
      ...profile,
      condition: getCondition(profile.conditionId),
      currentAverage: {
        value: currentAverage,
        verifiedSuites: verifiedScores.length,
        totalSuites: Object.keys(profile.scores).length,
        complete: verifiedScores.length === Object.keys(profile.scores).length,
      },
    };
  });
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
      coverage: Object.fromEntries(suiteOrder.map((suiteId) => [suiteId, profile.scores[suiteId].progress?.state || profile.scores[suiteId].evidence])),
    })),
    suites: suiteOrder.map((suiteId) => ({
      id: suiteId,
      label: measured[0].scores[suiteId].benchmark,
      rows: measured
        .map((profile) => {
          const score = profile.scores[suiteId];
          if (score.value != null && score.evidence === 'verified') return {
            conditionId: profile.conditionId, shortName: profile.condition.shortName, value: score.value, barValue: score.value,
            denominator: score.denominator, evidence: 'verified', kind: 'score', progress: null,
          };
          if (score.progress) return {
            conditionId: profile.conditionId, shortName: profile.condition.shortName, value: null,
            barValue: score.progress.total ? (score.progress.current / score.progress.total) * 100 : 0,
            denominator: score.progress.label, evidence: score.progress.state, kind: 'progress', progress: score.progress,
          };
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => (a.kind === b.kind ? b.barValue - a.barValue : a.kind === 'score' ? -1 : 1)),
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

export function getShowcasePortfolio() {
  return getPortfolioProjection(showcaseProjection, fixtures.products);
}

export function getShowcaseSkills() {
  return getSkillsProjection(showcaseProjection);
}

export function getLocalAccSearchRecords() {
  const portfolio = getShowcasePortfolio();
  const skills = getShowcaseSkills();
  const portfolioRecords = portfolio.internalProducts.map((product) => ({
    id: `portfolio:${product.id}`,
    kind: 'portfolio',
    title: product.name,
    summary: product.value,
    keywords: [product.kind, product.state, product.outcome, product.limitation, ...(product.worksNow || [])],
    route: { view: 'portfolio', product: product.id },
  }));
  const skillRecords = skills.operationalSkills.map((skill) => ({
    id: `skills:${skill.id}`,
    kind: 'skills',
    title: skill.name,
    summary: skill.description,
    keywords: [skill.category, skill.version, 'skill registry reusable operational knowledge'],
    route: { view: 'skills', skill: skill.id },
  }));
  const benchmarkRecords = getBenchmarkComparison().map((profile) => ({
    id: `benchmarks:${profile.conditionId}`,
    kind: 'benchmarks',
    title: profile.condition.shortName,
    summary: `${profile.condition.provider} · ${profile.condition.runtime} · ${profile.condition.quantization}`,
    keywords: [
      'benchmark condition measured IFEval BFCL tau2',
      profile.condition.reasoning,
      profile.note,
      ...Object.values(profile.scores).flatMap((score) => [score.label, score.benchmark, score.denominator]),
    ],
    route: { view: 'benchmarks', condition: profile.conditionId },
  }));
  const analyticsRecords = [
    {
      id: 'analytics:kungfuclan.com', kind: 'analytics', title: 'Kung Fu Clan analytics',
      summary: 'Cloudflare edge aggregates with requests, visits, transfer, cache behavior, countries, and coverage.',
      keywords: ['kungfuclan.com KFC web property cloudflare visits traffic world map'],
      route: { view: 'analytics', domain: 'web', subject: 'kungfuclan.com', range: '30d' },
    },
    {
      id: 'analytics:alexgeslani.com', kind: 'analytics', title: 'alexgeslani.com analytics',
      summary: 'Cloudflare edge aggregate reporting for alexgeslani.com.',
      keywords: ['web property cloudflare visits traffic coverage'],
      route: { view: 'analytics', domain: 'web', subject: 'alexgeslani.com', range: '30d' },
    },
    {
      id: 'analytics:provider-usage', kind: 'analytics', title: 'Provider usage',
      summary: 'Sanitized subscription and search quota windows with explicit authority boundaries.',
      keywords: ['codex chatgpt claude antigravity brave search limits quota analytics'],
      route: { view: 'analytics', domain: 'ai', subject: 'provider-usage' },
    },
  ];
  return [...portfolioRecords, ...skillRecords, ...benchmarkRecords, ...analyticsRecords];
}

export function filterLocalAcc(query) {
  const terms = String(query || '').normalize('NFKC').toLocaleLowerCase('en').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return getLocalAccSearchRecords().filter((record) => {
    const haystack = [record.title, record.summary, record.kind, ...(record.keywords || [])]
      .join(' ')
      .normalize('NFKC')
      .toLocaleLowerCase('en');
    return terms.every((term) => haystack.includes(term));
  });
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

const ROUTE_KEYS = ['view', 'q', 'domain', 'subject', 'range', 'mode', 'product', 'condition', 'result', 'release', 'run', 'skill', 'evaluation'];

export function buildAccUrl(state = {}, basePath = '/autobot-command-center') {
  const normalizedBase = basePath === '/' ? '' : String(basePath).replace(/\/$/, '');
  const standaloneSearch = state.view === 'search' && !normalizedBase;
  const params = new URLSearchParams();
  for (const key of ROUTE_KEYS) {
    if (standaloneSearch && key === 'view') continue;
    if (state[key]) params.set(key, state[key]);
  }
  const query = params.toString();
  const path = standaloneSearch ? '/search' : (normalizedBase || '/');
  return `${path}${query ? `?${query}` : ''}`;
}

export function parseAccUrl(input) {
  const url = new URL(input, 'http://localhost');
  const state = {};
  for (const key of ROUTE_KEYS) {
    const value = url.searchParams.get(key);
    if (value) state[key] = value;
  }
  if (url.pathname === '/search') state.view = 'search';
  if (!state.view) state.view = 'overview';
  return state;
}

export function canonicalizeAccRoute(route = {}) {
  if (route.view === 'usage') return { view: 'analytics', domain: 'ai', subject: 'provider-usage' };
  if (route.view === 'hivemind') return { view: 'search', ...(route.q ? { q: route.q } : {}) };
  return { ...route };
}
