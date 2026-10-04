"""
culprit.schemas – Pydantic models for findings, reports, citations, preconditions, and verifier.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
    INFO = "info"


class HypothesisLabel(str, Enum):
    EXPLOIT = "exploit"
    REGRESSION = "regression"
    INFRA = "infra"
    OTHER = "other"


class Confidence(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class FindingVerdictType(str, Enum):
    RELATED = "related"
    DECOY = "decoy"


class NodeImpact(str, Enum):
    NONE = "none"
    POSSIBLE = "possible"
    LIKELY = "likely"
    CONFIRMED = "confirmed"


class Hypothesis(BaseModel):
    label: HypothesisLabel
    confidence: Confidence
    supporting: List[str] = Field(default_factory=list)
    contradicting: List[str] = Field(default_factory=list)


class FindingVerdict(BaseModel):
    finding_id: str
    verdict: FindingVerdictType
    reason: str
    citations: List[str] = Field(default_factory=list)


class PathNode(BaseModel):
    description: str
    citation: str


class BlastRadiusNode(BaseModel):
    node_id: str
    impact: NodeImpact
    reason: str
    citations: List[str] = Field(default_factory=list)


class BlastRadius(BaseModel):
    severity: Severity
    summary: str
    nodes: List[BlastRadiusNode] = Field(default_factory=list)


class PreconditionResult(BaseModel):
    name: str
    passed: bool
    detail: str


class Mitigation(BaseModel):
    action: str  # "rollback", "failover", "canary_shift", "block_rule", "disable_endpoint", "hotfix"
    rank: int
    title: str
    rationale: str
    expected_effect: str
    risk: str
    preconditions: List[PreconditionResult] = Field(default_factory=list)
    executable: bool = True
    params: Dict[str, Any] = Field(default_factory=dict)


class RejectedOption(BaseModel):
    action: str
    why: str
    citations: List[str] = Field(default_factory=list)


class Report(BaseModel):
    incident_summary: str
    hypotheses: List[Hypothesis]
    verdict: str  # "exploit" | "regression" | "infra" | "other"
    owasp: Optional[str] = None
    finding_verdicts: List[FindingVerdict]
    path: List[PathNode] = Field(default_factory=list)
    blast_radius: BlastRadius
    mitigations: List[Mitigation]
    rejected_options: List[RejectedOption] = Field(default_factory=list)
    remediation: List[str] = Field(default_factory=list)


class CitationValidation(BaseModel):
    citation: str
    valid: bool
    citation_type: str
    error: Optional[str] = None


class VerificationResult(BaseModel):
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    citations_checked: int = 0
    citations_valid: int = 0
    all_findings_covered: bool = True
    rollback_allowed: bool = True
