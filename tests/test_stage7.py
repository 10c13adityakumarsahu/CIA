"""
Stage 7 Acceptance Tests:
- UI artifacts verification
- Fixtures and Mock API server validation
- Offline REPLAY mode serving full Scenario A and B flows
"""
from pathlib import Path
from fastapi.testclient import TestClient
from fixtures.mock_server import app as mock_app
from culprit.api import app as real_app

def test_ui_files_structure():
    ui_dir = Path(__file__).resolve().parent.parent / "ui"
    assert (ui_dir / "package.json").exists(), "ui/package.json missing"
    assert (ui_dir / "src" / "App.tsx").exists(), "ui/src/App.tsx missing"
    assert (ui_dir / "src" / "components" / "Header.tsx").exists()
    assert (ui_dir / "src" / "components" / "LeftSidebar.tsx").exists()
    assert (ui_dir / "src" / "components" / "MetricsChart.tsx").exists()
    assert (ui_dir / "src" / "components" / "InvestigationFeed.tsx").exists()
    assert (ui_dir / "src" / "components" / "AttackPathGraph.tsx").exists()
    assert (ui_dir / "src" / "components" / "BlastRadiusGraph.tsx").exists()
    assert (ui_dir / "src" / "components" / "FindingsRail.tsx").exists()
    assert (ui_dir / "src" / "components" / "MitigationView.tsx").exists()
    assert (ui_dir / "src" / "components" / "CitationDrawer.tsx").exists()
    assert (ui_dir / "src" / "components" / "CitationChip.tsx").exists()

def test_mock_server_endpoints():
    client = TestClient(mock_app)

    # State & health
    r = client.get("/health")
    assert r.status_code == 200 and r.json().get("status") == "ok"

    r = client.get("/api/state")
    assert r.status_code == 200
    state = r.json()
    assert state.get("mode") == "REPLAY"

    # Metrics
    r = client.get("/api/metrics")
    assert r.status_code == 200

    # Findings
    r = client.get("/api/findings")
    assert r.status_code == 200
    findings = r.json()
    assert len(findings) > 0

    # Graph
    r = client.get("/api/graph")
    assert r.status_code == 200
    graph = r.json()
    assert "nodes" in graph and "edges" in graph

    # Source
    r = client.get("/api/source?path=target_app/v1.5.0/app.py&start=1&end=20")
    assert r.status_code == 200
    assert "content" in r.json()

    # Log
    r = client.get("/api/logs/LOG-0001")
    assert r.status_code == 200
    assert r.json().get("id") == "LOG-0001"

    # Ledger
    r = client.get("/api/ledger")
    assert r.status_code == 200
    assert len(r.json()) >= 3

    # Scenario trigger
    r = client.post("/api/scenario/a_exploit/start")
    assert r.status_code == 200

    # Mitigation preview, execute, undo
    r = client.post("/api/mitigation/preview", json={"action": "block_rule", "params": {"route": "/api/orders", "field": "sku", "regex": "sleep"}})
    assert r.status_code == 200
    assert "diff" in r.json()
    assert len(r.json().get("preconditions", [])) > 0

    r = client.post("/api/mitigation/execute", json={"action": "block_rule", "params": {"route": "/api/orders"}})
    assert r.status_code == 200
    mit_id = r.json().get("id")
    assert mit_id is not None

    r = client.post(f"/api/mitigation/{mit_id}/undo")
    assert r.status_code == 200

def test_replay_mode_full_scenario_runs(monkeypatch):
    monkeypatch.setenv("CULPRIT_MODE", "REPLAY")
    client = TestClient(real_app)

    # Test Scenario A offline flow
    r = client.post("/api/scenario/a_exploit/start")
    assert r.status_code == 200

    r = client.post("/api/investigate")
    assert r.status_code == 200
    run_id = r.json().get("run_id")

    # Stream scenario A
    with client.stream("GET", f"/api/investigate/{run_id}/stream") as response:
        content = response.read().decode("utf-8")
        assert "tool_call" in content
        assert "report" in content
        assert "exploit" in content

    # Test Scenario B offline flow
    r = client.post("/api/scenario/b_regression/start")
    assert r.status_code == 200

    r = client.post("/api/investigate")
    assert r.status_code == 200
    run_id_b = r.json().get("run_id")

    with client.stream("GET", f"/api/investigate/{run_id_b}/stream") as response:
        content = response.read().decode("utf-8")
        assert "tool_call" in content
        assert "report" in content
        assert "regression" in content
