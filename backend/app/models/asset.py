"""Asset model - represents electrical components in the SLD hierarchy."""
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class AssetType(PyEnum):
    """Types of assets in the electrical hierarchy (SLD)."""
    MAIN_BREAKER = "main_breaker"
    SUB_PANEL = "sub_panel"
    DISTRIBUTION_BOARD = "distribution_board"
    CONSUMER = "consumer"
    TRANSFORMER = "transformer"
    GENERATOR = "generator"
    SOLAR_INVERTER = "solar_inverter"
    BATTERY_STORAGE = "battery_storage"


class Asset(Base):
    """
    Asset model representing electrical components in the Single Line Diagram (SLD).
    
    Assets form a hierarchical tree structure:
    Main Breaker -> Sub Panel -> Distribution Board -> Consumer
    
    Each asset can optionally have a meter attached for monitoring.
    This enables the Digital Twin representation of the electrical infrastructure.
    """
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("assets.id"), nullable=True, index=True)
    
    name = Column(String(255), nullable=False)
    asset_type = Column(Enum(AssetType), nullable=False)
    description = Column(Text, nullable=True)
    
    rated_capacity_kw = Column(Float, nullable=True)
    rated_voltage = Column(Float, nullable=True)
    rated_current = Column(Float, nullable=True)
    
    is_critical = Column(Integer, default=0)
    requires_metering = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="assets")
    parent = relationship("Asset", remote_side=[id], back_populates="children")
    children = relationship("Asset", back_populates="parent", cascade="all, delete-orphan")
    meter = relationship("Meter", back_populates="asset", uselist=False)

    def __repr__(self) -> str:
        return f"<Asset(id={self.id}, name='{self.name}', type={self.asset_type.value})>"
