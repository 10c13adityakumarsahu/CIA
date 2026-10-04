"""
ledger – Redis-backed release ledger and deployment history.

Data model:
  Redis Hash `release:<ver>`:
    - version: str (e.g. "1.4.0")
    - image: str (e.g. "localhost:5000/shop:1.4.0")
    - git_sha: str
    - status: "stable" | "degraded" | "current"
    - deployed_at: str (ISO timestamp)
    - p95_ms: float
    - err_rate: float
    - schema_version: int
    - finding_fps: json string (list of finding fingerprints)
  Redis ZSet `deploys`: member=<ver>, score=timestamp
  Redis Key `lkg`: <ver>
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional
import urllib.request
import redis

DEFAULT_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
DEFAULT_REGISTRY_URL = os.environ.get("REGISTRY_URL", "http://localhost:5000")


def get_redis_client(redis_url: Optional[str] = None) -> redis.Redis:
    url = redis_url or os.environ.get("REDIS_URL", DEFAULT_REDIS_URL)
    return redis.from_url(url, decode_responses=True)


class Ledger:
    def __init__(self, redis_client: Optional[redis.Redis] = None, registry_url: Optional[str] = None):
        self.r = redis_client or get_redis_client()
        self.registry_url = registry_url or os.environ.get("REGISTRY_URL", DEFAULT_REGISTRY_URL)

    def record_release(
        self,
        version: str,
        image: str,
        git_sha: str,
        status: str,
        deployed_at: Optional[str] = None,
        p95_ms: float = 0.0,
        err_rate: float = 0.0,
        schema_version: int = 1,
        finding_fps: Optional[List[str]] = None,
    ) -> None:
        """Record a release in Redis hash and sorted set."""
        now_iso = deployed_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        ts = time.time()
        fps = json.dumps(finding_fps or [])

        hash_key = f"release:{version}"
        self.r.hset(hash_key, mapping={
            "version": version,
            "image": image,
            "git_sha": git_sha,
            "status": status,
            "deployed_at": now_iso,
            "p95_ms": str(p95_ms),
            "err_rate": str(err_rate),
            "schema_version": str(schema_version),
            "finding_fps": fps,
        })
        self.r.zadd("deploys", {version: ts})

    def get_release(self, version: str) -> Optional[Dict[str, Any]]:
        """Retrieve release metadata dictionary for a version."""
        data = self.r.hgetall(f"release:{version}")
        if not data:
            return None
        return {
            "version": data.get("version", version),
            "image": data.get("image", ""),
            "git_sha": data.get("git_sha", ""),
            "status": data.get("status", "unknown"),
            "deployed_at": data.get("deployed_at", ""),
            "p95_ms": float(data.get("p95_ms", 0.0)),
            "err_rate": float(data.get("err_rate", 0.0)),
            "schema_version": int(data.get("schema_version", 1)),
            "finding_fps": json.loads(data.get("finding_fps", "[]")),
        }

    def list_releases(self) -> List[Dict[str, Any]]:
        """List all releases in chronological deployment order."""
        versions = self.r.zrange("deploys", 0, -1)
        releases = []
        for v in versions:
            rel = self.get_release(v)
            if rel:
                releases.append(rel)
        return releases

    def set_status(self, version: str, status: str) -> None:
        """Update the status of a release (e.g. 'stable', 'degraded', 'current')."""
        self.r.hset(f"release:{version}", "status", status)

    def set_lkg(self, version: str) -> None:
        """Set the Last Known Good (lkg) release key."""
        self.r.set("lkg", version)

    def get_lkg(self) -> Optional[str]:
        """Get the current Last Known Good (lkg) version."""
        val = self.r.get("lkg")
        return str(val) if val else None

    def get_registry_tags(self, repo: str = "shop") -> List[str]:
        """Fetch available tags from registry v2 catalog API."""
        try:
            url = f"{self.registry_url.rstrip('/')}/v2/{repo}/tags/list"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                return data.get("tags", [])
        except Exception:
            return []

    def find_last_stable(
        self,
        exclude_finding_ids: Optional[List[str]] = None,
        exclude_fps: Optional[List[str]] = None,
        target_schema_version: Optional[int] = None,
    ) -> Optional[str]:
        """
        Find the last stable release that:
        1. Has status == 'stable'
        2. Image tag actually exists in the local registry
        3. Does not contain any of the excluded finding fingerprints (if provided)
        4. Has compatible schema_version (if target_schema_version provided)
        """
        registry_tags = set(self.get_registry_tags("shop"))
        exclude_fps_set = set(exclude_fps or [])

        # Traverse deploys in reverse chronological order
        versions = self.r.zrevrange("deploys", 0, -1)
        for v in versions:
            rel = self.get_release(v)
            if not rel:
                continue

            if rel["status"] != "stable":
                continue

            # Check registry tag
            if registry_tags and v not in registry_tags:
                continue

            # Check schema compatibility
            if target_schema_version is not None and rel["schema_version"] > target_schema_version:
                continue

            # Check excluded finding fingerprints
            rel_fps = set(rel.get("finding_fps", []))
            if exclude_fps_set and (rel_fps & exclude_fps_set):
                continue

            return v

        return None


def seed_ledger(redis_url: Optional[str] = None) -> Ledger:
    """Seed the Redis ledger with initial known releases."""
    ledger = Ledger(redis_client=get_redis_client(redis_url))

    # Release 1.3.0 (stable)
    ledger.record_release(
        version="1.3.0",
        image="localhost:5000/shop:1.3.0",
        git_sha="a130000",
        status="stable",
        deployed_at="2026-09-01T00:00:00Z",
        p95_ms=45.0,
        err_rate=0.001,
        schema_version=1,
        finding_fps=[],
    )

    # Release 1.4.0 (stable, lkg)
    ledger.record_release(
        version="1.4.0",
        image="localhost:5000/shop:1.4.0",
        git_sha="b140000",
        status="stable",
        deployed_at="2026-09-15T00:00:00Z",
        p95_ms=48.0,
        err_rate=0.001,
        schema_version=1,
        finding_fps=[],
    )

    # Release 1.5.0 (current / degraded)
    ledger.record_release(
        version="1.5.0",
        image="localhost:5000/shop:1.5.0",
        git_sha="c150000",
        status="current",
        deployed_at="2026-10-01T00:00:00Z",
        p95_ms=320.0,
        err_rate=0.05,
        schema_version=1,
        finding_fps=[],
    )

    # Set LKG to 1.4.0
    ledger.set_lkg("1.4.0")
    return ledger


if __name__ == "__main__":
    l = seed_ledger()
    print(f"Seeded ledger successfully. LKG={l.get_lkg()}")
    print("Releases:", l.list_releases())
    print("Find last stable:", l.find_last_stable())
