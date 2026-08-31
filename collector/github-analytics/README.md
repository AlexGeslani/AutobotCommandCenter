# GitHub Portfolio analytics

This source family is intentionally separate from ACC's Cloudflare/web analytics. It has its own collector, archive root, checksum transaction, compiler, projection, credentials, logs, and scheduler.

## Source semantics

- GitHub's repository traffic endpoints expose a rolling, revisable 14-day window.
- Every run stores a complete immutable observation per allowlisted numeric repository ID.
- The compiler selects the newest valid observation for each repository/day and retains older dates after they age out.
- Additive counts: repository views and full clones.
- Non-additive values: unique visitors, unique cloners, top referrers, and popular paths. These remain repository-window snapshots and are never summed or merged into portfolio rankings.
- An explicit provider zero is `0`; an absent metric/day is `missing` and projects as `null`/`—`.
- Repository `subscribers_count` is labeled **Subscribers**. `watchers_count` is not used because GitHub aliases it to stars.
- Private, unknown-visibility, access-lost, and unapproved repositories are excluded from the browser projection without exposing identity, metrics, or excluded counts.

## Runtime topology

```text
GitHub REST API
  -> collector-host systemd user timer + deterministic Python collector
  -> private immutable working mirror
  -> dedicated key-only SFTP transaction
  -> durable archive authority
  -> checksum-verified compiler-host mirror
  -> deterministic Node compiler
  -> ACC Dev runtime/analytics/github/github-portfolio.v1.json
```

Do not add this collector to the web-analytics batch. A GitHub failure must not block Cloudflare publication, and a Cloudflare failure must not block GitHub collection.

## Credential boundary

The steady-state collector accepts one file at `credentialFile`, mode `0600`, containing only:

```text
GITHUB_TOKEN=<value>
```

Use a token restricted to the four approved public repositories with **Administration: read** repository permission. GitHub documents that permission for clones, views, referral sources, and referral paths. Keep it only in the protected collector-host runtime credential file; never upload it to archive storage or include it in Git, logs, fixtures, receipts, projections, or support bundles.

## Storage framework

GitHub and Cloudflare follow one operational framework but remain separate source families. GitHub uses its own working mirror, state, immutable observations, compiler, projection, refresh transaction, and timer. The deployment config selects its durable authority and SFTP root. Neither source is nested inside or compiled through the other merely because a deployment may reuse one transport identity or parent storage location.

## Archive transaction

Each immutable object is written as deterministic gzip JSON plus a same-directory `.sha256` sidecar:

```text
github/observations/YYYY/MM/DD/<numeric-id>/github-traffic-<numeric-id>-<version>.json.gz
```

The collection timestamp is the explicit version. An exact version rerun is idempotent only when bytes and checksum already match; a different immediate timestamp creates a separately auditable observation.

## Focused verification

```bash
npx vitest run tests/github-analytics-schema.test.mjs tests/github-analytics-compiler.test.mjs tests/github-analytics-view.test.mjs
python3 tests/github-analytics-collector.test.py
```

Compile a verified mirror:

```bash
node collector/github-analytics/compiler.mjs \
  --archive-root .runtime/github-analytics/archive \
  --output standalone/public/runtime/analytics/github/github-portfolio.v1.json
```

The compiler rejects missing/mismatched sidecars, incompatible observation contracts, unallowlisted IDs, inconsistent source identity, and impossible count/unique relationships.
