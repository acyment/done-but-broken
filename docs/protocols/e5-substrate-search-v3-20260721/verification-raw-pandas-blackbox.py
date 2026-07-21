# Black-box scenario: public API only (pd.DataFrame / Series.idxmax / idxmin).
# A nullable-UInt64 column with values above 2**53 and one missing value.
# Correct behavior: idxmax names the row holding the true maximum.
# Silent failure mode (culprit present, fix absent): float64 promotion collapses
# 2**53+2 vs 2**53+3, and the sentinel fill perturbs the comparison -> wrong row,
# no exception, no warning.
import sys

import pandas as pd

df = pd.DataFrame(
    {"v": pd.array([2**63 + 1, 2**63 + 3, 2**63 + 2, None], dtype="UInt64")},
    index=["row_lo", "row_hi", "row_mid", "row_na"],
)
mx = df.idxmax()["v"]
mn = df.idxmin()["v"]
ok = mx == "row_hi" and mn == "row_lo"
print(f"pandas={pd.__version__} idxmax={mx!r} idxmin={mn!r} -> {'CORRECT' if ok else 'WRONG (silent)'}")
sys.exit(0 if ok else 1)
