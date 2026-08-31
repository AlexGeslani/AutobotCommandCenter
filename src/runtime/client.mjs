import { DEMO_DOMAIN_PROJECTION, DEMO_EDITION, parseRuntimeJson, validateDomainProjection, validateEditionWithWarnings } from './contracts.mjs';

function origin() {
  return globalThis.location?.origin || 'http://localhost';
}

function projectionUrl(basePath, relativePath) {
  const base = new URL(basePath, origin());
  return new URL(relativePath, `${base.href.replace(/\/?$/, '/')}`);
}

async function fetchValidated(fetcher, basePath, relativePath, validator, label) {
  const response = await fetcher(projectionUrl(basePath, relativePath), { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label} unavailable`);
  return parseRuntimeJson(await response.text(), validator, label);
}

function degradedState(error, hasRuntimeValue) {
  return {
    state: hasRuntimeValue ? 'stale_invalid' : 'demo_invalid',
    stale: true,
    valid: false,
    error: error.message,
  };
}

export function createRuntimeLoader({ fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== 'function') throw new TypeError('runtime loader requires fetch');
  let edition = DEMO_EDITION;
  let domain = DEMO_DOMAIN_PROJECTION;
  let editionReady = false;
  let domainReady = false;

  return async function load(basePath = '/') {
    let editionHealth;
    try {
      const candidate = await fetchValidated(fetcher, basePath, 'runtime/edition.v1.json', validateEditionWithWarnings, 'edition');
      edition = candidate.edition;
      editionReady = true;
      editionHealth = candidate.warnings.length
        ? { state: 'ready_with_warnings', stale: false, valid: true, error: candidate.warnings.join('; '), warnings: candidate.warnings }
        : { state: 'ready', stale: false, valid: true, error: null, warnings: [] };
    } catch (error) {
      editionHealth = degradedState(error, editionReady);
    }

    let domainHealth;
    try {
      domain = await fetchValidated(fetcher, basePath, edition.projections.domain, validateDomainProjection, 'domain projection');
      domainReady = true;
      domainHealth = { state: 'ready', stale: false, valid: true, error: null };
    } catch (error) {
      domainHealth = degradedState(error, domainReady);
    }

    return {
      edition: structuredClone(edition),
      domain: structuredClone(domain),
      health: {
        edition: editionHealth,
        domain: domainHealth,
        state: editionHealth.valid && domainHealth.valid ? 'ready' : 'degraded',
      },
    };
  };
}

const defaultLoader = createRuntimeLoader();
export const loadRuntimeConfiguration = (basePath = '/') => defaultLoader(basePath);

export function runtimeProjectionUrl(basePath, relativePath) {
  return projectionUrl(basePath, relativePath).href;
}
