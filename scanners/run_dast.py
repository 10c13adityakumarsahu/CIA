"""
scanners.run_dast – Executes OWASP ZAP zap-api-scan.py against blue target_app /openapi.json.
Outputs:
  findings/dast.json
"""

import json
import os
from pathlib import Path
import subprocess
import sys


def run_zap_docker(repo_root: Path, openapi_url: str, output_path: Path):
    """Run OWASP ZAP API scan in docker container."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    findings_abs = str((repo_root / "findings").resolve()).replace("\\", "/")
    
    cmd = [
        "docker", "run", "--rm",
        "--network", "cia_default",
        "-v", f"{findings_abs}:/zap/wrk/:rw",
        "zaproxy/zap-stable",
        "zap-api-scan.py",
        "-t", openapi_url,
        "-f", "openapi",
        "-J", "dast.json",
        "-r", "dast_report.html",
        "-I",
    ]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    
    if output_path.exists():
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            sites = data.get("site", [])
            alert_count = sum(len(s.get("alerts", [])) for s in (sites if isinstance(sites, list) else [sites]))
            print(f"ZAP scan completed. Alerts found: {alert_count}")
            return data
        except Exception as exc:
            print(f"Error reading ZAP output: {exc}")
    return None


def main():
    repo_root = Path(__file__).resolve().parent.parent
    findings_dir = repo_root / "findings"
    findings_dir.mkdir(parents=True, exist_ok=True)
    
    out_file = findings_dir / "dast.json"
    openapi_url = "http://blue:8000/openapi.json"
    print("\n--- Running ZAP DAST scan ---")
    run_zap_docker(repo_root, openapi_url, out_file)


if __name__ == "__main__":
    main()
