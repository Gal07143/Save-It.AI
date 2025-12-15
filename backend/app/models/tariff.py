"""Tariff and TariffRate models for pricing structures."""
from datetime import datetime, time
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Time, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Tariff(Base):
    """
    Tariff model representing a utility pricing structure.
    
    Tariffs define how energy consumption is priced, including
    time-of-use rates, demand charges, and other pricing components.
    """
    __tablename__ = "tariffs"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    provider_name = Column(String(255), nullable=True)
    
    effective_from = Column(DateTime, nullable=True)
    effective_to = Column(DateTime, nullable=True)
    
    currency = Column(String(10), default="USD")
    
    fixed_charge = Column(Float, default=0.0)
    demand_charge_per_kw = Column(Float, nullable=True)
    power_factor_threshold = Column(Float, nullable=True)
    power_factor_penalty_rate = Column(Float, nullable=True)
    
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="tariffs")
    rates = relationship("TariffRate", back_populates="tariff", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="tariff")

    def __repr__(self) -> str:
        return f"<Tariff(id={self.id}, name='{self.name}')>"


class TariffRate(Base):
    """
    TariffRate model for time-of-use pricing periods.
    
    Defines different rates for peak, off-peak, and shoulder periods.
    """
    __tablename__ = "tariff_rates"

    id = Column(Integer, primary_key=True, index=True)
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    rate_per_kwh = Column(Float, nullable=False)
    
    time_start = Column(Time, nullable=True)
    time_end = Column(Time, nullable=True)
    
    days_of_week = Column(String(50), nullable=True)
    season = Column(String(50), nullable=True)
    
    tier_min_kwh = Column(Float, nullable=True)
    tier_max_kwh = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    tariff = relationship("Tariff", back_populates="rates")

    def __repr__(self) -> str:
        return f"<TariffRate(id={self.id}, name='{self.name}', rate={self.rate_per_kwh})>"
