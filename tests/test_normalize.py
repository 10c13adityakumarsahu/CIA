"""
Unit tests for culprit.normalize – finding counts, stable IDs, fingerprint stability,
cross-version tracking, and verifying N+1 is not classified as a finding.
"""

import json
from pathlib import Path
import pytest

from culprit.normalize import (
    Finding,
    compute_fingerprint,
    normalize_sast_results,
    normalize_sca_results,
    normalize_dast_results,
    load_all_findings,
    normalize_snippet,
)


def test_fingerprint_stability():
    """Fingerprints must be stable across multiple runs and whitespace differences."""
    fp1 = compute_fingerprint("sql-fstring-exec", "main.py", "  cur.execute(f'SELECT...') \n")
    fp2 = compute_fingerprint("sql-fstring-exec", "main.py", "cur.execute(f'SELECT...')")
    assert fp1 == fp2
    assert len(fp1) == 40  # SHA1 hex string


def test_normalize_sast_multi_version():
    """SAST normalization must group identical code across versions and populate present_in."""
    sample_130 = {
        "results": [
            {
                "check_id": "sql-fstring-exec",
                "path": "target_app/v1.3.0/main.py",
                "start": {"line": 72},
                "extra": {
                    "message": "SQL query with f-string",
                    "lines": "query = f\"SELECT id, price FROM products WHERE sku = '{order.sku}'\"\ncur.execute(query)",
                    "severity": "ERROR",
                    "metadata": {"cwe": ["CWE-89"], "owasp": "A03:2021-Injection"},
                },
            },
            {
                "check_id": "weak-hash",
                "path": "target_app/v1.3.0/legacy_helper.py",
                "start": {"line": 11},
                "extra": {
                    "message": "Use of MD5 hash",
                    "lines": "return hashlib.md5(data.encode()).hexdigest()",
                    "severity": "WARNING",
                    "metadata": {"cwe": ["CWE-328"], "owasp": "A02:2021-Cryptographic Failures"},
                },
            },
            {
                "check_id": "subprocess-shell-true",
                "path": "target_app/v1.3.0/legacy_helper.py",
                "start": {"line": 16},
                "extra": {
                    "message": "subprocess shell=True",
                    "lines": "subprocess.run(cmd, shell=True, capture_output=True, text=True)",
                    "severity": "ERROR",
                    "metadata": {"cwe": ["CWE-78"], "owasp": "A03:2021-Injection"},
                },
            },
        ]
    }

    sample_140 = {
        "results": [
            {
                "check_id": "sql-fstring-exec",
                "path": "target_app/v1.4.0/main.py",
                "start": {"line": 72},
                "extra": {
                    "message": "SQL query with f-string",
                    "lines": "query = f\"SELECT id, price FROM products WHERE sku = '{order.sku}'\"\ncur.execute(query)",
                    "severity": "ERROR",
                    "metadata": {"cwe": ["CWE-89"], "owasp": "A03:2021-Injection"},
                },
            },
            {
                "check_id": "weak-hash",
                "path": "target_app/v1.4.0/legacy_helper.py",
                "start": {"line": 11},
                "extra": {
                    "message": "Use of MD5 hash",
                    "lines": "return hashlib.md5(data.encode()).hexdigest()",
                    "severity": "WARNING",
                    "metadata": {"cwe": ["CWE-328"], "owasp": "A02:2021-Cryptographic Failures"},
                },
            },
            {
                "check_id": "subprocess-shell-true",
                "path": "target_app/v1.4.0/legacy_helper.py",
                "start": {"line": 16},
                "extra": {
                    "message": "subprocess shell=True",
                    "lines": "subprocess.run(cmd, shell=True, capture_output=True, text=True)",
                    "severity": "ERROR",
                    "metadata": {"cwe": ["CWE-78"], "owasp": "A03:2021-Injection"},
                },
            },
        ]
    }

    sample_150 = {
        "results": [
            {
                "check_id": "sql-fstring-exec",
                "path": "target_app/v1.5.0/main.py",
                "start": {"line": 81},
                "extra": {
                    "message": "SQL query with f-string",
                    "lines": "query = f\"SELECT id, price FROM products WHERE sku = '{order.sku}'\"\ncur.execute(query)",
                    "severity": "ERROR",
                    "metadata": {"cwe": ["CWE-89"], "owasp": "A03:2021-Injection"},
                },
            },
            {
                "check_id": "weak-hash",
                "path": "target_app/v1.5.0/legacy_helper.py",
                "start": {"line": 11},
                "extra": {
                    "message": "Use of MD5 hash",
                    "lines": "return hashlib.md5(data.encode()).hexdigest()",
                    "severity": "WARNING",
                    "metadata": {"cwe": ["CWE-328"], "owasp": "A02:2021-Cryptographic Failures"},
                },
            },
            {
                "check_id": "subprocess-shell-true",
                "path": "target_app/v1.5.0/legacy_helper.py",
                "start": {"line": 16},
                "extra": {
                    "message": "subprocess shell=True",
                    "lines": "subprocess.run(cmd, shell=True, capture_output=True, text=True)",
                    "severity": "ERROR",
                    "metadata": {"cwe": ["CWE-78"], "owasp": "A03:2021-Injection"},
                },
            },
        ]
    }

    findings = normalize_sast_results({
        "1.3.0": sample_130,
        "1.4.0": sample_140,
        "1.5.0": sample_150,
    })

    # Exactly 3 distinct SAST findings (deduplicated across 3 versions)
    assert len(findings) == 3

    # IDs must be sorted and deterministic
    assert [f.id for f in findings] == ["SAST-001", "SAST-002", "SAST-003"]

    # SQLi finding must be present in all 3 versions
    sqli = next(f for f in findings if "CWE-89" in f.cwe)
    assert sqli.present_in == ["1.3.0", "1.4.0", "1.5.0"]
    assert sqli.severity == "high"
    assert "main.py" in sqli.location


