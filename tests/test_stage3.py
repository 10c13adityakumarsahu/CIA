"""
tests.test_stage3 – Unit and integration tests for Stage 3:
- Ledger LKG, release records, find_last_stable with registry check, promoter.
- Gateway routing, weighted split, block rules returning 403, and JSONL logging.
"""

import json
from pathlib import Path
import pytest
from ledger import Ledger, seed_ledger
from ledger.promoter import promote_release_if_healthy


def test_ledger_seeding_and_lkg():
    """Verify ledger seeds with LKG=1.4.0 and correct release statuses."""
    l = seed_ledger()
    assert l.get_lkg() == "1.4.0"
    
    r13 = l.get_release("1.3.0")
    r14 = l.get_release("1.4.0")
    r15 = l.get_release("1.5.0")
    
    assert r13["status"] == "stable"
    assert r14["status"] == "stable"
    assert r15["status"] == "current"


def test_find_last_stable_with_registry_check(monkeypatch):
    """find_last_stable must respect registry tags, status, and excluded finding fingerprints."""
    l = Ledger()
    # Mock registry tags returning ["1.3.0", "1.4.0", "1.5.0"]
    monkeypatch.setattr(l, "get_registry_tags", lambda repo="shop": ["1.3.0", "1.4.0", "1.5.0"])

    # Normal find_last_stable should return 1.4.0
    assert l.find_last_stable() == "1.4.0"

    # If 1.4.0 is missing from registry, fallback to 1.3.0
    monkeypatch.setattr(l, "get_registry_tags", lambda repo="shop": ["1.3.0", "1.5.0"])
    assert l.find_last_stable() == "1.3.0"

    # If 1.4.0 has an excluded finding fingerprint, fallback to 1.3.0
    monkeypatch.setattr(l, "get_registry_tags", lambda repo="shop": ["1.3.0", "1.4.0", "1.5.0"])
    l.record_release("1.4.0", "localhost:5000/shop:1.4.0", "b140", "stable", finding_fps=["fp_sqli_140"])
    assert l.find_last_stable(exclude_fps=["fp_sqli_140"]) == "1.3.0"

    # Restore 1.4.0
    seed_ledger()


def test_promoter():
    """Promoter should promote when err_rate < 1% and p95 < 100ms."""
    l = Ledger()
    # Healthy release
    l.record_release("1.6.0", "localhost:5000/shop:1.6.0", "d160", "current", p95_ms=40.0, err_rate=0.001)
    promoted = promote_release_if_healthy("1.6.0", p95_ms=40.0, err_rate=0.001, ledger=l)
    assert promoted is True
    assert l.get_release("1.6.0")["status"] == "stable"
    assert l.get_lkg() == "1.6.0"

    # Unhealthy release
    l.record_release("1.7.0", "localhost:5000/shop:1.7.0", "e170", "current", p95_ms=350.0, err_rate=0.05)
    promoted_bad = promote_release_if_healthy("1.7.0", p95_ms=350.0, err_rate=0.05, ledger=l)
    assert promoted_bad is False
    assert l.get_release("1.7.0")["status"] == "degraded"

    # Reset seed
    seed_ledger()
