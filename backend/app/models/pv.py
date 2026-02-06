"""PV Design models: PVModuleCatalog, PVAssessment, PVSurface, PVDesignScenario, SiteMap, PlacementZone."""
from datetime import datetime, date

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Date
from sqlalchemy.orm import relationship

from app.core.database import Base


class PVModuleCatalog(Base):
    """PV Module catalog for system design."""
    __tablename__ = "pv_module_catalog"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer = Column(String(255), nullable=False, index=True)
    model_name = Column(String(255), nullable=False)
    power_rating_w = Column(Float, nullable=False)
    efficiency_percent = Column(Float, nullable=False)
    width_mm = Column(Float, nullable=False)
    height_mm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=True)
    cell_type = Column(String(100), default="Monocrystalline")
    temp_coefficient = Column(Float, default=-0.35)
    warranty_years = Column(Integer, default=25)
    price_usd = Column(Float, nullable=True)
    datasheet_url = Column(String(500), nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class PVAssessment(Base):
    """PV Assessment for a site - stores roof/area analysis."""
    __tablename__ = "pv_assessments"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    assessment_date = Column(Date, default=date.today)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    annual_irradiance_kwh_m2 = Column(Float, nullable=True)
    avg_peak_sun_hours = Column(Float, nullable=True)
    shading_factor = Column(Float, default=1.0)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    surfaces = relationship("PVSurface", back_populates="assessment", cascade="all, delete-orphan")
    scenarios = relationship("PVDesignScenario", back_populates="assessment", cascade="all, delete-orphan")


class PVSurface(Base):
    """Rooftop or ground surface for PV installation."""
    __tablename__ = "pv_surfaces"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("pv_assessments.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    surface_type = Column(String(50), default="rooftop")
    area_sqm = Column(Float, nullable=False)
    usable_area_sqm = Column(Float, nullable=True)
    tilt_degrees = Column(Float, default=15)
    azimuth_degrees = Column(Float, default=180)
    shading_percent = Column(Float, default=0)
    max_capacity_kw = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("PVAssessment", back_populates="surfaces")


class PVDesignScenario(Base):
    """PV Design scenario with calculated outputs."""
    __tablename__ = "pv_design_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("pv_assessments.id"), nullable=False, index=True)
    module_id = Column(Integer, ForeignKey("pv_module_catalog.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    system_capacity_kw = Column(Float, nullable=False)
    num_panels = Column(Integer, nullable=False)
    annual_production_kwh = Column(Float, nullable=True)
    capacity_factor = Column(Float, nullable=True)
    self_consumption_percent = Column(Float, default=80)
    export_percent = Column(Float, default=20)
    total_capex = Column(Float, nullable=True)
    annual_savings = Column(Float, nullable=True)
    npv = Column(Float, nullable=True)
    irr = Column(Float, nullable=True)
    payback_years = Column(Float, nullable=True)
    lcoe = Column(Float, nullable=True)
    co2_avoided_tons = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("PVAssessment", back_populates="scenarios")


class SiteMap(Base):
    """Uploaded site maps for placement visualization."""
    __tablename__ = "site_maps"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), default="image")
    width_px = Column(Integer, nullable=True)
    height_px = Column(Integer, nullable=True)
    scale_m_per_px = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    zones = relationship("PlacementZone", back_populates="site_map", cascade="all, delete-orphan")


class PlacementZone(Base):
    """Zones marked on site maps for equipment placement."""
    __tablename__ = "placement_zones"

    id = Column(Integer, primary_key=True, index=True)
    site_map_id = Column(Integer, ForeignKey("site_maps.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    zone_type = Column(String(50), default="battery")
    polygon_coords = Column(Text, nullable=True)
    area_sqm = Column(Float, nullable=True)
    max_weight_kg = Column(Float, nullable=True)
    has_ventilation = Column(Integer, default=0)
    has_fire_suppression = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    site_map = relationship("SiteMap", back_populates="zones")
