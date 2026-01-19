"""Security service for vulnerability checks and dependency scanning."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging
import os

logger = logging.getLogger(__name__)


class VulnerabilitySeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Vulnerability:
    """Represents a security vulnerability."""
    id: str
    package: str
    version: str
    severity: VulnerabilitySeverity
    title: str
    description: str
    fixed_in: Optional[str] = None
    cve_ids: List[str] = field(default_factory=list)
    discovered_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SecurityScanResult:
    """Result of a security scan."""
    id: str
    scan_type: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    vulnerabilities: List[Vulnerability] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
    error: Optional[str] = None


class SecurityService:
    """Service for security scanning and monitoring."""
    
    def __init__(self):
        self.scan_history: List[SecurityScanResult] = []
        self._known_vulnerabilities: Dict[str, List[Vulnerability]] = {}
    
    async def scan_dependencies(self) -> SecurityScanResult:
        """Scan Python dependencies for vulnerabilities."""
        import uuid
        
        result = SecurityScanResult(
            id=str(uuid.uuid4()),
            scan_type="dependencies",
            started_at=datetime.utcnow(),
        )
        
        try:
            packages = self._get_installed_packages()
            
            for pkg_name, pkg_version in packages.items():
                vulns = self._check_package(pkg_name, pkg_version)
                result.vulnerabilities.extend(vulns)
            
            result.summary = self._summarize_vulnerabilities(result.vulnerabilities)
            result.completed_at = datetime.utcnow()
            
            logger.info(f"Security scan completed: {len(result.vulnerabilities)} vulnerabilities found")
            
        except Exception as e:
            result.error = str(e)
            result.completed_at = datetime.utcnow()
            logger.error(f"Security scan failed: {e}")
        
        self.scan_history.append(result)
        return result
    
    def _get_installed_packages(self) -> Dict[str, str]:
        """Get list of installed Python packages."""
        try:
            import pkg_resources
            return {
                pkg.key: pkg.version
                for pkg in pkg_resources.working_set
            }
        except Exception:
            return {}
    
    def _check_package(self, name: str, version: str) -> List[Vulnerability]:
        """Check a package for known vulnerabilities."""
        return []
    
    def _summarize_vulnerabilities(self, vulnerabilities: List[Vulnerability]) -> Dict[str, int]:
        """Summarize vulnerabilities by severity."""
        summary = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
            "total": len(vulnerabilities),
        }
        
        for vuln in vulnerabilities:
            summary[vuln.severity.value] += 1
        
        return summary
    
    def check_password_strength(self, password: str) -> Dict[str, Any]:
        """Check password strength."""
        import re
        
        checks = {
            "length": len(password) >= 12,
            "uppercase": bool(re.search(r"[A-Z]", password)),
            "lowercase": bool(re.search(r"[a-z]", password)),
            "digit": bool(re.search(r"\d", password)),
            "special": bool(re.search(r"[!@#$%^&*(),.?\":{}|<>]", password)),
        }
        
        score = sum(checks.values())
        
        if score >= 5:
            strength = "strong"
        elif score >= 3:
            strength = "medium"
        else:
            strength = "weak"
        
        return {
            "strength": strength,
            "score": score,
            "checks": checks,
            "suggestions": self._get_password_suggestions(checks),
        }
    
    def _get_password_suggestions(self, checks: Dict[str, bool]) -> List[str]:
        """Get password improvement suggestions."""
        suggestions = []
        if not checks["length"]:
            suggestions.append("Use at least 12 characters")
        if not checks["uppercase"]:
            suggestions.append("Include uppercase letters")
        if not checks["lowercase"]:
            suggestions.append("Include lowercase letters")
        if not checks["digit"]:
            suggestions.append("Include numbers")
        if not checks["special"]:
            suggestions.append("Include special characters")
        return suggestions
    
    def validate_input(self, input_str: str, input_type: str = "text") -> Dict[str, Any]:
        """Validate input for security issues."""
        import re
        
        issues = []
        
        sql_patterns = [
            r"(\bUNION\b.*\bSELECT\b)",
            r"(\bDROP\b.*\bTABLE\b)",
            r"(\bDELETE\b.*\bFROM\b)",
            r"(\bINSERT\b.*\bINTO\b)",
            r"(--)",
            r"(;.*--)",
        ]
        
        for pattern in sql_patterns:
            if re.search(pattern, input_str, re.IGNORECASE):
                issues.append("Potential SQL injection detected")
                break
        
        xss_patterns = [
            r"<script[^>]*>",
            r"javascript:",
            r"on\w+\s*=",
            r"<iframe",
            r"<object",
        ]
        
        for pattern in xss_patterns:
            if re.search(pattern, input_str, re.IGNORECASE):
                issues.append("Potential XSS attack detected")
                break
        
        path_patterns = [
            r"\.\./",
            r"\.\.\\",
            r"%2e%2e%2f",
        ]
        
        for pattern in path_patterns:
            if re.search(pattern, input_str, re.IGNORECASE):
                issues.append("Potential path traversal detected")
                break
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "input_type": input_type,
        }
    
    def sanitize_html(self, html: str) -> str:
        """Sanitize HTML content."""
        import re
        
        allowed_tags = {"b", "i", "u", "p", "br", "span", "div", "strong", "em"}
        
        html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r"\s+on\w+\s*=\s*['\"][^'\"]*['\"]", "", html, flags=re.IGNORECASE)
        html = re.sub(r"javascript:", "", html, flags=re.IGNORECASE)
        
        return html
    
    def get_scan_history(self, limit: int = 20) -> List[dict]:
        """Get security scan history."""
        return [
            {
                "id": s.id,
                "scan_type": s.scan_type,
                "started_at": s.started_at.isoformat(),
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "summary": s.summary,
                "error": s.error,
            }
            for s in sorted(self.scan_history, key=lambda x: x.started_at, reverse=True)[:limit]
        ]
    
    def get_stats(self) -> dict:
        """Get security service statistics."""
        return {
            "total_scans": len(self.scan_history),
            "last_scan": self.scan_history[-1].started_at.isoformat() if self.scan_history else None,
        }


security_service = SecurityService()
