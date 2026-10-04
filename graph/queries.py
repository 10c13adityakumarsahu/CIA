"""
graph.queries – Parameterized read-only Cypher query templates returning uniform graph JSON:
{
    "nodes": [{"id": str, "label": str, "props": dict}],
    "edges": [{"from": str, "to": str, "type": str}]
}
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_AUTH = None if os.environ.get("NEO4J_AUTH", "none") == "none" else ("neo4j", os.environ.get("NEO4J_PASSWORD", "password"))


def get_driver(uri: str = NEO4J_URI) -> Driver:
    return GraphDatabase.driver(uri, auth=NEO4J_AUTH)


def _format_subgraph(records: List[Any]) -> Dict[str, Any]:
    nodes_map: Dict[str, Dict[str, Any]] = {}
    edges_list: List[Dict[str, str]] = []
    edges_seen: set = set()

    for record in records:
        for val in record.values():
            if val is None:
                continue
            # Single Node
            if hasattr(val, "labels") and hasattr(val, "element_id"):
                nid = val.get("id", str(val.element_id))
                label = list(val.labels)[0] if val.labels else "Node"
                props = dict(val.items())
                nodes_map[nid] = {"id": nid, "label": label, "props": props}
            # Relationship / Edge
            elif hasattr(val, "type") and hasattr(val, "start_node") and hasattr(val, "end_node"):
                start_id = val.start_node.get("id", str(val.start_node.element_id))
                end_id = val.end_node.get("id", str(val.end_node.element_id))
                edge_key = (start_id, end_id, val.type)
                if edge_key not in edges_seen:
                    edges_seen.add(edge_key)
                    edges_list.append({"from": start_id, "to": end_id, "type": val.type})
            # Path
            elif hasattr(val, "nodes") and hasattr(val, "relationships"):
                for n in val.nodes:
                    nid = n.get("id", str(n.element_id))
                    label = list(n.labels)[0] if n.labels else "Node"
                    props = dict(n.items())
                    nodes_map[nid] = {"id": nid, "label": label, "props": props}
                for r in val.relationships:
                    start_id = r.start_node.get("id", str(r.start_node.element_id))
                    end_id = r.end_node.get("id", str(r.end_node.element_id))
                    edge_key = (start_id, end_id, r.type)
                    if edge_key not in edges_seen:
                        edges_seen.add(edge_key)
                        edges_list.append({"from": start_id, "to": end_id, "type": r.type})

    return {
        "nodes": list(nodes_map.values()),
        "edges": edges_list,
    }


def data_reach(finding_id: str, driver: Optional[Driver] = None) -> Dict[str, Any]:
    """
    Template 1: data_reach(finding_id)
    Finding -> Function -> Route + Tables reachable via Function + Tables reachable via DBRole.
    """
    d = driver or get_driver()
    cypher = """
    MATCH (f:Finding)
    WHERE f.id = $f_id OR f.finding_id = $raw_id OR f.id = $prefixed_id
    OPTIONAL MATCH (f)-[r_loc:LOCATED_IN]->(fn:Function)
    OPTIONAL MATCH (rt:Route)-[r_hnd:HANDLED_BY]->(fn)
    OPTIONAL MATCH (fn)-[r_rw:READS|WRITES]->(t_direct:Table)
    OPTIONAL MATCH (role:DBRole {name: 'app_rw'})-[r_role:CAN_READ]->(t_role:Table)
    RETURN f, r_loc, fn, rt, r_hnd, t_direct, r_rw, role, r_role, t_role
    """
    with d.session() as session:
        records = list(session.run(
            cypher,
            f_id=finding_id,
            raw_id=finding_id.replace("finding:", ""),
            prefixed_id=f"finding:{finding_id}",
        ))
        return _format_subgraph(records)


def shared_resource(route_path: str, driver: Optional[Driver] = None) -> Dict[str, Any]:
    """
    Template 2: shared_resource(route)
    Finds other Routes sharing the same connection Pool with the target route.
    """
    d = driver or get_driver()
    cypher = """
    MATCH (r_src:Route {path: $path})-[:HANDLED_BY]->(fn_src:Function)-[:USES]->(p:Pool)
    MATCH (r_other:Route)-[r_hnd:HANDLED_BY]->(fn_other:Function)-[r_uses:USES]->(p)
    RETURN r_src, fn_src, p, r_other, r_hnd, fn_other, r_uses
    """
    with d.session() as session:
        records = list(session.run(cypher, path=route_path))
        return _format_subgraph(records)


def version_contains(finding_ids: List[str], version: str, driver: Optional[Driver] = None) -> Dict[str, Any]:
    """
    Template 3: version_contains(finding_ids, version)
    Which implicated findings exist in the given target version.
    """
    d = driver or get_driver()
    clean_ids = [fid.replace("finding:", "") for fid in finding_ids]
    cypher = """
    MATCH (ver:Version {ver: $version})-[r:CONTAINS]->(f:Finding)
    WHERE f.id IN $f_ids OR f.finding_id IN $clean_ids
    RETURN ver, r, f
    """
    with d.session() as session:
        records = list(session.run(
            cypher,
            version=version,
            f_ids=finding_ids + [f"finding:{i}" for i in clean_ids],
            clean_ids=clean_ids,
        ))
        return _format_subgraph(records)
