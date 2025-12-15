"""Meter and MeterReading models for energy monitoring."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Meter(Base):
    """
    Meter model representing a physical energy meter device.
    
    Meters are attached to assets in the SLD hierarchy to monitor
    energy consumption. A meter can be standalone or linked to an asset.
    """
    __tablename__ = "meters"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True, index=True)
    
    meter_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    manufacturer = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    
    is_active = Column(Integer, default=1)
    is_bidirectional = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="meters")
    asset = relationship("Asset", back_populates="meter")
    readings = relationship("MeterReading", back_populates="meter", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Meter(id={self.id}, meter_id='{self.meter_id}', name='{self.name}')>"


class MeterReading(Base):
    """
    MeterReading model for time-series energy data.
    
    Stores periodic readings from meters. Designed for TimescaleDB
    hypertable optimization for time-series queries.
    """
    __tablename__ = "meter_readings"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=False, index=True)
    
    timestamp = Column(DateTime, nullable=False, index=True)
    
    energy_kwh = Column(Float, nullable=False)
    power_kw = Column(Float, nullable=True)
    voltage = Column(Float, nullable=True)
    current = Column(Float, nullable=True)
    power_factor = Column(Float, nullable=True)
    
    reactive_power_kvar = Column(Float, nullable=True)
    apparent_power_kva = Column(Float, nullable=True)
    
    reading_type = Column(String(50), default="interval")
    
    created_at = Column(DateTime, default=datetime.utcnow)

    meter = relationship("Meter", back_populates="readings")

    def __repr__(self) -> str:
        return f"<MeterReading(meter_id={self.meter_id}, timestamp={self.timestamp}, energy_kwh={self.energy_kwh})>"
