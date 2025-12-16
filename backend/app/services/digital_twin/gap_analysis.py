"""
Gap Analysis Service for Digital Twin Engine.

This module compares the hierarchical Asset Tree (SLD - Single Line Diagram)
with the list of active connected Meters to identify missing/unmetered nodes.
"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.models import Asset, Meter, Site
from backend.app.models.base import AssetType
from backend.app.schemas import GapAnalysisResult, UnmeteredAsset


class GapAnalysisService:
    """
    Service for performing gap analysis between SLD assets and meters.
    
    The gap analysis identifies assets in the electrical hierarchy that
    require metering but don't have any meter attached. This is crucial
    for ensuring complete energy monitoring coverage.
    
    Algorithm:
    1. Build the asset tree for a given site
    2. Identify all assets that require metering (requires_metering = True)
    3. Check which of these assets have an active meter attached
    4. Generate a report of unmetered assets with recommendations
    
    Time Complexity: O(n) where n is the number of assets
    Space Complexity: O(n) for storing the asset tree
    """

    def __init__(self, db: Session):
        """Initialize the service with a database session."""
        self.db = db

    def perform_gap_analysis(self, site_id: int) -> GapAnalysisResult:
        """
        Perform gap analysis for a given site.
        
        Args:
            site_id: The ID of the site to analyze
            
        Returns:
            GapAnalysisResult containing the analysis summary and unmetered assets
            
        Raises:
            ValueError: If the site is not found
        """
        site = self.db.query(Site).filter(Site.id == site_id).first()
        if not site:
            raise ValueError(f"Site with ID {site_id} not found")

        assets = self.db.query(Asset).filter(Asset.site_id == site_id).all()
        
        active_meters = self.db.query(Meter).filter(
            Meter.site_id == site_id,
            Meter.is_active == 1
        ).all()
        
        metered_asset_ids = {
            meter.asset_id for meter in active_meters if meter.asset_id is not None
        }

        asset_dict = {asset.id: asset for asset in assets}
        
        assets_requiring_metering = [
            asset for asset in assets if asset.requires_metering
        ]
        
        unmetered_assets: List[UnmeteredAsset] = []
        critical_unmetered_count = 0

        for asset in assets_requiring_metering:
            if asset.id not in metered_asset_ids:
                hierarchy_path = self._get_hierarchy_path(asset, asset_dict)
                
                parent_name = None
                if asset.parent_id:
                    parent = asset_dict.get(asset.parent_id)
                    parent_name = parent.name if parent else None

                unmetered_asset = UnmeteredAsset(
                    asset_id=asset.id,
                    asset_name=asset.name,
                    asset_type=asset.asset_type,
                    parent_id=asset.parent_id,
                    parent_name=parent_name,
                    rated_capacity_kw=asset.rated_capacity_kw,
                    is_critical=bool(asset.is_critical),
                    hierarchy_path=hierarchy_path
                )
                unmetered_assets.append(unmetered_asset)

                if asset.is_critical:
                    critical_unmetered_count += 1

        total_requiring_metering = len(assets_requiring_metering)
        metered_count = total_requiring_metering - len(unmetered_assets)
        coverage_percentage = (
            (metered_count / total_requiring_metering * 100)
            if total_requiring_metering > 0 else 100.0
        )

        recommendations = self._generate_recommendations(
            unmetered_assets, coverage_percentage, critical_unmetered_count
        )

        return GapAnalysisResult(
            site_id=site_id,
            site_name=site.name,
            total_assets=len(assets),
            metered_assets=metered_count,
            unmetered_assets=len(unmetered_assets),
            coverage_percentage=round(coverage_percentage, 2),
            critical_unmetered_count=critical_unmetered_count,
            unmetered_asset_list=unmetered_assets,
            recommendations=recommendations
        )

    def _get_hierarchy_path(
        self, asset: Asset, asset_dict: dict
    ) -> List[str]:
        """
        Build the hierarchy path from root to the given asset.
        
        Args:
            asset: The asset to get the path for
            asset_dict: Dictionary mapping asset IDs to Asset objects
            
        Returns:
            List of asset names from root to the given asset
        """
        path = []
        current = asset
        
        while current:
            path.insert(0, current.name)
            if current.parent_id:
                current = asset_dict.get(current.parent_id)
            else:
                break
                
        return path

    def _generate_recommendations(
        self,
        unmetered_assets: List[UnmeteredAsset],
        coverage_percentage: float,
        critical_count: int
    ) -> List[str]:
        """
        Generate actionable recommendations based on the gap analysis.
        
        Args:
            unmetered_assets: List of unmetered assets
            coverage_percentage: Current metering coverage percentage
            critical_count: Number of critical unmetered assets
            
        Returns:
            List of recommendation strings
        """
        recommendations = []

        if critical_count > 0:
            recommendations.append(
                f"CRITICAL: {critical_count} critical asset(s) are unmetered. "
                "Prioritize installing meters on these assets immediately."
            )

        if coverage_percentage < 50:
            recommendations.append(
                f"Coverage is very low ({coverage_percentage}%). "
                "Consider a comprehensive metering installation program."
            )
        elif coverage_percentage < 80:
            recommendations.append(
                f"Coverage is moderate ({coverage_percentage}%). "
                "Target installing meters on high-capacity assets first."
            )
        elif coverage_percentage < 100:
            recommendations.append(
                f"Coverage is good ({coverage_percentage}%). "
                "Complete the remaining gaps for full visibility."
            )

        main_breakers = [
            a for a in unmetered_assets 
            if a.asset_type == AssetType.MAIN_BREAKER
        ]
        if main_breakers:
            recommendations.append(
                f"{len(main_breakers)} main breaker(s) are unmetered. "
                "These are essential for total site consumption tracking."
            )

        high_capacity = [
            a for a in unmetered_assets 
            if a.rated_capacity_kw and a.rated_capacity_kw > 100
        ]
        if high_capacity:
            recommendations.append(
                f"{len(high_capacity)} high-capacity (>100kW) asset(s) are unmetered. "
                "These represent significant energy consumption points."
            )

        return recommendations


def get_gap_analysis_service(db: Session) -> GapAnalysisService:
    """Factory function to create a GapAnalysisService instance."""
    return GapAnalysisService(db)
