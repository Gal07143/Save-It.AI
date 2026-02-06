"""BESS Simulator models: BESSVendor, BESSModel, BESSDataset, BESSDataReading, BESSSimulationResult."""
from datetime import datetime, date

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Date
from sqlalchemy.orm import relationship

from app.core.database import Base


class BESSVendor(Base):
    """BESS Vendor catalog for equipment recommendations."""
    __tablename__ = "bess_vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    country = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    models = relationship("BESSModel", back_populates="vendor", cascade="all, delete-orphan")


class BESSModel(Base):
    """BESS Model specifications from vendors."""
    __tablename__ = "bess_models"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("bess_vendors.id"), nullable=False, index=True)
    model_name = Column(String(255), nullable=False)
    model_number = Column(String(100), nullable=True)
    chemistry = Column(String(100), default="LFP")
    capacity_kwh = Column(Float, nullable=False)
    power_rating_kw = Column(Float, nullable=False)
    voltage_nominal = Column(Float, nullable=True)
    round_trip_efficiency = Column(Float, default=0.92)
    depth_of_discharge = Column(Float, default=0.90)
    cycle_life = Column(Integer, default=6000)
    warranty_years = Column(Integer, default=10)
    dimensions_cm = Column(String(100), nullable=True)
    weight_kg = Column(Float, nullable=True)
    operating_temp_min = Column(Float, default=-20)
    operating_temp_max = Column(Float, default=50)
    price_usd = Column(Float, nullable=True)
    price_per_kwh = Column(Float, nullable=True)
    datasheet_url = Column(String(500), nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("BESSVendor", back_populates="models")


class BESSDataset(Base):
    """BESS Dataset for uploaded interval load data."""
    __tablename__ = "bess_datasets"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    interval_minutes = Column(Integer, default=30)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    total_records = Column(Integer, default=0)
    total_consumption_kwh = Column(Float, default=0)
    peak_demand_kw = Column(Float, nullable=True)
    avg_demand_kw = Column(Float, nullable=True)
    file_name = Column(String(255), nullable=True)
    upload_status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    readings = relationship("BESSDataReading", back_populates="dataset", cascade="all, delete-orphan")


class BESSDataReading(Base):
    """Individual interval readings for BESS simulation."""
    __tablename__ = "bess_data_readings"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("bess_datasets.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    demand_kw = Column(Float, nullable=False)
    energy_kwh = Column(Float, nullable=True)
    tariff_period = Column(String(20), default="standard")
    rate_per_kwh = Column(Float, nullable=True)

    dataset = relationship("BESSDataset", back_populates="readings")


class BESSSimulationResult(Base):
    """Stored results from BESS simulation runs."""
    __tablename__ = "bess_simulation_results"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    dataset_id = Column(Integer, ForeignKey("bess_datasets.id"), nullable=True, index=True)
    bess_model_id = Column(Integer, ForeignKey("bess_models.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    battery_capacity_kwh = Column(Float, nullable=False)
    battery_power_kw = Column(Float, nullable=False)
    annual_savings = Column(Float, nullable=False)
    peak_shaving_savings = Column(Float, default=0)
    arbitrage_savings = Column(Float, default=0)
    npv = Column(Float, nullable=True)
    irr = Column(Float, nullable=True)
    payback_years = Column(Float, nullable=True)
    capex = Column(Float, nullable=True)
    simulation_data_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
