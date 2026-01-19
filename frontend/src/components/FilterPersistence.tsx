import { useEffect, useState } from 'react'

const FILTER_STORAGE_KEY = 'saveit_filters'

interface FilterState {
  [page: string]: {
    [filterName: string]: unknown
  }
}

function getStoredFilters(): FilterState {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function saveFilters(filters: FilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    console.warn('Could not save filters to localStorage')
  }
}

export function usePersistedFilter<T>(
  page: string,
  filterName: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const filters = getStoredFilters()
    const pageFilters = filters[page]
    if (pageFilters && filterName in pageFilters) {
      return pageFilters[filterName] as T
    }
    return defaultValue
  })

  const setPersistedValue = (newValue: T) => {
    setValue(newValue)
    const filters = getStoredFilters()
    if (!filters[page]) {
      filters[page] = {}
    }
    filters[page][filterName] = newValue
    saveFilters(filters)
  }

  return [value, setPersistedValue]
}

export function clearPageFilters(page: string): void {
  const filters = getStoredFilters()
  delete filters[page]
  saveFilters(filters)
}

export function clearAllFilters(): void {
  localStorage.removeItem(FILTER_STORAGE_KEY)
}
