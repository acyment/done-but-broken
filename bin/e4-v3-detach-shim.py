#!/usr/bin/env python3
# e4 v3 detached-launch shim — the headless-correct evidence-run launcher validated at v3-M5
# (docs/e4/E4V3-M5-BUDGET-CALIBRATION-NOTES.md "Launch procedure") and sealed by the v3-M6
# pre-registration §6. It makes the run process its own session leader so no interactive
# session's context clear, task reaping, or group kill can reach it (the v2-M8 void-run lesson
# made binding, without the tty that `bash -m` job control needs).
#
# Usage (the launch call must contain NOTHING else and return immediately):
#   bash -c 'nohup python3 bin/e4-v3-detach-shim.py <repo-root> <pid-file> <cmd> [args...] \
#     </dev/null >>seed-N.log 2>&1 &'
#
# The shim: setsid()s (own session + process group), chdirs to the repo (Bun auto-loads .env
# there; a relative PID-file path resolves under the repo root), writes the PID file, then
# execvp()s the real command — so the recorded PID *is* the run process (execvp preserves it).
# Headless-correct verification, from a separate call:
# pgid == pid and PPID == 1; liveness via `kill -0 $(cat pid-file)`; progress via files only.
import os
import sys

if len(sys.argv) < 4:
    sys.stderr.write("usage: e4-v3-detach-shim.py <repo-root> <pid-file> <cmd> [args...]\n")
    sys.exit(2)

repo_root, pid_file = sys.argv[1], sys.argv[2]
command = sys.argv[3:]

os.setsid()
os.chdir(repo_root)
with open(pid_file, "w") as handle:
    handle.write(f"{os.getpid()}\n")
os.execvp(command[0], command)
