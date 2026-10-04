"""
ledger.promoter – Checks deployment rolling metrics and promotes 'current' to 'stable' (and updates LKG)
when err_rate < 1% (0.01) and p95 < SLO (default 100ms).
"""

import sys
from typing import Optional
from ledger import Ledger, get_redis_client


def promote_release_if_healthy(
    version: str,
    p95_ms: float,
    err_rate: float,
    slo_p95_ms: float = 100.0,
    max_err_rate: float = 0.01,
    ledger: Optional[Ledger] = None,
) -> bool:
    """Check if release meets SLO criteria and promote if healthy."""
    l = ledger or Ledger()
    rel = l.get_release(version)
    if not rel:
        print(f"Release {version} not found in ledger")
        return False

    is_healthy = (err_rate < max_err_rate) and (p95_ms < slo_p95_ms)
    if is_healthy:
        l.set_status(version, "stable")
        l.set_lkg(version)
        print(f"Promoted {version} to STABLE and set as LKG (p95={p95_ms:.1f}ms, err={err_rate*100:.2f}%)")
        return True
    else:
        l.set_status(version, "degraded")
        print(f"Release {version} did NOT meet SLO (p95={p95_ms:.1f}ms vs {slo_p95_ms}ms, err={err_rate*100:.2f}% vs {max_err_rate*100:.1f}%) -> marked DEGRADED")
        return False


if __name__ == "__main__":
    ver = sys.argv[1] if len(sys.argv) > 1 else "1.5.0"
    p95 = float(sys.argv[2]) if len(sys.argv) > 2 else 50.0
    err = float(sys.argv[3]) if len(sys.argv) > 3 else 0.001
    promote_release_if_healthy(ver, p95, err)
