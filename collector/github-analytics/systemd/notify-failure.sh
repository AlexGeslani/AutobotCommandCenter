#!/usr/bin/env bash
set -euo pipefail
umask 077
UNIT_NAME="${1:-unknown-unit}"
KEY="${GITHUB_ANALYTICS_ARK_KEY:-${HOME}/.config/github-analytics/credentials/ark_refresh_ed25519}"
KNOWN_HOSTS="${GITHUB_ANALYTICS_KNOWN_HOSTS:-${HOME}/.ssh/known_hosts}"
ARK_TARGET="${GITHUB_ANALYTICS_ARK_TARGET:-analytics-compiler}"
prop() { systemctl --user show "$UNIT_NAME" --property="$1" --value 2>/dev/null || printf 'unknown\n'; }
TIMESTAMP_UTC="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
ACTIVE_STATE="$(prop ActiveState)"; SUB_STATE="$(prop SubState)"; RESULT="$(prop Result)"; EXEC_STATUS="$(prop ExecMainStatus)"
if [[ "$UNIT_NAME" == *test* ]]; then HEADER="[GitHub analytics collector failure TEST] ${UNIT_NAME}"; else HEADER="[GitHub analytics collector failure] ${UNIT_NAME}"; fi
MSG_FILE="$(mktemp)"; trap 'rm -f "$MSG_FILE"' EXIT; chmod 600 "$MSG_FILE"
cat >"$MSG_FILE" <<MSG
${HEADER}
The daily GitHub repository traffic pipeline failed after its bounded retry.

Unit: ${UNIT_NAME}
Time (UTC): ${TIMESTAMP_UTC}
State: ${ACTIVE_STATE:-unknown}/${SUB_STATE:-unknown}
Result: ${RESULT:-unknown}
Exit status: ${EXEC_STATUS:-unknown}

Inspect on the collector host:
  systemctl --user status ${UNIT_NAME}
  journalctl --user -u ${UNIT_NAME} --since "24 hours ago" --no-pager

No raw analytics, repository payloads, or credentials are included. No automatic remediation was started.
MSG
exec /usr/bin/ssh -F /dev/null -i "$KEY" -o BatchMode=yes -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KNOWN_HOSTS" -o ConnectTimeout=10 -o ConnectionAttempts=1 -o LogLevel=ERROR "$ARK_TARGET" github-analytics-alert <"$MSG_FILE"
