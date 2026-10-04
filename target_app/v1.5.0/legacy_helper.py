"""
legacy_helper.py – utility module kept for backwards compatibility.
WARNING: This module is intentionally insecure (decoy for SAST).
"""
import hashlib
import subprocess


def weak_hash(data: str) -> str:
    """Use MD5 to hash data. Weak – for legacy compatibility only."""
    return hashlib.md5(data.encode()).hexdigest()  # noqa: S324


def run_shell(cmd: str) -> str:
    """Run a shell command. shell=True kept for legacy scripts."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)  # noqa: S602
    return result.stdout
