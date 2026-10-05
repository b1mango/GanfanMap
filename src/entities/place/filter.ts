import { DEFAULT_PRICE_RANGE, DEFAULT_SCORE_RANGE } from '../../shared/constants'
import type { Place, PlaceFilters, PlaceSortKey } from './types'

export function hasActiveFilters(filters: PlaceFilters): boolean {
  return (
    filters.status !== 'all' ||
    Boolean(filters.categoryId) ||
    filters.tagIds.length > 0 ||
    filters.scoreRange[0] !== DEFAULT_SCORE_RANGE[0] ||
    filters.scoreRange[1] !== DEFAULT_SCORE_RANGE[1] ||
    filters.priceRange[0] !== DEFAULT_PRICE_RANGE[0] ||
    filters.priceRange[1] !== DEFAULT_PRICE_RANGE[1]
  )
}

export function filterPlaces(places: Place[], filters: PlaceFilters): Place[] {
  return places.filter((place) => {
    if (filters.status !== 'all' && place.status !== filters.status) {
      return false
    }

    if (filters.categoryId && place.categoryId !== filters.categoryId) {
      return false
    }

    if (
      filters.tagIds.length > 0 &&
      !filters.tagIds.every((tagId) => place.tagIds.includes(tagId))
    ) {
      return false
    }

    if (
      place.overallScore !== undefined &&
      (place.overallScore < filters.scoreRange[0] ||
        place.overallScore > filters.scoreRange[1])
    ) {
      return false
    }

    if (
      place.averagePrice !== undefined &&
      (place.averagePrice < filters.priceRange[0] ||
        place.averagePrice > filters.priceRange[1])
    ) {
      return false
    }

    return true
  })
}

export function sortPlaces(places: Place[], sortKey: PlaceSortKey): Place[] {
  return [...places].sort((left, right) => {
    if (sortKey === 'score-desc') {
      return scoreValue(right) - scoreValue(left)
    }

    if (sortKey === 'price-asc') {
      return priceValue(left, Number.POSITIVE_INFINITY) - priceValue(right, Number.POSITIVE_INFINITY)
    }

    if (sortKey === 'price-desc') {
      return priceValue(right, 0) - priceValue(left, 0)
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  })
}

function scoreValue(place: Place): number {
  return place.overallScore ?? Number.NEGATIVE_INFINITY
}

function priceValue(place: Place, fallback: number): number {
  return place.averagePrice ?? fallback
}
