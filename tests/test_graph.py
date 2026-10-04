"""
tests.test_graph – Unit tests for Stage 4 Neo4j graph queries and data reach analysis:
- data_reach(SQLi finding) includes orders route and customers/payments via DBRole
- shared_resource('/api/orders') includes /api/products
- version_contains shows SQLi in 1.3.0, 1.4.0, 1.5.0 and not N+1
"""

from pathlib import Path
import pytest
from graph.ingest import ingest_graph, get_neo4j_driver
from graph.queries import data_reach, shared_resource, version_contains


@pytest.fixture(scope="module", autouse=True)
def setup_graph():
    repo_root = Path(__file__).resolve().parent.parent
    driver = get_neo4j_driver()
    ingest_graph(driver, repo_root)
    yield
    driver.close()


def test_data_reach_sqli():
    """data_reach(SQLi finding) includes orders route, direct tables, and customers/payments via DBRole."""
    # Finding SAST-002 is the SQLi finding
    reach = data_reach("SAST-002")
    nodes = reach.get("nodes", [])
    node_ids = {n["id"] for n in nodes}
    labels = {n["label"] for n in nodes}

    # Must contain finding, function, and route
    assert any("SAST-002" in nid for nid in node_ids)
    assert "fn:create_order" in node_ids
    assert "route:/api/orders" in node_ids

    # Must contain DBRole and sensitive tables (customers with pii, payments with financial)
    assert "dbrole:app_rw" in node_ids
    assert "table:customers" in node_ids
    assert "table:payments" in node_ids
    assert "table:products" in node_ids

    # Check sensitivities
    customers_node = next(n for n in nodes if n["id"] == "table:customers")
    payments_node = next(n for n in nodes if n["id"] == "table:payments")
    assert customers_node["props"].get("sensitivity") == "pii"
    assert payments_node["props"].get("sensitivity") == "financial"

    # Edges must include LOCATED_IN, HANDLED_BY, CAN_READ
    edge_types = {e["type"] for e in reach.get("edges", [])}
    assert "LOCATED_IN" in edge_types
    assert "HANDLED_BY" in edge_types
    assert "CAN_READ" in edge_types


def test_shared_resource_orders():
    """shared_resource('/api/orders') includes other routes using the postgres pool (e.g. /api/products)."""
    shared = shared_resource("/api/orders")
    nodes = shared.get("nodes", [])
    node_ids = {n["id"] for n in nodes}

    assert "pool:postgres" in node_ids
    assert "route:/api/orders" in node_ids
    assert "route:/api/products" in node_ids
    assert "route:/health" in node_ids

    # Edges must include USES
    edge_types = {e["type"] for e in shared.get("edges", [])}
    assert "USES" in edge_types
    assert "HANDLED_BY" in edge_types


def test_version_contains_sqli():
    """version_contains shows SQLi in 1.3.0, 1.4.0, 1.5.0 and not N+1."""
    for ver in ["1.3.0", "1.4.0", "1.5.0"]:
        res = version_contains(["SAST-002"], ver)
        nodes = res.get("nodes", [])
        node_ids = {n["id"] for n in nodes}
        assert any("SAST-002" in nid for nid in node_ids), f"SAST-002 missing in version {ver}"
        assert f"version:{ver}" in node_ids

    # N+1 is not a finding
    all_findings_in_150 = version_contains(["N+1", "PERF-001", "SAST-999"], "1.5.0")
    assert len(all_findings_in_150.get("nodes", [])) == 0
