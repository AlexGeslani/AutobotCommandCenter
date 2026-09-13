#!/usr/bin/env bash
set -euo pipefail
KEY="${GITHUB_ANALYTICS_ARK_KEY:-${HOME}/.config/github-analytics/credentials/ark_refresh_ed25519}"
KNOWN_HOSTS="${GITHUB_ANALYTICS_KNOWN_HOSTS:-${HOME}/.ssh/known_hosts}"
ARK_TARGET="${GITHUB_ANALYTICS_ARK_TARGET:-analytics-compiler}"
exec /usr/bin/ssh -F /dev/null \
  -i "$KEY" \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o PreferredAuthentications=publickey \
  -o PasswordAuthentication=no \
  -o KbdInteractiveAuthentication=no \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$KNOWN_HOSTS" \
  -o ConnectTimeout=15 \
  -o ConnectionAttempts=1 \
  -o LogLevel=ERROR \
  "$ARK_TARGET" github-analytics-refresh
