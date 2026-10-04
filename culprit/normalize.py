"""
culprit.normalize – Normalizes raw SAST, SCA, and DAST scanner outputs into uniform Finding objects.

Findings follow the SPEC specification:
Finding {
    id: str,                  # SAST-001, SCA-001, DAST-001 (deterministic, sorted)
    source: str,              # "sast" | "sca" | "dast"
    title: str,
    severity: str,            # "low" | "medium" | "high" | "critical" | "info"
    location: str,
    cwe: list[str],
    owasp: str,
    detail: str,
    fingerprint: str,         # sha1(rule|path|normalized snippet)
    present_in: list[str],    # e.g. ["1.3.0", "1.4.0", "1.5.0"]
}
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional


@dataclass
class Finding:
    id: str
    source: str
    title: str
    severity: str
    location: str
    cwe: List[str]
    owasp: str
    detail: str
    fingerprint: str
    present_in: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


def normalize_snippet(snippet: str) -> str:
    """Normalize code/text snippet by stripping whitespace and extra blank lines."""
    if not snippet:
        return ""
    lines = [line.strip() for line in snippet.strip().splitlines() if line.strip()]
    return "\n".join(lines)


def compute_fingerprint(rule: str, path: str, snippet: str) -> str:
    """Compute sha1(rule|path|normalized snippet) for cross-version matching."""
    norm_snippet = normalize_snippet(snippet)
    norm_path = path.replace("\\", "/").strip("/")
    key = f"{rule.strip()}|{norm_path}|{norm_snippet}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()


def normalize_severity(raw: str) -> str:
    s = (raw or "").lower()
    if s in ("critical", "crit"):
        return "critical"
    if s in ("high", "error"):
        return "high"
    if s in ("medium", "med", "warning", "warn"):
        return "medium"
    if s in ("low",):
        return "low"
    return "info"


def normalize_sast_results(version_results: Dict[str, Dict[str, Any]]) -> List[Finding]:
    """
    Parse Semgrep JSON results across multiple versions (e.g. {'1.3.0': data, '1.4.0': data, '1.5.0': data}).
    Groups findings by fingerprint and populates present_in.
    """
    aggregated: Dict[str, Dict[str, Any]] = {}

    # Sort version keys for deterministic processing
    for ver in sorted(version_results.keys()):
        data = version_results[ver]
        results = data.get("results", [])
        for r in results:
            check_id = r.get("check_id", "semgrep-rule")
            raw_path = r.get("path", "")
            # Normalize path to relative file inside target_app
            # e.g. target_app/v1.5.0/main.py -> main.py for cross-version fingerprint
            norm_rel_path = raw_path.replace("\\", "/")
            file_match = re.search(r"target_app/(?:v?[0-9.]+)/(.+)", norm_rel_path)
            rel_file = file_match.group(1) if file_match else Path(norm_rel_path).name

            extra = r.get("extra", {})
            message = extra.get("message", check_id)
            lines = extra.get("lines", "")
            metadata = extra.get("metadata", {})
            cwe_raw = metadata.get("cwe", [])
            if isinstance(cwe_raw, str):
                cwe_raw = [cwe_raw]
            cwe_list = [c.split(":")[0].strip() if ":" in c else c.strip() for c in cwe_raw if c]
            owasp = metadata.get("owasp", "")
            if isinstance(owasp, list):
                owasp = owasp[0] if owasp else ""
            severity = normalize_severity(extra.get("severity", "medium"))

            start_line = r.get("start", {}).get("line", 0)
            end_line = r.get("end", {}).get("line", 0)
            line_str = f":{start_line}" if start_line else ""

            fp = compute_fingerprint(check_id, rel_file, lines)

            # Keep latest version's path as primary location
            location = f"target_app/v{ver}/{rel_file}{line_str}"

            if fp not in aggregated:
                title = message.splitlines()[0] if message else check_id
                aggregated[fp] = {
                    "source": "sast",
                    "title": title,
                    "severity": severity,
                    "location": location,
                    "cwe": cwe_list,
                    "owasp": str(owasp),
                    "detail": message,
                    "fingerprint": fp,
                    "present_in": set(),
                    "_sort_key": (severity_rank(severity), rel_file, start_line, check_id),
                }
            aggregated[fp]["present_in"].add(ver)
            # Update location to latest version if ver is newer
            aggregated[fp]["location"] = location

    # Sort deterministically
    sorted_items = sorted(aggregated.values(), key=lambda x: (x["_sort_key"], x["fingerprint"]))
    findings: List[Finding] = []
    for idx, item in enumerate(sorted_items, start=1):
        findings.append(Finding(
            id=f"SAST-{idx:03d}",
            source=item["source"],
            title=item["title"],
            severity=item["severity"],
            location=item["location"],
            cwe=item["cwe"],
            owasp=item["owasp"],
            detail=item["detail"],
            fingerprint=item["fingerprint"],
            present_in=sorted(list(item["present_in"])),
        ))
    return findings


def normalize_sca_results(trivy_data: Dict[str, Any], versions: Optional[List[str]] = None) -> List[Finding]:
    """Parse Trivy filesystem vulnerability JSON scan results."""
    if versions is None:
        versions = ["1.3.0", "1.4.0", "1.5.0"]

    results = trivy_data.get("Results", [])
    vulns_by_fp: Dict[str, Dict[str, Any]] = {}

    for res in results:
        target = res.get("Target", "requirements.txt").replace("\\", "/")
        norm_target = Path(target).name
        vulnerabilities = res.get("Vulnerabilities", [])
        for v in vulnerabilities:
            vuln_id = v.get("VulnerabilityID", "VULN")
            pkg_name = v.get("PkgName", "")
            installed_ver = v.get("InstalledVersion", "")
            title = v.get("Title") or f"{pkg_name} vulnerability ({vuln_id})"
            desc = v.get("Description", "")
            severity = normalize_severity(v.get("Severity", "medium"))
            cwe_raw = v.get("CweIDs", [])
            cwe_list = [c.strip() for c in cwe_raw if c]
            if not cwe_list:
                cwe_list = ["CWE-1395"]  # Dependency with Known Vulnerabilities

            snippet = f"{pkg_name}=={installed_ver}"
            fp = compute_fingerprint(vuln_id, norm_target, snippet)

            location = f"target_app/{norm_target}:{snippet}"

            if fp not in vulns_by_fp:
                vulns_by_fp[fp] = {
                    "source": "sca",
                    "title": f"{pkg_name} {installed_ver}: {title}",
                    "severity": severity,
                    "location": location,
                    "cwe": cwe_list,
                    "owasp": "A06:2021-Vulnerable and Outdated Components",
                    "detail": desc or f"Vulnerability {vuln_id} in {pkg_name} version {installed_ver}",
                    "fingerprint": fp,
                    "present_in": sorted(list(set(versions))),
                    "_sort_key": (severity_rank(severity), pkg_name, vuln_id),
                }

    sorted_items = sorted(vulns_by_fp.values(), key=lambda x: (x["_sort_key"], x["fingerprint"]))
    findings: List[Finding] = []
    for idx, item in enumerate(sorted_items, start=1):
        findings.append(Finding(
            id=f"SCA-{idx:03d}",
            source=item["source"],
            title=item["title"],
            severity=item["severity"],
            location=item["location"],
            cwe=item["cwe"],
            owasp=item["owasp"],
            detail=item["detail"],
            fingerprint=item["fingerprint"],
            present_in=item["present_in"],
        ))
    return findings


def normalize_dast_results(zap_data: Dict[str, Any], live_version: str = "1.5.0") -> List[Finding]:
    """Parse OWASP ZAP JSON scan report."""
    site_list = zap_data.get("site", [])
    if isinstance(site_list, dict):
        site_list = [site_list]

    alerts_by_fp: Dict[str, Dict[str, Any]] = {}

    for site in site_list:
        alerts = site.get("alerts", [])
        for alert in alerts:
            plugin_id = str(alert.get("pluginid", "zap-alert"))
            alert_name = alert.get("alert", alert.get("name", "DAST Alert"))
            risk_desc = alert.get("riskdesc", alert.get("riskcode", ""))
            severity = normalize_severity(risk_desc.split()[0] if risk_desc else "info")
            desc = alert.get("desc", alert.get("description", ""))
            cwe_id = alert.get("cweid")
            cwe_list = [f"CWE-{cwe_id}"] if cwe_id and str(cwe_id) != "0" else []
            wasc_id = alert.get("wascid")

            instances = alert.get("instances", [])
            uri = instances[0].get("uri", "") if instances else alert.get("uri", "")
            method = instances[0].get("method", "") if instances else alert.get("method", "")
            param = instances[0].get("param", "") if instances else alert.get("param", "")

            # Path extracted from URI
            path_match = re.search(r"https?://[^/]+(/.*)", uri)
            route = path_match.group(1) if path_match else uri

            snippet = f"{method} {route} param={param}"
            fp = compute_fingerprint(plugin_id, route, snippet)
            location = f"{method} {route}" if method and route else (route or "api")

            if fp not in alerts_by_fp:
                alerts_by_fp[fp] = {
                    "source": "dast",
                    "title": alert_name,
                    "severity": severity,
                    "location": location,
                    "cwe": cwe_list,
                    "owasp": "A05:2021-Security Misconfiguration" if "header" in alert_name.lower() else "A03:2021-Injection",
                    "detail": desc,
                    "fingerprint": fp,
                    "present_in": [live_version],
                    "_sort_key": (severity_rank(severity), alert_name, route),
                }

    sorted_items = sorted(alerts_by_fp.values(), key=lambda x: (x["_sort_key"], x["fingerprint"]))
    findings: List[Finding] = []
    for idx, item in enumerate(sorted_items, start=1):
        findings.append(Finding(
            id=f"DAST-{idx:03d}",
            source=item["source"],
            title=item["title"],
            severity=item["severity"],
            location=item["location"],
            cwe=item["cwe"],
            owasp=item["owasp"],
            detail=item["detail"],
            fingerprint=item["fingerprint"],
            present_in=item["present_in"],
        ))
    return findings


def severity_rank(severity: str) -> int:
    ranks = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    return ranks.get(severity.lower(), 5)


def load_all_findings(findings_dir: Path | str) -> List[Finding]:
    """Load and normalize all findings from the findings directory."""
    fdir = Path(findings_dir)
    findings: List[Finding] = []

    # SAST
    sast_results: Dict[str, Dict[str, Any]] = {}
    for ver in ["1.3.0", "1.4.0", "1.5.0"]:
        file = fdir / f"sast_{ver}.json"
        if file.exists():
            try:
                with open(file, "r", encoding="utf-8") as f:
                    sast_results[ver] = json.load(f)
            except Exception:
                pass
    if sast_results:
        findings.extend(normalize_sast_results(sast_results))

    # SCA
    sca_file = fdir / "sca.json"
    if sca_file.exists():
        try:
            with open(sca_file, "r", encoding="utf-8") as f:
                sca_data = json.load(f)
            findings.extend(normalize_sca_results(sca_data))
        except Exception:
            pass

    # DAST
    dast_file = fdir / "dast.json"
    if dast_file.exists():
        try:
            with open(dast_file, "r", encoding="utf-8") as f:
                dast_data = json.load(f)
            findings.extend(normalize_dast_results(dast_data))
        except Exception:
            pass

    return findings


if __name__ == "__main__":
    import sys
    base_dir = Path(__file__).resolve().parent.parent
    f_dir = base_dir / "findings"
    all_f = load_all_findings(f_dir)
    print(f"Loaded {len(all_f)} findings from {f_dir}:")
    for item in all_f:
        print(f"[{item.id}] ({item.source.upper()}) {item.title} -> present_in={item.present_in} ({item.location})")
