import { describe, expect, it } from 'vitest';
import {
  NAV_ITEMS,
  fixtures,
  getLeaderboard,
  getCapabilityRollup,
  getCondition,
  getEvaluationIndex,
  getSourceTrust,
  getRunLineage,
  getEffectiveAvailability,
  getEffectiveProductClaims,
  getEffectiveSkillClaims,
  buildAccUrl,
  parseAccUrl,
  canonicalizeAccRoute,
  getVoicePerformance,
  getBenchmarkComparison,
  getMeasuredBenchmarkVisuals,
  getOverviewProjection,
  getShowcasePortfolio,
  getShowcaseSkills,
} from '../src/model.mjs';

describe('ACC product contract', () => {
  it('presents only measured model conditions through the three-score benchmark standard', () => {
    const comparison = getBenchmarkComparison();
    expect(comparison).toHaveLength(4);
    expect(comparison.map((profile) => profile.conditionId)).toEqual([
      'gpt56-luna-max', 'gpt56-sol-max', 'qwen38-2b-mlx', 'qwen36-35b-heretic-gpu-b',
    ]);
    expect(comparison[0].scores).toMatchObject({
      instruction: { value: 82.5, evidence: 'verified' },
      tools: { value: 45.89, evidence: 'verified' },
      agent: { value: 48, evidence: 'verified' },
    });
    expect(comparison[0].note).toMatch(/acc-tau2-fixed-judge-v1\.1/);
    expect(comparison[1]).toMatchObject({
      conditionId: 'gpt56-sol-max',
      evidence: 'measured',
      scores: {
        instruction: { value: 90, evidence: 'verified' },
        tools: { value: 48.55, evidence: 'verified' },
        agent: { value: 70, evidence: 'verified' },
      },
    });
    expect(comparison[1].note).toMatch(/69\.52% equal-weight macro/i);
    expect(comparison[0].operational).toMatchObject({
      evidence: 'verified-aggregate',
      candidateUsage: { inputTokens: 18549208, outputTokens: 1603165, totalTokens: 20152373, cachedInputTokens: null, reasoningTokens: null, retainedBridgeEvents: 4304 },
      performance: { class: 'frontier-route', successfulResponses: 4290, bridgeErrorEvents: 14, latencySeconds: { median: 6.3779, mean: 8.8543, p95: 21.8786 }, endToEndOutputTokensPerSecond: 42.2052 },
      judgeUsage: { totalTokens: 19655 },
      billing: { route: 'ChatGPT/Codex subscription', marginalApiChargeUsd: 0, monthlySubscriptionUsd: 200, candidateApiEquivalentUsd: 5.63, judgeApiEquivalentUsd: 0.12 },
    });
    expect(comparison[1].operational).toMatchObject({
      evidence: 'verified-aggregate',
      candidateUsage: { inputTokens: 22636604, outputTokens: 1851898, totalTokens: 24488502, cachedInputTokens: null, reasoningTokens: null, retainedBridgeEvents: 4657 },
      performance: { class: 'frontier-route', successfulResponses: 4586, bridgeErrorEvents: 71, latencySeconds: { median: 8.7603, mean: 13.3428, p95: 35.5755 }, endToEndOutputTokensPerSecond: 30.2647 },
      judgeUsage: { totalTokens: 40330 },
      billing: { route: 'ChatGPT/Codex subscription', marginalApiChargeUsd: 0, monthlySubscriptionUsd: 200, candidateApiEquivalentUsd: 127.58, judgeApiEquivalentUsd: 0.23 },
    });
    expect(comparison[2]).toMatchObject({
      conditionId: 'qwen38-2b-mlx', evidence: 'measured',
      currentAverage: { value: 15.61, verifiedSuites: 2, totalSuites: 3, complete: false },
      scores: {
        instruction: { value: 22.5, evidence: 'verified', denominator: '9 / 40 strict prompts' },
        tools: { value: 8.72, evidence: 'verified', denominator: '150 / 150 frozen scored cases' },
        agent: { value: null, evidence: 'pending', progress: { current: 28, total: 50, state: 'in-progress' } },
      },
      operational: {
        evidence: 'verified-partial',
        candidateUsage: { inputTokens: 9839500, outputTokens: 1130727, totalTokens: 10970227, cachedInputTokens: 2135136, reasoningTokens: null },
        performance: { class: 'local-runtime', successfulResponses: 1608, bridgeErrorEvents: 0, latencySeconds: { median: 11.6742, mean: 21.2696, p95: 78.2772 }, endToEndOutputTokensPerSecond: 29.4517 },
        localRuntime: { hardwareProfile: 'edge-node-a-mac-mini-m2-24gb-20260826', processor: 'Apple M2 · 8-core CPU', memory: '24 GB unified memory', accelerator: 'Apple M2 · 10-core GPU · Metal', os: 'macOS 26.5.2', backend: 'MLX/Metal', context: '262,144 tokens', concurrency: 1, retries: 0 },
      },
    });
    expect(comparison[2].note).toMatch(/BFCL scored 8\.72%/i);
    expect(comparison[3]).toMatchObject({
      conditionId: 'qwen36-35b-heretic-gpu-b', evidence: 'measured',
      currentAverage: { value: 65.09, verifiedSuites: 3, totalSuites: 3, complete: true },
      scores: {
        instruction: { value: 77.5, evidence: 'verified', denominator: '31 / 40 strict prompts' },
        tools: { value: 51.76, evidence: 'verified', denominator: '150 / 150 frozen scored cases' },
        agent: { value: 66, evidence: 'verified', denominator: '33 / 50 frozen tasks' },
      },
      operational: {
        evidence: 'verified-aggregate',
        candidateUsage: { inputTokens: 36561557, outputTokens: 5484306, totalTokens: 42045863, retainedBridgeEvents: 3800 },
        judgeUsage: { inputTokens: 27087, outputTokens: 680, totalTokens: 27767, requests: 6, successes: 6 },
        performance: { class: 'local-runtime', successfulResponses: 2633, bridgeErrorEvents: 25, latencySeconds: { median: 3.8922, mean: 25.1470, p95: 36.1704 }, endToEndOutputTokensPerSecond: 69.7602 },
        localRuntime: { hardwareProfile: 'gpu-node-b-hardware-unresolved-20260826', machine: 'Not captured in retained run evidence', processor: 'Not captured', memory: 'Not captured', accelerator: 'Not captured', os: 'Not captured', context: '262,144 total · 131,072 per slot', slots: 2, concurrency: 1, retries: 0 },
      },
    });
    expect(comparison.slice(0, 2).every((profile) => profile.operational.pricing.assumption === 'All retained input priced as uncached')).toBe(true);
    expect(comparison.map((profile) => profile.currentAverage.value)).toEqual([58.8, 69.52, 15.61, 65.09]);
    expect(comparison.every((profile) => profile.evidence === 'measured')).toBe(true);
    expect(comparison.some((profile) => profile.evidence === 'illustrative')).toBe(false);
    expect(comparison.every((profile) => Object.keys(profile.scores).join(',') === 'instruction,tools,agent')).toBe(true);
  });

  it('builds per-suite visuals from measured evidence only and preserves missing coverage', () => {
    const visual = getMeasuredBenchmarkVisuals();
    expect(visual).not.toHaveProperty('overallScore');
    expect(visual).not.toHaveProperty('winner');
    expect(visual.profiles.map((profile) => profile.conditionId)).toEqual([
      'gpt56-luna-max', 'gpt56-sol-max', 'qwen38-2b-mlx', 'qwen36-35b-heretic-gpu-b',
    ]);
    expect(visual.profiles.map((profile) => profile.coverage)).toEqual([
      { instruction: 'verified', tools: 'verified', agent: 'verified' },
      { instruction: 'verified', tools: 'verified', agent: 'verified' },
      { instruction: 'verified', tools: 'verified', agent: 'in-progress' },
      { instruction: 'verified', tools: 'verified', agent: 'verified' },
    ]);
    expect(visual.suites.map((suite) => suite.id)).toEqual(['instruction', 'tools', 'agent']);
    expect(visual.suites.map((suite) => suite.label)).toEqual(['IFEval', 'BFCL V4', 'tau2']);
    expect(visual.suites[0].rows.map((row) => [row.conditionId, row.value])).toEqual([
      ['gpt56-sol-max', 90], ['gpt56-luna-max', 82.5], ['qwen36-35b-heretic-gpu-b', 77.5], ['qwen38-2b-mlx', 22.5],
    ]);
    expect(visual.suites[1].rows.map((row) => row.conditionId)).toEqual(['qwen36-35b-heretic-gpu-b', 'gpt56-sol-max', 'gpt56-luna-max', 'qwen38-2b-mlx']);
    expect(visual.suites[2].rows.map((row) => row.conditionId)).toEqual(['gpt56-sol-max', 'qwen36-35b-heretic-gpu-b', 'gpt56-luna-max', 'qwen38-2b-mlx']);
    expect(visual.suites[0].rows[0].denominator).toBe('36 / 40 strict prompts');
    expect(visual.suites[1].rows[0]).toMatchObject({ kind: 'score', evidence: 'verified', value: 51.76, progress: null });
    expect(visual.suites[2].rows[1]).toMatchObject({ conditionId: 'qwen36-35b-heretic-gpu-b', kind: 'score', evidence: 'verified', value: 66, progress: null });
    expect(visual.suites[2].rows.at(-1)).toMatchObject({ conditionId: 'qwen38-2b-mlx', kind: 'progress', evidence: 'in-progress', progress: { current: 28, total: 50 } });
    expect(visual.suites[2].rows.at(-1).barValue).toBeCloseTo(56, 8);
    expect(visual.suites.flatMap((suite) => suite.rows).filter((row) => row.kind === 'score').every((row) => row.value != null && row.evidence === 'verified')).toBe(true);
    expect(JSON.stringify(visual)).not.toMatch(/illustrative/i);
  });

  it('projects the measured Prime voice comparison as exact route evidence', () => {
    const snapshot = getVoicePerformance();
    expect(snapshot.id).toBe('voice-performance-2026-07-26');
    expect(snapshot.routes).toHaveLength(6);
    expect(snapshot.routes[0]).toMatchObject({ host: 'Edge Node A', engine: 'Kokoro MLX', completeSeconds: 0.344, rtf: 0.095, successfulTrials: 3, totalTrials: 3 });
    const gpuNodeBQwen = snapshot.routes.find((route) => route.id === 'gpu-b-qwen3-rocm');
    expect(gpuNodeBQwen).toMatchObject({ successfulTrials: 2, totalTrials: 3, timeouts: 1 });
    expect(snapshot.method).toMatch(/same sentence/i);
    expect(snapshot.observedAt).toBe('2026-07-26');
  });
  it('keeps the durable primary destinations and names the sixth area Search', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Overview', 'Portfolio', 'Analytics', 'Benchmarks', 'Skill Registry', 'Search',
    ]);
  });

  it('prioritizes provider headroom and keeps Overview destination summaries compact', () => {
    const overview = getOverviewProjection();
    expect(overview.sectionOrder).toEqual([
      'provider-usage', 'source-exceptions', 'destinations', 'recently-landed',
    ]);
    expect(overview.sourceExceptions.map((source) => source.id)).toEqual([
      'runtime', 'skill-meta',
    ]);
    expect(overview.destinations).toEqual([
      { id: 'portfolio', label: 'Portfolio', summary: 'Products and durable capabilities' },
      { id: 'analytics', label: 'Analytics', summary: 'Traffic, service usage, and coverage' },
      { id: 'benchmarks', label: 'Benchmarks', summary: 'Measured model evidence' },
      { id: 'skills', label: 'Skills', summary: 'Reusable delivery knowledge' },
    ]);
    expect(overview.sectionOrder).not.toEqual(expect.arrayContaining([
      'durable-capabilities', 'model-leaders', 'decision-pending',
    ]));
  });

  it('round-trips analytics domain, subject, range, and fixture mode', () => {
    const state = { view: 'analytics', domain: 'web', subject: 'kungfuclan-demo', range: '30d', mode: 'fixture' };
    expect(parseAccUrl(buildAccUrl(state))).toEqual(state);
  });

  it('keeps the legacy usage route as a one-way alias into Analytics', () => {
    expect(canonicalizeAccRoute({ view: 'usage' })).toEqual({ view: 'analytics', domain: 'ai', subject: 'provider-usage' });
    expect(canonicalizeAccRoute({ view: 'analytics', domain: 'ai', subject: 'provider-usage' })).toEqual({ view: 'analytics', domain: 'ai', subject: 'provider-usage' });
  });

  it('ranks only comparable canonical results for one benchmark release', () => {
    const rows = getLeaderboard('tool-use', 'bfcl-v3');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((row) => row.domain === 'tool-use')).toBe(true);
    expect(rows.every((row) => row.release === 'bfcl-v3')).toBe(true);
    expect(rows.every((row) => row.status === 'canonical')).toBe(true);
    expect(rows.map((row) => row.score)).toEqual(
      [...rows.map((row) => row.score)].sort((a, b) => b - a),
    );
  });

  it('builds a coverage-aware normalized rollup without treating missing evidence as zero', () => {
    const rollup = getCapabilityRollup();
    expect(rollup.domains.map((item) => item.id)).toEqual(['tool-use', 'reasoning', 'coding']);
    expect(rollup.complete.map((item) => item.condition.id)).toEqual(['gpt56-max-api', 'qwen36-awq-vllm']);
    expect(rollup.complete[0]).toMatchObject({ index: 100, coverage: 3, totalDomains: 3, complete: true });
    expect(rollup.complete[1].index).toBeGreaterThan(0);
    expect(rollup.complete[1].index).toBeLessThan(100);
    expect(rollup.complete[1].domainScores['tool-use']).toBeCloseTo((84.1 / 89.4) * 100, 5);
    expect(rollup.complete[1].domainScores.reasoning).toBeCloseTo((74.7 / 88.0) * 100, 5);
    expect(rollup.complete[1].domainScores.coding).toBeCloseTo((57.4 / 65.5) * 100, 5);
    expect(rollup.partial.map((item) => item.condition.id)).toEqual(['devstral-fp8-vllm']);
    expect(rollup.partial[0]).toMatchObject({ coverage: 2, totalDomains: 3, complete: false });
    expect(rollup.partial[0].domainScores.reasoning).toBeNull();
    expect(rollup.partial[0].index).not.toBe(0);
    expect(fixtures.results.some((result) => result.status === 'provisional')).toBe(true);
    expect(rollup.complete.concat(rollup.partial).every((item) => !item.resultIds.includes('r-bfcl-qwen-provisional'))).toBe(true);
  });

  it('keeps duplicate and orphan canonical results out of normalization denominators', () => {
    const duplicate = { ...fixtures.results.find((result) => result.id === 'r-bfcl-gpt'), id: 'r-bfcl-gpt-duplicate', score: 99.9 };
    const orphan = { ...fixtures.results.find((result) => result.id === 'r-bfcl-gpt'), id: 'r-bfcl-orphan', conditionId: 'missing-condition', score: 100 };
    fixtures.results.push(duplicate, orphan);
    try {
      const rollup = getCapabilityRollup();
      const toolUse = rollup.domains.find((domain) => domain.id === 'tool-use');
      expect(toolUse.best).toBe(84.1);
      const gpt = rollup.partial.find((row) => row.condition.id === 'gpt56-max-api');
      expect(gpt.domainScores['tool-use']).toBeNull();
      const qwen = rollup.complete.find((row) => row.condition.id === 'qwen36-awq-vllm');
      expect(qwen.domainScores['tool-use']).toBe(100);
      expect(rollup.complete.concat(rollup.partial).some((row) => row.condition.id === 'missing-condition')).toBe(false);
    } finally {
      fixtures.results.splice(-2, 2);
    }
  });

  it('opens a leaderboard result as the exact tested condition with lineage', () => {
    const row = getLeaderboard('tool-use', 'bfcl-v3')[0];
    const condition = getCondition(row.conditionId);
    expect(condition.fingerprint).toBeTruthy();
    expect(condition.familyId).toBeTruthy();
    expect(condition.results.some((result) => result.id === row.id)).toBe(true);
    expect(row.runIds.length).toBeGreaterThan(0);
  });

  it('provides a global evaluation index while evaluations remain attached', () => {
    const index = getEvaluationIndex();
    expect(index.length).toBeGreaterThan(1);
    for (const evaluation of index) {
      expect(evaluation.affectedObjects.length).toBeGreaterThan(0);
      expect(['provisional', 'final', 'inconclusive']).toContain(evaluation.findingStatus);
    }
  });

  it('projects selected operational skill frontmatter without inventing validation authority', () => {
    const registry = getShowcaseSkills();
    expect(registry.operationalSkills).toHaveLength(8);
    expect(registry.showcaseEditions).toEqual([]);
    for (const skill of registry.operationalSkills) {
      expect(skill.description.length).toBeGreaterThan(20);
      expect(skill.version).toBeTruthy();
      expect(skill.metadataStatus).toBe('frontmatter');
      expect(skill.validationStatus).toBe('Unknown');
    }
  });

  it('separates exact public showcase membership from internal products and capabilities', () => {
    const portfolio = getShowcasePortfolio();
    expect(portfolio.githubShowcaseProjects.map((project) => project.id)).toEqual(['jarvis', 'stacklogic', '8-ball']);
    expect(portfolio.internalProducts.map((product) => product.id)).toEqual(expect.arrayContaining([
      'autobot-command-center', 'voice-lab', 'web-analytics', 'model-serving', 'benchmark-program',
    ]));
    expect(portfolio.internalProducts.some((product) => product.id === 'jarvis')).toBe(false);
    expect(new Set(portfolio.internalProducts.map((product) => product.kind))).toEqual(new Set(['Product', 'Capability']));
  });

  it('degrades claims visibly when an authoritative source is stale or missing', () => {
    const trust = getSourceTrust();
    expect(trust.some((source) => source.state === 'stale')).toBe(true);
    expect(trust.some((source) => source.state === 'missing')).toBe(true);
    expect(trust.filter((source) => source.invalidatesClaims).length).toBeGreaterThan(0);
  });

  it('accepts run evidence only for exact condition-result-domain-release lineage', () => {
    const valid = { conditionId: 'qwen36-awq-vllm', resultId: 'r-bfcl-qwen', domain: 'tool-use', release: 'bfcl-v3', runId: 'run-bfcl-qwen' };
    expect(getRunLineage(valid)?.run.id).toBe('run-bfcl-qwen');
    expect(getRunLineage({ ...valid, domain: 'coding' })).toBeNull();
    expect(getRunLineage({ ...valid, domain: undefined })).toBeNull();
    expect(getRunLineage({ ...valid, domain: 'evil' })).toBeNull();
    expect(getRunLineage({ ...valid, release: 'bigcodebench-hard-2026-06' })).toBeNull();
    expect(getRunLineage({ ...valid, resultId: 'r-code-qwen' })).toBeNull();
    expect(getRunLineage({ ...valid, runId: 'run-code-qwen' })).toBeNull();
    expect(getRunLineage({ conditionId: 'qwen36-awq-vllm', resultId: 'r-bfcl-qwen-provisional', domain: 'tool-use', release: 'bfcl-v4-preview', runId: 'run-bfcl-qwen-preview' })).toBeNull();
    const coding = { conditionId: 'qwen36-awq-vllm', resultId: 'r-code-qwen', domain: 'coding', release: 'bigcodebench-hard-2026-06', runId: 'run-code-qwen' };
    expect(getRunLineage(coding)?.result.id).toBe('r-code-qwen');
  });

  it('withholds runtime-dependent product state and works-now claims', () => {
    const service = fixtures.products.find((product) => product.id === 'model-serving');
    expect(getEffectiveProductClaims(service)).toEqual({ state: 'unknown', worksNow: null });
    const benchmark = fixtures.products.find((product) => product.id === 'benchmark-program');
    expect(getEffectiveProductClaims(benchmark).state).toBe('Usable');
  });

  it('round-trips stable query-string deep links including exact run lineage', () => {
    const state = { view: 'benchmarks', domain: 'tool-use', condition: 'qwen36-awq-vllm', result: 'r-bfcl-qwen', release: 'bfcl-v3', run: 'run-bfcl-qwen' };
    const url = buildAccUrl(state);
    expect(url.startsWith('/autobot-command-center?')).toBe(true);
    expect(parseAccUrl(`http://localhost${url}`)).toEqual(state);
  });

  it('withholds availability and skill claims whose authority is stale or missing', () => {
    expect(getEffectiveAvailability(getCondition('gpt56-max-api'))).toBe('unknown');
    const claims = getEffectiveSkillClaims(fixtures.skills[0]);
    expect(claims.publication).toBe('unknown');
    expect(claims.stewardship).toBe('unknown');
  });

  it('limits the registry to authored or materially maintained artifacts', () => {
    expect(fixtures.skills.every((skill) => skill.metadataStatus === 'frontmatter' && skill.validationStatus === 'Unknown')).toBe(true);
  });

  it('round-trips stable query-string deep links including benchmark domain', () => {
    const url = buildAccUrl({ view: 'benchmarks', domain: 'coding', condition: 'qwen36-awq-vllm' });
    expect(url.startsWith('/autobot-command-center?')).toBe(true);
    expect(parseAccUrl(url)).toEqual({
      view: 'benchmarks', domain: 'coding', condition: 'qwen36-awq-vllm',
    });
  });
});
