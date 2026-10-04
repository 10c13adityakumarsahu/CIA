"""
scanners.run_sast – Executes Semgrep with local rules against target_app v1.3.0, v1.4.0, and v1.5.0.
Outputs:
  findings/sast_1.3.0.json
  findings/sast_1.4.0.json
  findings/sast_1.5.0.json
"""

import json
import os
from pathlib import Path
import subprocess
import sys


def run_semgrep_scan(repo_root: Path, target_dir: str, rules_dir: str, output_path: Path):
    """Run semgrep either via local binary or docker against target_dir with local rules."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    target_path = repo_root / target_dir
    rules_path = repo_root / rules_dir
    
    # Add python user scripts to PATH
    scripts_dir = str(Path(os.environ.get("APPDATA", "")) / "Python" / "Python310" / "Scripts")
    env = os.environ.copy()
    if scripts_dir not in env.get("PATH", ""):
        env["PATH"] = f"{scripts_dir};{env.get('PATH', '')}"

    semgrep_exe = Path(os.environ.get("APPDATA", "")) / "Python" / "Python310" / "Scripts" / "semgrep.exe"
    semgrep_bin = str(semgrep_exe) if semgrep_exe.exists() else "semgrep"
    cmd = [
        semgrep_bin,
        "scan",
        "--config", str(rules_path),
        "--metrics=off",
        "--json",
        str(target_path),
    ]
    print(f"Running semgrep: {' '.join(cmd)}")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
        env=env,
        shell=(os.name == "nt"),
    )
    stdout = result.stdout.strip()
    if not stdout and result.stderr:
        print(f"Semgrep stderr: {result.stderr}")
    
    try:
        data = json.loads(stdout)
    except Exception as exc:
        print(f"Error parsing JSON from semgrep output: {exc}")
        print(f"STDOUT: {stdout}")
        print(f"STDERR: {result.stderr}")
        data = {"results": [], "errors": [str(exc)]}
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {len(data.get('results', []))} findings to {output_path}")
    return data


def main():
    repo_root = Path(__file__).resolve().parent.parent
    findings_dir = repo_root / "findings"
    findings_dir.mkdir(parents=True, exist_ok=True)
    
    versions = ["1.3.0", "1.4.0", "1.5.0"]
    for ver in versions:
        target_dir = f"target_app/v{ver}"
        rules_dir = "scanners/rules"
        out_file = findings_dir / f"sast_{ver}.json"
        print(f"\n--- Scanning {target_dir} ---")
        run_semgrep_scan(repo_root, target_dir, rules_dir, out_file)


if __name__ == "__main__":
    main()
