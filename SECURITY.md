# Security policy

## Supported version

Security fixes are applied to the current `main` branch.

## Reporting

Please use GitHub's private vulnerability-reporting feature for this repository. Do not open a public issue containing credentials, tokens, account details, private hostnames, addresses, or filesystem paths.

## Deployment boundary

This repository is a public-safe application source tree, not a deployable infrastructure inventory.

Operators must keep these outside Git:

- API keys, tokens, cookies, OAuth material, certificates, and private keys
- provider account identity, prompts, sessions, and raw responses
- local DNS names, private addresses, host paths, service labels, and network topology
- mutable provider snapshots and logs
- production service-manager, proxy, container, and DNS configuration

The optional provider collectors publish only schema-allowlisted snapshots. The optional knowledge bridge requires explicit environment configuration, an origin allowlist, a collection allowlist, and file-mounted credentials. Missing or malformed authority must fail closed.
