"""
graph.ingest – Ingests the application code graph, infrastructure manifest, and normalized findings into Neo4j.

Nodes:
  - Gateway
  - Route {path}
  - Function {name, file, line}
  - Table {name, sensitivity: pii | financial | none}
  - DBRole {name}
  - Pool {name, max}
  - Version {ver, status}
  - Finding {id, fp, severity, title}

Edges:
  - Gateway-ROUTES_TO->Route
  - Route-HANDLED_BY->Function
  - Function-READS|WRITES->Table
  - Function-USES->Pool
  - DBRole-CAN_READ->Table
  - Finding-LOCATED_IN->Function
  - Version-CONTAINS->Finding
"""

import ast
import json
import os
from pathlib import Path
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from neo4j import GraphDatabase, Driver
from culprit.normalize import load_all_findings, Finding

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_AUTH = None if os.environ.get("NEO4J_AUTH", "none") == "none" else ("neo4j", os.environ.get("NEO4J_PASSWORD", "password"))


def get_neo4j_driver(uri: str = NEO4J_URI) -> Driver:
    return GraphDatabase.driver(uri, auth=NEO4J_AUTH)


class CodeASTVisitor(ast.NodeVisitor):
    def __init__(self, filepath: str):
        self.filepath = filepath.replace("\\", "/")
        self.functions: List[Dict[str, Any]] = []
        self.routes: List[Dict[str, Any]] = []

    def visit_FunctionDef(self, node: ast.FunctionDef):
        fn_name = node.name
        fn_line = node.lineno
        
        # Check decorators for FastAPI routes
        route_path = None
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call):
                if isinstance(dec.func, ast.Attribute) and dec.func.attr in ("get", "post", "put", "delete", "patch"):
                    if dec.args and isinstance(dec.args[0], ast.Constant):
                        route_path = dec.args[0].value

        # Inspect AST body for SQL tables read/written
        reads_tables: Set[str] = set()
        writes_tables: Set[str] = set()
        uses_pool = False

        for subnode in ast.walk(node):
            if isinstance(subnode, ast.Call):
                if isinstance(subnode.func, ast.Name) and subnode.func.id in ("get_conn", "get_pool"):
                    uses_pool = True
                if isinstance(subnode.func, ast.Attribute) and subnode.func.attr == "execute":
                    uses_pool = True

            # Extract SQL queries from string constants / joined strings
            if isinstance(subnode, ast.Constant) and isinstance(subnode.value, str):
                s = subnode.value.lower()
                self._extract_tables_from_sql(s, reads_tables, writes_tables)
            elif isinstance(subnode, ast.JoinedStr):
                # f-string
                raw_parts = []
                for val in subnode.values:
                    if isinstance(val, ast.Constant) and isinstance(val.value, str):
                        raw_parts.append(val.value)
                s = " ".join(raw_parts).lower()
                self._extract_tables_from_sql(s, reads_tables, writes_tables)

        fn_data = {
            "name": fn_name,
            "file": self.filepath,
            "line": fn_line,
            "route": route_path,
            "reads_tables": list(reads_tables),
            "writes_tables": list(writes_tables),
            "uses_pool": uses_pool,
        }
        self.functions.append(fn_data)
        if route_path:
            self.routes.append({
                "path": route_path,
                "function": fn_name,
            })
        self.generic_visit(node)

    def _extract_tables_from_sql(self, sql: str, reads: Set[str], writes: Set[str]):
        known_tables = ["customers", "products", "orders", "payments", "inventory", "schema_version"]
        for tbl in known_tables:
            if re.search(rf"\bfrom\s+{tbl}\b", sql) or re.search(rf"\bjoin\s+{tbl}\b", sql):
                reads.add(tbl)
            if re.search(rf"\binsert\s+into\s+{tbl}\b", sql) or re.search(rf"\bupdate\s+{tbl}\b", sql) or re.search(rf"\bdelete\s+from\s+{tbl}\b", sql):
                writes.add(tbl)


