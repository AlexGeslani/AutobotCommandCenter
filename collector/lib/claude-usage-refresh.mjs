const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
export const CLAUDE_USAGE_REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
export const CLAUDE_USAGE_COMMAND_TIMEOUT_MS = 110_000;

const MONTHS = new Map([
  ['jan', 0], ['feb', 1], ['mar', 2], ['apr', 3], ['may', 4], ['jun', 5],
  ['jul', 6], ['aug', 7], ['sep', 8], ['oct', 9], ['nov', 10], ['dec', 11],
]);

function stripTerminalControl(value) {
  return String(value)
    .replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|[PX^_].*?\x1b\\)/gs, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ')
    .replace(/\r/g, '\n');
}

function percentFromSection(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return null;
  const remainder = text.slice(start);
  const end = endPattern ? remainder.slice(1).search(endPattern) : -1;
  const section = end >= 0 ? remainder.slice(0, end + 1) : remainder.slice(0, 1200);
  const match = section.match(/(\d{1,3})\s*%\s*used/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function compactTerminalText(text) {
  return text.replace(/\s+/g, '');
}

function percentFromCompactSection(compact, startToken, endToken = null) {
  const lower = compact.toLowerCase();
  const start = lower.indexOf(startToken.toLowerCase());
  if (start < 0) return null;
  const end = endToken ? lower.indexOf(endToken.toLowerCase(), start + startToken.length) : -1;
  const section = compact.slice(start, end > start ? end : Math.min(compact.length, start + 1200));
  const values = [...section.matchAll(/(\d{1,3})%used/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : null;
}

function formatterParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function zonedDateTimeToIso({ year, month, day, hour, minute }, timeZone) {
  const desired = Date.UTC(year, month, day, hour, minute, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = formatterParts(guess, timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}

function parseReportedWeeklyReset(text, observedAt) {
  const compact = compactTerminalText(text);
  const match = compact.match(/Resets([A-Za-z]{3})(\d{1,2})at(\d{1,2})(?::(\d{2}))?(am|pm)\(([^)]+)\)/i);
  if (!match) return null;
  const month = MONTHS.get(match[1].toLowerCase());
  const day = Number(match[2]);
  let hour = Number(match[3]) % 12;
  if (match[5].toLowerCase() === 'pm') hour += 12;
  const minute = Number(match[4] || 0);
  const timeZone = match[6];
  if (month === undefined || day < 1 || day > 31 || minute > 59) return null;
  let year;
  try {
    year = formatterParts(Date.parse(observedAt), timeZone).year;
  } catch {
    return null;
  }
  let result;
  try {
    result = zonedDateTimeToIso({ year, month, day, hour, minute }, timeZone);
    if (Date.parse(result) <= Date.parse(observedAt)) result = zonedDateTimeToIso({ year: year + 1, month, day, hour, minute }, timeZone);
  } catch {
    return null;
  }
  return result;
}

function parseReportedSessionReset(text, observedAt) {
  const compact = compactTerminalText(text);
  const start = compact.search(/Currentsession/i);
  const end = compact.search(/Currentweek\(allmodels\)/i);
  if (start < 0 || end <= start) return null;
  const match = compact.slice(start, end).match(/Resets(\d{1,2})(?::(\d{2}))?(am|pm)\(([^)]+)\)/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === 'pm') hour += 12;
  const minute = Number(match[2] || 0);
  const timeZone = match[4];
  if (minute > 59) return null;
  try {
    const observedMs = Date.parse(observedAt);
    const local = formatterParts(observedMs, timeZone);
    let result = zonedDateTimeToIso({ year: local.year, month: local.month - 1, day: local.day, hour, minute }, timeZone);
    if (Date.parse(result) <= observedMs) {
      const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
      result = zonedDateTimeToIso({
        year: next.getUTCFullYear(), month: next.getUTCMonth(), day: next.getUTCDate(), hour, minute,
      }, timeZone);
    }
    const delta = Date.parse(result) - observedMs;
    return delta > 0 && delta <= 26 * 60 * 60 * 1000 ? result : null;
  } catch {
    return null;
  }
}

export function normalizeClaudeUsageTranscript(transcript, observedAt = new Date().toISOString()) {
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs) || new Date(observedMs).toISOString() !== observedAt) throw new TypeError('observedAt must be canonical UTC ISO');
  const text = stripTerminalControl(transcript);
  const compact = compactTerminalText(text);
  let fiveHourUsed = percentFromSection(text, /Current session/i, /Current week\s*\(all models\)/i);
  let sevenDayUsed = percentFromSection(text, /Current week\s*\(all models\)/i, /Current week\s*\((?!all models)/i);
  fiveHourUsed ??= percentFromCompactSection(compact, 'Currentsession', 'Currentweek(allmodels)');
  sevenDayUsed ??= percentFromCompactSection(compact, 'Currentweek(allmodels)', 'Currentweek(');
  if (fiveHourUsed === null || sevenDayUsed === null) {
    const start = text.search(/Current session/i);
    const reset = text.search(/Resets\s*[A-Za-z]{3}\s*\d{1,2}\s*at/i);
    const compactSection = start >= 0 ? text.slice(start, reset > start ? reset : start + 1600) : '';
    const percentages = [...compactSection.matchAll(/(\d{1,3})\s*%\s*used/gi)]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
    fiveHourUsed ??= percentages[0] ?? null;
    sevenDayUsed ??= percentages[1] ?? null;
  }
  const fiveHourReset = parseReportedSessionReset(text, observedAt);
  const sevenDayReset = parseReportedWeeklyReset(text, observedAt);
  if (fiveHourUsed === null || sevenDayUsed === null || !sevenDayReset) throw new TypeError('Claude /usage quota fields were not observed');
  return {
    provider: 'claude',
    product: 'Claude Code',
    metricClass: 'subscription_quota',
    authority: 'authenticated Claude Code /usage limits view',
    collectionMode: 'interactive_cli_usage',
    adapterVersion: '1.0.0',
    sourceVersion: 'claude-usage-cli',
    observedAt,
    state: 'fresh',
    windows: [
      {
        id: 'five_hour', label: '5-hour window', usedPercent: fiveHourUsed,
        resetsAt: fiveHourReset || new Date(observedMs + FIVE_HOURS_MS).toISOString(),
        resetKind: fiveHourReset ? 'provider_reported' : 'estimated_window_end',
      },
      {
        id: 'seven_day', label: '7-day window', usedPercent: sevenDayUsed,
        resetsAt: sevenDayReset, resetKind: 'provider_reported',
      },
    ],
  };
}

export function shouldRefreshClaudeUsage(record, now = new Date().toISOString()) {
  const nowMs = Date.parse(now);
  const observedMs = Date.parse(record?.observedAt);
  if (!Number.isFinite(nowMs)) throw new TypeError('now must be an ISO timestamp');
  const reportedResetPassed = Array.isArray(record?.windows) && record.windows.some((window) => {
    const resetMs = Date.parse(window?.resetsAt);
    return Number.isFinite(resetMs) && resetMs <= nowMs;
  });
  return reportedResetPassed || !Number.isFinite(observedMs) || nowMs - observedMs >= CLAUDE_USAGE_REFRESH_AFTER_MS;
}

export async function refreshClaudeUsageCache({
  readRecord,
  runUsage,
  writeRecord,
  now = new Date().toISOString(),
}) {
  let prior = null;
  try {
    prior = await readRecord();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (!shouldRefreshClaudeUsage(prior, now)) return { outcome: 'skipped_recent' };
  const transcript = await runUsage();
  const record = normalizeClaudeUsageTranscript(transcript, now);
  await writeRecord(record);
  return { outcome: 'updated', record };
}

export function buildClaudeUsageExpectProgram() {
  return String.raw`log_user 1
set timeout 20
set mcp $env(ACC_CLAUDE_EMPTY_MCP)
set command "exec /usr/local/bin/claude --setting-sources user --tools \"\" --permission-mode dontAsk --safe-mode --strict-mcp-config --mcp-config \"$mcp\""
spawn -noecho /bin/zsh -lic $command
proc cleanup_spawn {} {
  catch {send -- "\003"}
  after 500
  catch {close}
  catch {wait}
}
expect {
  -re {(?i)(trust this folder|yes, i trust|sign in|log in|permission|select.*theme|first.?launch)} { cleanup_spawn; puts "acc_claude_usage_outcome=blocked_by_user_owned_dialog"; exit 20 }
  -re {❯|>} { after 1200; send -- "/usage\r" }
  eof { puts "acc_claude_usage_outcome=child_exited_before_usage"; exit 22 }
  timeout { send -- "/usage\r" }
}
set timeout 60
expect {
  -re {(?i)Current} {}
  -re {(?i)(trust this folder|sign in|log in|permission)} { cleanup_spawn; puts "acc_claude_usage_outcome=blocked_by_user_owned_dialog"; exit 20 }
  eof { puts "acc_claude_usage_outcome=child_exited_before_quota"; exit 22 }
  timeout { cleanup_spawn; puts "acc_claude_usage_outcome=quota_timeout"; exit 22 }
}
set timeout 25
expect {
  -re {(?i)week} {}
  eof { puts "acc_claude_usage_outcome=child_exited_before_weekly_quota"; exit 22 }
  timeout { cleanup_spawn; puts "acc_claude_usage_outcome=weekly_quota_timeout"; exit 22 }
}
set timeout 25
expect {
  -re {(?i)Resets} {}
  eof { puts "acc_claude_usage_outcome=child_exited_before_reset"; exit 22 }
  timeout { cleanup_spawn; puts "acc_claude_usage_outcome=reset_timeout"; exit 22 }
}
after 1200
send -- "\033"
after 1200
send -- "/exit\r"
set timeout 10
expect {
  eof { puts "acc_claude_usage_outcome=completed"; exit 0 }
  timeout { cleanup_spawn; puts "acc_claude_usage_outcome=completed_forced_cleanup"; exit 0 }
}`;
}
