#!/usr/bin/env python3
"""Refresh Antigravity's documented status-line quota event without a model turn."""

import json
import os
import pty
import select
import signal
import subprocess
import sys
import time
from pathlib import Path


def read_record(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def stop_process_group(process: subprocess.Popen) -> None:
    for sig, delay in ((signal.SIGINT, 0.4), (signal.SIGTERM, 0.4), (signal.SIGKILL, 0.0)):
        if process.poll() is not None:
            return
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            return
        if delay:
            time.sleep(delay)
    process.wait(timeout=1)


def main() -> int:
    if len(sys.argv) != 2:
        return 2
    cache_path = Path(sys.argv[1])
    try:
        before = read_record(cache_path).get("observedAt")
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        before = None

    master, slave = pty.openpty()
    process = subprocess.Popen(
        ["/opt/homebrew/bin/agy"],
        stdin=slave,
        stdout=slave,
        stderr=slave,
        cwd=str(Path.home()),
        start_new_session=True,
    )
    os.close(slave)
    deadline = time.monotonic() + 3.0
    try:
        while time.monotonic() < deadline and process.poll() is None:
            readable, _, _ = select.select([master], [], [], 0.2)
            if readable:
                try:
                    os.read(master, 8192)  # Drain without logging account or UI content.
                except OSError:
                    break
    finally:
        stop_process_group(process)
        os.close(master)

    try:
        after = read_record(cache_path)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return 1
    return 0 if (
        after.get("provider") == "antigravity"
        and after.get("state") == "fresh"
        and after.get("observedAt")
        and after.get("observedAt") != before
        and bool(after.get("windows"))
    ) else 1


if __name__ == "__main__":
    raise SystemExit(main())
