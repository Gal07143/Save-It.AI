export function formatNumber(value: number | null | undefined, decimals: number = 3): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return value.toFixed(decimals);
}

export function formatCurrency(value: number | null | undefined, currency: string = 'USD', decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPower(value: number | null | undefined, unit: string = 'kW'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(3)} ${unit}`;
}

export function formatEnergy(value: number | null | undefined, unit: string = 'kWh'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(3)} GWh`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(3)} MWh`;
  }
  return `${value.toFixed(3)} ${unit}`;
}

export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(decimals)}%`;
}

export function formatVoltage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(1)} V`;
}

export function formatCurrent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(3)} A`;
}

export function formatTemperature(value: number | null | undefined, unit: string = 'C'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(1)}°${unit}`;
}

export function formatFrequency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(2)} Hz`;
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }
  return value.toFixed(3);
}
