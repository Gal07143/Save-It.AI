"""
Solar ROI Calculator for Optimization Engine.

This module calculates the return on investment for solar panel installations
based on site consumption patterns and local solar irradiance data.
"""
from dataclasses import dataclass
from typing import Optional, List
from pydantic import BaseModel


class SolarROIInput(BaseModel):
    """Input parameters for Solar ROI calculation."""
    annual_consumption_kwh: float
    average_electricity_rate: float
    system_size_kw: float
    installation_cost: float
    annual_solar_production_kwh_per_kw: float = 1400
    annual_degradation_rate: float = 0.005
    maintenance_cost_annual: float = 0.0
    incentive_amount: float = 0.0
    net_metering_rate: Optional[float] = None
    analysis_period_years: int = 25
    inflation_rate: float = 0.03


class SolarROIResult(BaseModel):
    """Result of Solar ROI calculation."""
    system_size_kw: float
    installation_cost: float
    year_one_production_kwh: float
    year_one_savings: float
    simple_payback_years: float
    net_present_value: float
    internal_rate_of_return: float
    lifetime_savings: float
    break_even_year: Optional[int]
    annual_projections: List[dict]


class SolarROICalculator:
    """
    Calculator for Solar PV system return on investment.
    
    This calculator uses industry-standard formulas to estimate:
    - Annual energy production (accounting for panel degradation)
    - Annual cost savings (accounting for utility rate inflation)
    - Simple payback period
    - Net Present Value (NPV)
    - Internal Rate of Return (IRR)
    
    Assumptions:
    - Linear panel degradation (typically 0.5% per year)
    - Constant inflation rate for electricity prices
    - Net metering at retail rate if not specified
    
    Formulas:
    - Year N Production = System Size * kWh/kW * (1 - degradation_rate)^(N-1)
    - Year N Savings = Production_N * Rate * (1 + inflation)^(N-1)
    - Simple Payback = Net Cost / Year 1 Savings
    - NPV = Sum of discounted cash flows over analysis period
    - IRR = Discount rate that makes NPV = 0
    """

    DISCOUNT_RATE = 0.06

    def calculate_roi(self, inputs: SolarROIInput) -> SolarROIResult:
        """
        Calculate the solar ROI based on input parameters.
        
        Args:
            inputs: SolarROIInput with all required parameters
            
        Returns:
            SolarROIResult with complete financial analysis
        """
        net_cost = inputs.installation_cost - inputs.incentive_amount
        
        year_one_production = (
            inputs.system_size_kw * inputs.annual_solar_production_kwh_per_kw
        )
        
        export_rate = inputs.net_metering_rate or inputs.average_electricity_rate
        
        annual_projections = []
        cumulative_savings = 0.0
        cumulative_cash_flow = -net_cost
        break_even_year = None

        for year in range(1, inputs.analysis_period_years + 1):
            degradation_factor = (1 - inputs.annual_degradation_rate) ** (year - 1)
            production = year_one_production * degradation_factor
            
            inflation_factor = (1 + inputs.inflation_rate) ** (year - 1)
            current_rate = inputs.average_electricity_rate * inflation_factor
            
            self_consumption = min(production, inputs.annual_consumption_kwh * degradation_factor)
            export = max(0, production - self_consumption)
            
            savings = (self_consumption * current_rate) + (export * export_rate * inflation_factor)
            net_annual = savings - inputs.maintenance_cost_annual
            
            cumulative_savings += net_annual
            cumulative_cash_flow += net_annual

            if break_even_year is None and cumulative_cash_flow >= 0:
                break_even_year = year

            annual_projections.append({
                "year": year,
                "production_kwh": round(production, 2),
                "savings": round(net_annual, 2),
                "cumulative_savings": round(cumulative_savings, 2),
                "cumulative_cash_flow": round(cumulative_cash_flow, 2)
            })

        year_one_savings = annual_projections[0]["savings"]
        simple_payback = net_cost / year_one_savings if year_one_savings > 0 else float('inf')
        
        npv = self._calculate_npv(net_cost, annual_projections, self.DISCOUNT_RATE)
        
        irr = self._calculate_irr(net_cost, annual_projections)

        return SolarROIResult(
            system_size_kw=inputs.system_size_kw,
            installation_cost=inputs.installation_cost,
            year_one_production_kwh=round(year_one_production, 2),
            year_one_savings=round(year_one_savings, 2),
            simple_payback_years=round(simple_payback, 2),
            net_present_value=round(npv, 2),
            internal_rate_of_return=round(irr * 100, 2),
            lifetime_savings=round(cumulative_savings, 2),
            break_even_year=break_even_year,
            annual_projections=annual_projections
        )

    def _calculate_npv(
        self, initial_cost: float, projections: List[dict], discount_rate: float
    ) -> float:
        """
        Calculate Net Present Value of the investment.
        
        NPV = -Initial Cost + Sum(Cash Flow_t / (1 + r)^t)
        
        Args:
            initial_cost: Initial investment
            projections: Annual cash flow projections
            discount_rate: Discount rate (e.g., 0.06 for 6%)
            
        Returns:
            NPV value
        """
        npv = -initial_cost
        for proj in projections:
            year = proj["year"]
            cash_flow = proj["savings"]
            npv += cash_flow / ((1 + discount_rate) ** year)
        return npv

    def _calculate_irr(
        self, initial_cost: float, projections: List[dict]
    ) -> float:
        """
        Calculate Internal Rate of Return using Newton-Raphson method.
        
        IRR is the discount rate that makes NPV = 0.
        
        Args:
            initial_cost: Initial investment
            projections: Annual cash flow projections
            
        Returns:
            IRR as a decimal (e.g., 0.12 for 12%)
        """
        cash_flows = [-initial_cost] + [p["savings"] for p in projections]
        
        rate = 0.1
        
        for _ in range(100):
            npv = sum(cf / ((1 + rate) ** i) for i, cf in enumerate(cash_flows))
            
            npv_derivative = sum(
                -i * cf / ((1 + rate) ** (i + 1)) 
                for i, cf in enumerate(cash_flows)
            )
            
            if abs(npv_derivative) < 1e-10:
                break
                
            new_rate = rate - npv / npv_derivative
            
            if abs(new_rate - rate) < 1e-6:
                break
                
            rate = max(-0.99, min(new_rate, 10))

        return rate


def get_solar_roi_calculator() -> SolarROICalculator:
    """Factory function to create a SolarROICalculator instance."""
    return SolarROICalculator()
