"""Pydantic schemas for request/response validation."""
from backend.app.schemas.site import SiteCreate, SiteUpdate, SiteResponse
from backend.app.schemas.asset import AssetCreate, AssetUpdate, AssetResponse, AssetTreeNode
from backend.app.schemas.meter import MeterCreate, MeterUpdate, MeterResponse, MeterReadingCreate, MeterReadingResponse
from backend.app.schemas.bill import BillCreate, BillUpdate, BillResponse, BillValidationResult
from backend.app.schemas.tariff import TariffCreate, TariffUpdate, TariffResponse
from backend.app.schemas.notification import NotificationCreate, NotificationResponse
from backend.app.schemas.gap_analysis import GapAnalysisResult, UnmeteredAsset

__all__ = [
    "SiteCreate", "SiteUpdate", "SiteResponse",
    "AssetCreate", "AssetUpdate", "AssetResponse", "AssetTreeNode",
    "MeterCreate", "MeterUpdate", "MeterResponse", "MeterReadingCreate", "MeterReadingResponse",
    "BillCreate", "BillUpdate", "BillResponse", "BillValidationResult",
    "TariffCreate", "TariffUpdate", "TariffResponse",
    "NotificationCreate", "NotificationResponse",
    "GapAnalysisResult", "UnmeteredAsset",
]
