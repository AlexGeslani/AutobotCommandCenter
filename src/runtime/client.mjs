import { DEMO_DOMAIN_PROJECTION, DEMO_EDITION, parseRuntimeJson, validateDomainProjection, validateEdition } from './contracts.mjs';
import { EMPTY_PROJECT_PORTFOLIO, validateProjectPortfolio } from '../portfolio/schema.mjs';

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
  let portfolio = EMPTY_PROJECT_PORTFOLIO;
  let editionReady = false;
  let domainReady = false;
  let portfolioReady = false;

  return async function load(basePath = '/') {
    let editionHealth;
    try {
      edition = await fetchValidated(fetcher, basePath, 'runtime/edition.v1.json', validateEdition, 'edition');
      editionReady = true;
      editionHealth = { state: 'ready', stale: false, valid: true, error: null };
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

    let portfolioHealth = { state: 'not_configured', stale: false, valid: true, error: null };
    if (edition.projections.portfolio) {
      try {
        portfolio = await fetchValidated(fetcher, basePath, edition.projections.portfolio, validateProjectPortfolio, 'project portfolio');
        portfolioReady = true;
        portfolioHealth = { state: 'ready', stale: false, valid: true, error: null };
      } catch (error) {
        portfolioHealth = degradedState(error, portfolioReady);
      }
    } else if (editionHealth.valid) {
      portfolio = EMPTY_PROJECT_PORTFOLIO;
      portfolioReady = false;
    }

    return {
      edition: structuredClone(edition),
      domain: structuredClone(domain),
      portfolio: structuredClone(portfolio),
      health: {
        edition: editionHealth,
        domain: domainHealth,
        portfolio: portfolioHealth,
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
