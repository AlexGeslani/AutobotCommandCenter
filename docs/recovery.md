# Repository recovery

The Git repository and immutable release tags are the source-recovery authority. Deployment routes, credentials, runtime snapshots, DNS, service managers, and host-specific configuration must remain outside this public repository.

## Restore a source baseline

```bash
git clone https://github.com/AlexGeslani/AutobotCommandCenter.git
cd AutobotCommandCenter
git checkout <accepted-tag>
npm ci
npm test
npm run build
```

A fresh checkout intentionally contains no provider-usage snapshot. The UI must render an explicit unavailable state until a valid sanitized snapshot is supplied by the operator's private deployment layer.

## Validate an archive

When a release archive is retained separately, verify its checksum and Git bundle before extracting:

```bash
shasum -a 256 -c SHA256SUMS
git bundle verify source.bundle
```

Extract into a new staging directory, verify the selected tag and built artifact, then perform deployment through the operator-owned release process. Never restore an old complete network, DNS, credential, or runtime configuration over current infrastructure.
