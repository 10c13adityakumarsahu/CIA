"""
tests.test_stage5 – Comprehensive unit tests for Stage 5:
- Tools: Path traversal blocked.
- Verifier: Bad citations (bad LOG id, bad file line), missing verdict, rollback to vulnerable target fail verification.
- Executor: Executes weight changes, block rules, and verifies undo restores previous state.
"""

from pathlib import Path
import pytest
import requests

from culprit.tools import read_file, search_logs, list_findings
from culprit.schemas import (
    Report,
    Hypothesis,
    HypothesisLabel,
    Confidence,
    FindingVerdict,
    FindingVerdictType,
    BlastRadius,
    BlastRadiusNode,
    NodeImpact,
    Mitigation,
    RejectedOption,
    Severity,
)
from culprit.verifier import verify_report, Verifier
from culprit.executor import Executor


def test_path_traversal_blocked():
    """read_file must strictly block attempts to traverse outside repo root."""
    with pytest.raises(ValueError, match="Path traversal"):
        read_file("../../Windows/System32/drivers/etc/hosts")

    with pytest.raises(ValueError, match="Path traversal"):
        read_file("../../../etc/passwd")

    with pytest.raises(ValueError, match="Path traversal"):
        read_file("..\\..\\..\\secret.txt")

    # Valid file should work
    content = read_file("target_app/v1.5.0/main.py", start=1, end=5)
    assert "1:" in content
    assert "target_app" in content


def test_verifier_catches_corrupted_reports():
    """Verifier must catch bad LOG ids, invalid line citations, missing verdicts, and rollback to vulnerable targets."""
    verifier = Verifier()

    # Base valid report structure
    base_report = Report(
        incident_summary="SQL injection attack detected on POST /api/orders",
        hypotheses=[
            Hypothesis(
                label=HypothesisLabel.EXPLOIT,
                confidence=Confidence.HIGH,
                supporting=["SAST-002", "LOG-0001", "FILE:target_app/v1.5.0/main.py:81"],
                contradicting=[],
            )
        ],
        verdict="exploit",
        owasp="A03:2021-Injection",
        finding_verdicts=[
            FindingVerdict(
                finding_id=f_id,
                verdict=FindingVerdictType.RELATED if f_id in ("SAST-002", "DAST-001") else FindingVerdictType.DECOY,
                reason="SQL injection in orders" if f_id in ("SAST-002", "DAST-001") else "Decoy finding",
                citations=["FILE:target_app/v1.5.0/main.py:81"],
            )
            for f_id in verifier.findings.keys()
        ],
        path=[],
        blast_radius=BlastRadius(
            severity=Severity.HIGH,
            summary="Exposure of customer and payment records",
            nodes=[
                BlastRadiusNode(
                    node_id="table:customers",
                    impact=NodeImpact.LIKELY,
                    reason="Reachable via app_rw role",
                    citations=["GRAPH:table:customers"],
                )
            ],
        ),
        mitigations=[
            Mitigation(
                action="block_rule",
                rank=1,
                title="Deploy regex block rule on sku",
                rationale="Immediate mitigation blocking SQLi payloads",
                expected_effect="Blocks attack traffic with HTTP 403",
                risk="Low",
                params={"route": "/api/orders", "field": "sku", "regex": "['\";]"},
            )
        ],
        rejected_options=[],
        remediation=["Parameterize query in target_app/v1.5.0/main.py"],
    )

    # 1. Valid report passes
    res_valid = verifier.verify_report(base_report)
    assert res_valid.valid is True, f"Expected valid, got errors: {res_valid.errors}"

    # 2. Corrupted report with invalid LOG ID fails
    bad_log_report = base_report.model_copy(deep=True)
    bad_log_report.hypotheses[0].supporting = ["LOG-999999"]
    res_bad_log = verifier.verify_report(bad_log_report)
    assert res_bad_log.valid is False
    assert any("LOG-999999" in err for err in res_bad_log.errors)

    # 3. Corrupted report with invalid file line number fails
    bad_line_report = base_report.model_copy(deep=True)
    bad_line_report.hypotheses[0].supporting = ["FILE:target_app/v1.5.0/main.py:999999"]
    res_bad_line = verifier.verify_report(bad_line_report)
    assert res_bad_line.valid is False
    assert any("Line 999999 out of bounds" in err for err in res_bad_line.errors)

    # 4. Corrupted report with missing finding verdicts fails
    missing_verdict_report = base_report.model_copy(deep=True)
    missing_verdict_report.finding_verdicts = missing_verdict_report.finding_verdicts[:1]  # Only 1 finding
    res_missing = verifier.verify_report(missing_verdict_report)
    assert res_missing.valid is False
    assert res_missing.all_findings_covered is False

    # 5. Rollback to vulnerable target (1.4.0) when SQLi is implicated must be REJECTED
    rollback_to_vuln_report = base_report.model_copy(deep=True)
    rollback_to_vuln_report.mitigations = [
        Mitigation(
            action="rollback",
            rank=1,
            title="Rollback to 1.4.0",
            rationale="Rollback",
            expected_effect="Rollback",
            risk="High",
            params={"version": "1.4.0"},
        )
    ]
    res_rollback = verifier.verify_report(rollback_to_vuln_report)
    assert res_rollback.valid is False
    assert res_rollback.rollback_allowed is False
    assert any("REJECTED" in err for err in res_rollback.errors)


def test_executor_and_undo():
    """Executor must change weights, add block rules, and restore previous state on undo."""
    executor = Executor("http://localhost:8080")

    initial_weights = requests.get("http://localhost:8080/admin/state").json()["weights"]

    # 1. Test canary shift and undo
    exec_shift = executor.execute("canary_shift", {"blue": 20, "green": 80})
    act_id = exec_shift["action_id"]

    state = requests.get("http://localhost:8080/admin/state").json()
    assert state["weights"] == {"blue": 20, "green": 80}

    # Undo
    undo_res = executor.undo(act_id)
    assert undo_res["status"] == "undone"
    state_restored = requests.get("http://localhost:8080/admin/state").json()
    assert state_restored["weights"] == initial_weights

    # 2. Test block rule and undo
    exec_rule = executor.execute("block_rule", {"route": "/api/orders", "field": "sku", "regex": "TEST_BLOCKED_SKU"})
    rule_act_id = exec_rule["action_id"]

    # Verify rule active
    r_blocked = requests.post("http://localhost:8080/api/orders", json={"customer_id": 1, "sku": "TEST_BLOCKED_SKU", "qty": 1})
    assert r_blocked.status_code == 403

    # Undo block rule
    executor.undo(rule_act_id)
    r_unblocked = requests.post("http://localhost:8080/api/orders", json={"customer_id": 1, "sku": "TEST_BLOCKED_SKU", "qty": 1})
    # Now it shouldn't be 403 (could be 201 or 404 depending on SKU)
    assert r_unblocked.status_code != 403
