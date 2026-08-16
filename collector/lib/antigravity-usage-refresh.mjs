export function buildAntigravityUsageExpectProgram() {
  return String.raw`log_user 0
set timeout 15
spawn -noecho sh -lc "cd -- \"$env(ACC_AGY_PROBE_CWD)\" && exec agy"
expect {
  -re {(?i)(trust this folder|yes, i trust|sign in|log in|permission|select.*theme|first.?launch)} { puts "blocked_by_user_owned_dialog"; exit 0 }
  timeout { send -- "/usage\r" }
}
after 8000
send -- "\033"
after 2000
send -- "\003"
set timeout 15
expect {
  eof { puts "completed" }
  timeout { puts "exit_not_confirmed" }
}`;
}