def test_n_plus_one_is_not_a_finding():
    """Verify that N+1 performance bottleneck is not misclassified as a security finding."""
    sample_150 = {
        "results": [
            {
                "check_id": "sql-fstring-exec",
                "path": "target_app/v1.5.0/main.py",
                "extra": {
                    "message": "SQL query with f-string",
                    "lines": "cur.execute(query)",
                    "metadata": {"cwe": ["CWE-89"]},
                },
            }
        ]
    }
    findings = normalize_sast_results({"1.5.0": sample_150})
    for f in findings:
        assert "n+1" not in f.title.lower()
        assert "n+1" not in f.detail.lower()
        assert "latency" not in f.detail.lower()


def test_sca_normalization():
    """Verify SCA normalization on decoy packages."""
    sample_trivy = {
        "Results": [
            {
                "Target": "target_app/v1.5.0/requirements-decoys.txt",
                "Vulnerabilities": [
                    {
                        "VulnerabilityID": "CVE-2020-14343",
                        "PkgName": "PyYAML",
                        "InstalledVersion": "5.3.1",
                        "Severity": "CRITICAL",
                        "Title": "PyYAML: arbitrary code execution",
                        "CweIDs": ["CWE-20"],
                    },
                    {
                        "VulnerabilityID": "CVE-2023-32681",
                        "PkgName": "requests",
                        "InstalledVersion": "2.19.1",
                        "Severity": "MEDIUM",
                        "Title": "requests: Proxy-Authorization header leak",
                        "CweIDs": ["CWE-200"],
                    },
                ],
            }
        ]
    }
    findings = normalize_sca_results(sample_trivy)
    assert len(findings) == 2
    assert findings[0].id == "SCA-001"
    assert findings[1].id == "SCA-002"
    assert findings[0].present_in == ["1.3.0", "1.4.0", "1.5.0"]
    assert findings[0].severity == "critical"


def test_dast_normalization():
    """Verify DAST normalization on ZAP report."""
    sample_zap = {
        "site": [
            {
                "@name": "http://localhost:8001",
                "alerts": [
                    {
                        "pluginid": "10038",
                        "alert": "Content Security Policy (CSP) Header Not Set",
                        "riskcode": "2",
                        "riskdesc": "Medium (High)",
                        "desc": "CSP header missing",
                        "instances": [{"uri": "http://localhost:8001/api/products", "method": "GET"}],
                    }
                ],
            }
        ]
    }
    findings = normalize_dast_results(sample_zap, live_version="1.5.0")
    assert len(findings) == 1
    assert findings[0].id == "DAST-001"
    assert findings[0].source == "dast"
    assert findings[0].present_in == ["1.5.0"]
