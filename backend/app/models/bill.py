"""Bill and BillLineItem models for financial tracking."""
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Date, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Bill(Base):
    """
    Bill model representing a utility bill for a site.
    
    Bills contain the financial data from utility providers and are
    cross-referenced with meter readings for validation.
    """
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=True, index=True)
    
    bill_number = Column(String(100), nullable=True, index=True)
    provider_name = Column(String(255), nullable=True)
    
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    issue_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    
    total_kwh = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(10), default="USD")
    
    peak_kwh = Column(Float, nullable=True)
    off_peak_kwh = Column(Float, nullable=True)
    demand_kw = Column(Float, nullable=True)
    
    power_factor_penalty = Column(Float, nullable=True)
    taxes = Column(Float, nullable=True)
    other_charges = Column(Float, nullable=True)
    
    notes = Column(Text, nullable=True)
    
    is_validated = Column(Integer, default=0)
    validation_variance_pct = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="bills")
    tariff = relationship("Tariff", back_populates="bills")
    line_items = relationship("BillLineItem", back_populates="bill", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Bill(id={self.id}, site_id={self.site_id}, period={self.period_start} to {self.period_end})>"


class BillLineItem(Base):
    """
    BillLineItem model for detailed bill breakdown.
    
    Represents individual charges on a utility bill (energy, demand, taxes, etc.)
    """
    __tablename__ = "bill_line_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False, index=True)
    
    description = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    unit_price = Column(Float, nullable=True)
    amount = Column(Float, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="line_items")

    def __repr__(self) -> str:
        return f"<BillLineItem(id={self.id}, description='{self.description}', amount={self.amount})>"
