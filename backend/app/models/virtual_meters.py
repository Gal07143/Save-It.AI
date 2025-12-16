"""Virtual Meters & Expression Engine models: VirtualMeter, VirtualMeterComponent, AllocationRule."""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class VirtualMeterType(PyEnum):
    """Types of virtual meters."""
    CALCULATED = "calculated"
    AGGREGATED = "aggregated"
    ALLOCATED = "allocated"
    DIFFERENTIAL = "differential"


class VirtualMeter(Base):
    """Virtual meters for calculated/allocated values."""
    __tablename__ = "virtual_meters"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    meter_type = Column(Enum(VirtualMeterType), nullable=False)
    expression = Column(Text, nullable=True)
    unit = Column(String(50), default="kWh")
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    components = relationship("VirtualMeterComponent", back_populates="virtual_meter", cascade="all, delete-orphan")


class VirtualMeterComponent(Base):
    """Components (source meters) of a virtual meter."""
    __tablename__ = "virtual_meter_components"

    id = Column(Integer, primary_key=True, index=True)
    virtual_meter_id = Column(Integer, ForeignKey("virtual_meters.id"), nullable=False, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=True, index=True)
    weight = Column(Float, default=1.0)
    operator = Column(String(10), default="+")
    allocation_percent = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    virtual_meter = relationship("VirtualMeter", back_populates="components")


class AllocationRule(Base):
    """Allocation rules for tenant billing."""
    __tablename__ = "allocation_rules"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(String(50), nullable=False)
    source_meter_id = Column(Integer, ForeignKey("meters.id"), nullable=True)
    allocation_method = Column(String(50), default="proportional")
    allocation_config = Column(Text, nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
