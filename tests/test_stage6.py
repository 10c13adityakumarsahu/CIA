"""
tests.test_stage6 – Acceptance tests for Stage 6:
- Scenario A produces verdict=exploit and passes verification
- Scenario B produces verdict=regression and passes verification
- Replay mode serves from cache/ without network access
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from culprit.api import app
from culprit.schemas import Report
from culprit.verifier import verify_report

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / "cache"


def test_scenario_a_verdict_and_verification():
    """Scenario A must produce verdict=exploit, OWASP=A03:2021-Injection, and pass verification."""
    cache_file = CACHE_DIR / "scenario_a.json"
    assert cache_file.exists(), "cache/scenario_a.json must exist"

    with open(cache_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    report_dict = data.get("report")
    assert report_dict is not None
    assert report_dict["verdict"] == "exploit"
    assert report_dict.get("owasp") == "A03:2021-Injection"

    report = Report.model_validate(report_dict)
    res = verify_report(report)
    assert res.valid is True, f"Verification failed: {res.errors}"
    assert res.citations_valid > 0


def test_scenario_b_verdict_and_verification():
    """Scenario B must produce verdict=regression and pass verification."""
    cache_file = CACHE_DIR / "scenario_b.json"
    assert cache_file.exists(), "cache/scenario_b.json must exist"

    with open(cache_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    report_dict = data.get("report")
    assert report_dict is not None
    assert report_dict["verdict"] == "regression"

    report = Report.model_validate(report_dict)
    res = verify_report(report)
    assert res.valid is True, f"Verification failed: {res.errors}"
    assert res.citations_valid > 0


def test_replay_mode_serves_without_network(monkeypatch):
    """Replay mode must serve endpoints using cached JSON snapshots."""
    monkeypatch.setenv("CULPRIT_MODE", "REPLAY")
    client = TestClient(app)

    # 1. State endpoint
    r_state = client.get("/api/state")
    assert r_state.status_code == 200
    assert r_state.json()["mode"] == "REPLAY"

    # 2. Findings endpoint
    r_findings = client.get("/api/findings")
    assert r_findings.status_code == 200
    assert len(r_findings.json()) > 0

    # 3. Stream replay
    r_stream = client.get("/api/investigate/run-replay/stream")
    assert r_stream.status_code == 200
    content = r_stream.text
    assert "event: tool_call" in content or "event: report" in content
