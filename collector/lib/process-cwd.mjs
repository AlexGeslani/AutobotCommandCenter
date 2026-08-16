export function lsofWorkingDirectoryCommand(pid) {
  return ['/usr/sbin/lsof', '-a', '-p', String(pid), '-d', 'cwd', '-Fn'];
}