def parse_target_app_code(base_dir: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Parse target_app v1.5.0 code to extract functions and routes."""
    main_py = base_dir / "target_app" / "v1.5.0" / "main.py"
    legacy_py = base_dir / "target_app" / "v1.5.0" / "legacy_helper.py"

    all_functions = []
    all_routes = []

    for fpath in [main_py, legacy_py]:
        if fpath.exists():
            code = fpath.read_text(encoding="utf-8")
            tree = ast.parse(code, filename=str(fpath))
            visitor = CodeASTVisitor(str(fpath.relative_to(base_dir)))
            visitor.visit(tree)
            all_functions.extend(visitor.functions)
            all_routes.extend(visitor.routes)

    return all_functions, all_routes


def ingest_graph(driver: Driver, repo_root: Path):
    """Ingest full graph idempotently into Neo4j."""
    functions, routes = parse_target_app_code(repo_root)
    findings_dir = repo_root / "findings"
    findings = load_all_findings(findings_dir)

    with driver.session() as session:
        # Clear existing graph
        session.run("MATCH (n) DETACH DELETE n")

        # 1. Gateway node
        session.run("CREATE (g:Gateway {id: 'gateway', name: 'Gateway', port: 8080})")

        # 2. Connection Pool node
        session.run("CREATE (p:Pool {id: 'pool:postgres', name: 'postgres_pool', max: 5})")

        # 3. DBRole node & Tables
        tables = [
            {"name": "customers", "sensitivity": "pii"},
            {"name": "payments", "sensitivity": "financial"},
            {"name": "products", "sensitivity": "none"},
            {"name": "orders", "sensitivity": "none"},
            {"name": "inventory", "sensitivity": "none"},
            {"name": "schema_version", "sensitivity": "none"},
        ]
        session.run("CREATE (r:DBRole {id: 'dbrole:app_rw', name: 'app_rw'})")

        for t in tables:
            session.run(
                "CREATE (tbl:Table {id: $id, name: $name, sensitivity: $sensitivity})",
                id=f"table:{t['name']}",
                name=t["name"],
                sensitivity=t["sensitivity"],
            )
            # DBRole can read all operational tables
            session.run(
                "MATCH (r:DBRole {id: 'dbrole:app_rw'}), (tbl:Table {id: $id}) "
                "CREATE (r)-[:CAN_READ]->(tbl)",
                id=f"table:{t['name']}",
            )

        # 4. Route nodes & Gateway -> Route
        for r in routes:
            route_id = f"route:{r['path']}"
            session.run(
                "MERGE (rt:Route {id: $id, path: $path}) "
                "WITH rt "
                "MATCH (g:Gateway {id: 'gateway'}) "
                "MERGE (g)-[:ROUTES_TO]->(rt)",
                id=route_id,
                path=r["path"],
            )

        # 5. Function nodes & Edges (Route -> Function, Function -> Table, Function -> Pool)
        for fn in functions:
            fn_id = f"fn:{fn['name']}"
            session.run(
                "CREATE (f:Function {id: $id, name: $name, file: $file, line: $line})",
                id=fn_id,
                name=fn["name"],
                file=fn["file"],
                line=fn["line"],
            )

            if fn["route"]:
                session.run(
                    "MATCH (rt:Route {id: $route_id}), (f:Function {id: $fn_id}) "
                    "CREATE (rt)-[:HANDLED_BY]->(f)",
                    route_id=f"route:{fn['route']}",
                    fn_id=fn_id,
                )

            if fn["uses_pool"]:
                session.run(
                    "MATCH (f:Function {id: $fn_id}), (p:Pool {id: 'pool:postgres'}) "
                    "CREATE (f)-[:USES]->(p)",
                    fn_id=fn_id,
                )

            for t_read in fn["reads_tables"]:
                session.run(
                    "MATCH (f:Function {id: $fn_id}), (tbl:Table {id: $t_id}) "
                    "CREATE (f)-[:READS]->(tbl)",
                    fn_id=fn_id,
                    t_id=f"table:{t_read}",
                )

            for t_write in fn["writes_tables"]:
                session.run(
                    "MATCH (f:Function {id: $fn_id}), (tbl:Table {id: $t_id}) "
                    "CREATE (f)-[:WRITES]->(tbl)",
                    fn_id=fn_id,
                    t_id=f"table:{t_write}",
                )

        # 6. Version nodes
        versions = [
            {"ver": "1.3.0", "status": "stable"},
            {"ver": "1.4.0", "status": "stable"},
            {"ver": "1.5.0", "status": "current"},
        ]
        for v in versions:
            session.run(
                "CREATE (ver:Version {id: $id, ver: $ver, status: $status})",
                id=f"version:{v['ver']}",
                ver=v["ver"],
                status=v["status"],
            )

        # 7. Findings & Edges (Finding -> Function, Version -> Finding)
        for f in findings:
            finding_node_id = f"finding:{f.id}"
            session.run(
                "CREATE (f:Finding {id: $id, finding_id: $finding_id, fp: $fp, severity: $severity, title: $title, source: $source})",
                id=finding_node_id,
                finding_id=f.id,
                fp=f.fingerprint,
                severity=f.severity,
                title=f.title,
                source=f.source,
            )

            # Link Version -[:CONTAINS]-> Finding
            for v_str in f.present_in:
                session.run(
                    "MATCH (ver:Version {ver: $ver}), (f:Finding {id: $f_id}) "
                    "CREATE (ver)-[:CONTAINS]->(f)",
                    ver=v_str,
                    f_id=finding_node_id,
                )

            # Link Finding -[:LOCATED_IN]-> Function
            target_fn = None
            if "legacy_helper.py" in f.location:
                if "hash" in f.title.lower() or "md5" in f.detail.lower():
                    target_fn = "weak_hash"
                else:
                    target_fn = "run_shell"
            elif "main.py" in f.location:
                if "sql" in f.title.lower() or "orders" in f.location.lower():
                    target_fn = "create_order"
                elif "product" in f.location.lower():
                    target_fn = "list_products"
                elif "payment" in f.location.lower():
                    target_fn = "get_payment"
                elif "health" in f.location.lower():
                    target_fn = "health"
            elif f.source == "dast":
                if "orders" in f.location:
                    target_fn = "create_order"
                elif "products" in f.location:
                    target_fn = "list_products"
                elif "payments" in f.location:
                    target_fn = "get_payment"

            if target_fn:
                session.run(
                    "MATCH (f:Finding {id: $f_id}), (fn:Function {name: $fn_name}) "
                    "CREATE (f)-[:LOCATED_IN]->(fn)",
                    f_id=finding_node_id,
                    fn_name=target_fn,
                )

        count = session.run("MATCH (n) RETURN count(n) AS c").single()["c"]
        print(f"Ingested graph successfully. Total nodes in Neo4j: {count}")


def main():
    repo_root = Path(__file__).resolve().parent.parent
    driver = get_neo4j_driver()
    try:
        ingest_graph(driver, repo_root)
    finally:
        driver.close()


if __name__ == "__main__":
    main()
