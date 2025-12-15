"""Site model - represents a physical location/facility."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float
from sqlalchemy.orm import relationship

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from backend.app.core.database import Base


class Site(Base):
    """
    Site model representing a physical facility or location.
    
    A site is the top-level entity that contains assets, meters, and bills.
    It represents a B2B client's facility (factory, office building, etc.)
    """
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timezone = Column(String(50), default="UTC")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assets = relationship("Asset", back_populates="site", cascade="all, delete-orphan")
    meters = relationship("Meter", back_populates="site", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="site", cascade="all, delete-orphan")
    tariffs = relationship("Tariff", back_populates="site", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="site", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Site(id={self.id}, name='{self.name}')>"
