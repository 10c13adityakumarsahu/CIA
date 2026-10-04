"""
scanners.run_sca – Executes Trivy filesystem vulnerability scan on target_app requirements.
Outputs:
  findings/sca.json
"""

import json
import os
from pathlib import Path
import subprocess
import sys


def run_trivy_docker(repo_root: Path, target_path: str, output_path: Path):
    """Run trivy in docker against target_path."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    repo_abs = str(repo_root.resolve()).replace("\\", "/")
    
    cmd = [
        "docker", "run", "--rm",
        "-v", f"{repo_abs}:/src",
        "aquasec/trivy:latest",
        "fs",
        "--scanners", "vuln",
        "--skip-db-update",
        "--format", "json",
        f"/src/{target_path}",
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
    
    stdout = result.stdout.strip()
    if not stdout and result.stderr:
        print(f"Trivy stderr: {result.stderr}")
        
    try:
        data = json.loads(stdout)
    except Exception as exc:
        print(f"Error parsing JSON from trivy output: {exc}")
        print(f"STDOUT: {stdout}")
        print(f"STDERR: {result.stderr}")
        data = {"Results": [], "errors": [str(exc)]}
        
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    
    total_vulns = sum(len(r.get("Vulnerabilities", [])) for r in data.get("Results", []))
    print(f"Wrote {total_vulns} vulnerabilities to {output_path}")
    return data


def main():
    repo_root = Path(__file__).resolve().parent.parent
    findings_dir = repo_root / "findings"
    findings_dir.mkdir(parents=True, exist_ok=True)
    
    out_file = findings_dir / "sca.json"
    print("\n--- Running Trivy SCA scan ---")
    run_trivy_docker(repo_root, "target_app/v1.5.0/requirements.txt", out_file)


if __name__ == "__main__":
    main()
