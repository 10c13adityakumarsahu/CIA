"""
scanners.rescan – Runs SAST, SCA, and DAST scans sequentially.
"""

from pathlib import Path
from scanners.run_sast import main as run_sast
from scanners.run_sca import main as run_sca
from scanners.run_dast import main as run_dast
from culprit.normalize import load_all_findings


def main():
    print("=== Starting Full Rescan ===")
    run_sast()
    run_sca()
    run_dast()
    
    findings_dir = Path(__file__).resolve().parent.parent / "findings"
    findings = load_all_findings(findings_dir)
    print(f"\n=== Rescan Complete! Loaded {len(findings)} normalized findings ===")
    for f in findings:
        print(f"  [{f.id}] ({f.source.upper()}) {f.title} -> {f.present_in}")


if __name__ == "__main__":
    main()
