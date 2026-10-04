"""
culprit.verifier – Verifies report citations, finding coverage, graph node existence, and mitigation safety rules.

Verification Rules:
  1. Every citation must resolve:
     - LOG-n: line n exists in gateway.jsonl
     - <FindingID> (e.g. SAST-001, SCA-001, DAST-001): exists in normalized findings
     - FILE:path:line: path exists in repository, line is within file line count
     - GRAPH:<node_id>: node exists in Neo4j graph
     - REL:<ver>: version exists in Redis ledger
  2. Every finding must have exactly one verdict (related | decoy) in finding_verdicts.
  3. Blast radius node IDs must exist in Neo4j graph.
  4. Preconditions must be evaluated by code.
  5. Rollback/failover safety: If target version contains any finding marked 'related', rollback is REJECTED.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from culprit.schemas import (
    Report,
    VerificationResult,
    CitationValidation,
    FindingVerdictType,
)
from culprit.normalize import load_all_findings
from culprit.preconditions import evaluate_action_preconditions
from ledger import Ledger
from graph.queries import get_driver, version_contains

REPO_ROOT = Path(__file__).resolve().parent.parent
LOG_FILE_PATH = REPO_ROOT / "logs" / "gateway.jsonl"


class Verifier:
    def __init__(self, repo_root: Optional[Path] = None):
        self.repo_root = repo_root or REPO_ROOT
        self.log_file = self.repo_root / "logs" / "gateway.jsonl"
        self.findings = {f.id: f for f in load_all_findings(self.repo_root / "findings")}
        self.ledger = Ledger()
        self.neo4j_driver = get_driver()

        # Cache existing graph nodes
        self.graph_nodes: Set[str] = set()
        self._load_graph_nodes()

        # Count total log lines
        self.total_log_lines = 0
        if self.log_file.exists():
            try:
                with open(self.log_file, "r", encoding="utf-8") as f:
                    self.total_log_lines = sum(1 for _ in f)
            except Exception:
                self.total_log_lines = 0

    def _load_graph_nodes(self):
        try:
            with self.neo4j_driver.session() as session:
                records = session.run("MATCH (n) RETURN n.id AS id, n.finding_id AS fid, n.name AS name, n.path AS path, n.ver AS ver")
                for r in records:
                    if r["id"]:
                        self.graph_nodes.add(str(r["id"]))
                    if r["fid"]:
                        self.graph_nodes.add(str(r["fid"]))
                    if r["name"]:
                        self.graph_nodes.add(str(r["name"]))
                    if r["path"]:
                        self.graph_nodes.add(f"route:{r['path']}")
                        self.graph_nodes.add(str(r["path"]))
                    if r["ver"]:
                        self.graph_nodes.add(f"version:{r['ver']}")
                        self.graph_nodes.add(str(r["ver"]))
        except Exception:
            pass

    def validate_citation(self, citation: str) -> CitationValidation:
        """Validate a single citation string."""
        c = citation.strip()
        if not c:
            return CitationValidation(citation=citation, valid=False, citation_type="empty", error="Empty citation")

        # 1. LOG-n (e.g. LOG-0001 or LOG-12)
        m_log = re.match(r"^LOG-(\d+)$", c, re.IGNORECASE)
        if m_log:
            line_num = int(m_log.group(1))
            if 1 <= line_num <= max(1, self.total_log_lines):
                return CitationValidation(citation=c, valid=True, citation_type="log")
            return CitationValidation(
                citation=c,
                valid=False,
                citation_type="log",
                error=f"Log line {line_num} out of bounds (total log lines: {self.total_log_lines})",
            )

        # 2. FindingID (e.g. SAST-001, SCA-002, DAST-001)
        m_finding = re.match(r"^(SAST|SCA|DAST)-\d+$", c, re.IGNORECASE)
        if m_finding:
            fid = c.upper()
            if fid in self.findings:
                return CitationValidation(citation=c, valid=True, citation_type="finding")
            return CitationValidation(
                citation=c,
                valid=False,
                citation_type="finding",
                error=f"Finding ID {fid} not found in scan findings",
            )

        # 3. FILE:path:line (e.g. FILE:target_app/v1.5.0/main.py:81)
        m_file = re.match(r"^FILE:([^:]+)(?::(\d+))?$", c)
        if m_file:
            rel_path = m_file.group(1).replace("\\", "/")
            line_no = int(m_file.group(2)) if m_file.group(2) else None
            target_path = self.repo_root / rel_path
            if not target_path.exists() or not target_path.is_file():
                return CitationValidation(
                    citation=c,
                    valid=False,
                    citation_type="file",
                    error=f"File {rel_path} does not exist in repository",
                )
            if line_no is not None:
                try:
                    num_lines = sum(1 for _ in target_path.open(encoding="utf-8", errors="replace"))
                    if not (1 <= line_no <= num_lines):
                        return CitationValidation(
                            citation=c,
                            valid=False,
                            citation_type="file",
                            error=f"Line {line_no} out of bounds in {rel_path} (file has {num_lines} lines)",
                        )
                except Exception as exc:
                    return CitationValidation(citation=c, valid=False, citation_type="file", error=str(exc))
            return CitationValidation(citation=c, valid=True, citation_type="file")

        # 4. GRAPH:<node_id> (e.g. GRAPH:table:customers or GRAPH:fn:create_order)
        m_graph = re.match(r"^GRAPH:(.+)$", c)
        if m_graph:
            node_id = m_graph.group(1).strip()
            if node_id in self.graph_nodes:
                return CitationValidation(citation=c, valid=True, citation_type="graph")
            return CitationValidation(
                citation=c,
                valid=False,
                citation_type="graph",
                error=f"Graph node {node_id} does not exist in Neo4j knowledge graph",
            )

        # 5. REL:<ver> (e.g. REL:1.4.0)
        m_rel = re.match(r"^REL:(.+)$", c)
        if m_rel:
            ver = m_rel.group(1).strip()
            rel = self.ledger.get_release(ver)
            if rel:
                return CitationValidation(citation=c, valid=True, citation_type="release")
            return CitationValidation(
                citation=c,
                valid=False,
                citation_type="release",
                error=f"Release {ver} not found in Redis ledger",
            )

        # 6. DIFF:hunk-n
        if re.match(r"^DIFF:hunk-\d+$", c):
            return CitationValidation(citation=c, valid=True, citation_type="diff")

        return CitationValidation(
            citation=c,
            valid=False,
            citation_type="unknown",
            error=f"Unrecognized citation format: {citation}",
        )

    def verify_report(self, report: Report) -> VerificationResult:
        """Verify report consistency, citations, finding coverage, and safety rules."""
        errors: List[str] = []
        warnings: List[str] = []
        citations_checked = 0
        citations_valid = 0

        # Collect all citations across report
        all_citations: List[str] = []
        for h in report.hypotheses:
            all_citations.extend(h.supporting)
            all_citations.extend(h.contradicting)
        for fv in report.finding_verdicts:
            all_citations.extend(fv.citations)
        for p in report.path:
            if p.citation:
                all_citations.append(p.citation)
        for bn in report.blast_radius.nodes:
            all_citations.extend(bn.citations)
        for ro in report.rejected_options:
            all_citations.extend(ro.citations)

        for cit in all_citations:
            citations_checked += 1
            res = self.validate_citation(cit)
            if res.valid:
                citations_valid += 1
            else:
                errors.append(f"Invalid citation '{cit}': {res.error}")

        # Check finding verdicts: every finding in scan must be covered exactly once
        covered_finding_ids = set()
        implicated_finding_ids: List[str] = []

        for fv in report.finding_verdicts:
            fid = fv.finding_id.upper()
            if fid in covered_finding_ids:
                errors.append(f"Duplicate verdict for finding {fid}")
            covered_finding_ids.add(fid)

            if fid not in self.findings:
                errors.append(f"Finding verdict references unknown finding: {fid}")

            if fv.verdict == FindingVerdictType.RELATED:
                implicated_finding_ids.append(fid)

        all_known_ids = set(self.findings.keys())
        missing_findings = all_known_ids - covered_finding_ids
        all_covered = True
        if missing_findings:
            all_covered = False
            errors.append(f"Report failed to provide verdicts for findings: {sorted(list(missing_findings))}")

        # Check blast radius nodes exist in graph
        for bn in report.blast_radius.nodes:
            clean_node_id = bn.node_id.replace("GRAPH:", "")
            if clean_node_id not in self.graph_nodes:
                errors.append(f"Blast radius node '{bn.node_id}' does not exist in Neo4j graph")

        # Check mitigations and rollback safety
        rollback_allowed = True
        for m in report.mitigations:
            # Recompute preconditions with CODE
            code_preconditions = evaluate_action_preconditions(m.action, m.params, implicated_finding_ids)
            m.preconditions = code_preconditions
            
            # Check if rollback to a vulnerable target was proposed
            if m.action in ("rollback", "failover"):
                target_ver = m.params.get("version", "1.4.0") if m.action == "rollback" else "1.4.0"
                # Check if target version contains implicated findings
                vc = version_contains(implicated_finding_ids, target_ver)
                present_nodes = vc.get("nodes", [])
                if present_nodes:
                    rollback_allowed = False
                    errors.append(
                        f"CRITICAL SAFETY VIOLATION: Rollback to {target_ver} is REJECTED because {target_ver} contains implicated findings: {[n['id'] for n in present_nodes]}"
                    )

        valid = len(errors) == 0
        return VerificationResult(
            valid=valid,
            errors=errors,
            warnings=warnings,
            citations_checked=citations_checked,
            citations_valid=citations_valid,
            all_findings_covered=all_covered,
            rollback_allowed=rollback_allowed,
        )


def verify_report(report: Report, repo_root: Optional[Path] = None) -> VerificationResult:
    v = Verifier(repo_root=repo_root)
    return v.verify_report(report)
