# E1 Step 0 Stability Gate Record (v0)

Date: 2026-06-10. Gate: 10 consecutive green full-suite runs on two clean environments with the same pinned Bun version, zero quarantined tests, no exclusion list.

Suite state under test: commit `cb017a0` (335 tests, 42 files — post A1–A4/B1, isolated clone so concurrent development could not contaminate the runs). Bun version: 1.3.14 in both environments. Install: `bun install --frozen-lockfile`.

| Environment | Runs | Result |
| --- | --- | --- |
| macOS local (Darwin 25.5.0, Apple Silicon) | 10 consecutive `bun test` | 10/10 green, 335 pass / 0 fail each run |
| Ubuntu container `oven/bun:1.3.14` (clean copy, fresh install) | 10 consecutive `bun test` | 10/10 green, 335 pass / 0 fail each run (~14s per run) |

Notes:

- No real-clock sleeps in the suite; timeout behavior is tested through injected limits.
- The known `EAGAIN` process-spawn flake mitigation (bounded `posix_spawn` retry for spawned visible-feedback checks, recorded 2026-06-10) did not trigger any failure during the gate.
- Zero quarantined tests; no exclusion list.

Gate status: **passed** for the Step 0 go-gate item "full suite green on 10 consecutive runs on macOS and Ubuntu with the same Bun version".
