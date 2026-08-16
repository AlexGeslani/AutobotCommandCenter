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
  getVoicePerformance,
} from '../src/model.mjs';

describe('ACC product contract', () => {
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
  it('keeps exactly five durable primary destinations', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Overview', 'Portfolio', 'Benchmarks', 'Skill Registry', 'Hive Mind',
    ]);
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

  it('separates skill provenance, stewardship, publication, and validation', () => {
    for (const skill of fixtures.skills) {
      expect(skill).toHaveProperty('provenance');
      expect(skill).toHaveProperty('stewardship');
      expect(skill).toHaveProperty('publication');
      expect(skill).toHaveProperty('validation');
    }
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
    expect(fixtures.skills.every((skill) => skill.provenance.includes('authored') || skill.stewardship.includes('maintained'))).toBe(true);
  });

  it('round-trips stable query-string deep links including benchmark domain', () => {
    const url = buildAccUrl({ view: 'benchmarks', domain: 'coding', condition: 'qwen36-awq-vllm' });
    expect(url.startsWith('/autobot-command-center?')).toBe(true);
    expect(parseAccUrl(url)).toEqual({
      view: 'benchmarks', domain: 'coding', condition: 'qwen36-awq-vllm',
    });
  });
});
