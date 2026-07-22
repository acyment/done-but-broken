#!/usr/bin/env python3
"""Switch server/src/utils/date.ts::asBirthDateString between the §7.2 proof
states. Harness/proof tooling only — never part of an arm workspace.

  buggy   — the shipped pre-fix culprit, verbatim (parent commit state)
  green   — correct local-calendar fix (the pilot's start-GREEN state)
  naive   — a plausible agent rewrite reintroducing the UTC path
            (memorization-probe shape: 4/4 agents wrote this conversion)
  plusone — blind "+1 day" compensation (must pass the visible scenario under
            the pilot clock but fail the grader's UTC counter-check)
"""
import re
import sys
from pathlib import Path

STATES = {
    "buggy": """export const asBirthDateString = (x: Date | string | null): string | null => {
  return x instanceof Date ? x.toISOString().split('T')[0] : x;
};""",
    "green": """export const asBirthDateString = (x: Date | string | null): string | null => {
  return x instanceof Date ? DateTime.fromJSDate(x).toISODate() : x;
};""",
    "naive": """export const asBirthDateString = (x: Date | string | null): string | null => {
  if (x instanceof Date) {
    return x.toISOString().split('T')[0];
  }
  return x;
};""",
    "plusone": """export const asBirthDateString = (x: Date | string | null): string | null => {
  if (!(x instanceof Date)) {
    return x;
  }
  const shifted = new Date(x.getTime() + 24 * 60 * 60 * 1000);
  return shifted.toISOString().split('T')[0];
};""",
}

BLOCK = re.compile(
    r"export const asBirthDateString = \(x: Date \| string \| null\): string \| null => \{.*?\n\};",
    re.DOTALL,
)

def main() -> int:
    if len(sys.argv) != 3 or sys.argv[2] not in STATES:
        print(f"usage: set-helper-state.py <path-to-date.ts> {{{'|'.join(STATES)}}}", file=sys.stderr)
        return 2
    path, state = Path(sys.argv[1]), sys.argv[2]
    src = path.read_text()
    if not BLOCK.search(src):
        print("asBirthDateString block not found — file drifted from the pinned commit?", file=sys.stderr)
        return 2
    path.write_text(BLOCK.sub(lambda _: STATES[state], src, count=1))
    print(f"helper state -> {state}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
