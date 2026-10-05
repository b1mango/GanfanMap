import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlaceFilters, PlaceSortKey } from '../../entities/place/types'
import { DEFAULT_PRICE_RANGE, DEFAULT_SCORE_RANGE } from '../../shared/constants'

export type UiState = {
  filters: PlaceFilters
  sortKey: PlaceSortKey
  selectedPlaceId?: string
  setStatus: (status: PlaceFilters['status']) => void
  setCategory: (categoryId: string | undefined) => void
  toggleTag: (tagId: string) => void
  setScoreRange: (scoreRange: [number, number]) => void
  setPriceRange: (priceRange: [number, number]) => void
  resetFilters: () => void
  setSortKey: (sortKey: PlaceSortKey) => void
  selectPlace: (placeId: string | undefined) => void
}

const SORT_KEYS: PlaceSortKey[] = ['updated-desc', 'score-desc', 'price-asc', 'price-desc']

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      filters: createDefaultFilters(),
      sortKey: 'updated-desc',
      selectedPlaceId: undefined,
      setStatus: (status) => set((state) => ({ filters: { ...state.filters, status } })),
      setCategory: (categoryId) => set((state) => ({ filters: { ...state.filters, categoryId } })),
      toggleTag: (tagId) =>
        set((state) => ({
          filters: {
            ...state.filters,
            tagIds: state.filters.tagIds.includes(tagId)
              ? state.filters.tagIds.filter((id) => id !== tagId)
              : [...state.filters.tagIds, tagId],
          },
        })),
      setScoreRange: (scoreRange) => set((state) => ({ filters: { ...state.filters, scoreRange } })),
      setPriceRange: (priceRange) => set((state) => ({ filters: { ...state.filters, priceRange } })),
      resetFilters: () => set({ filters: createDefaultFilters() }),
      setSortKey: (sortKey) => set({ sortKey }),
      selectPlace: (placeId) => set({ selectedPlaceId: placeId }),
    }),
    {
      name: 'fan-map-ui',
      // Only filters and sort survive reloads; selection is session-scoped.
      partialize: (state) => ({ filters: state.filters, sortKey: state.sortKey }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Pick<UiState, 'filters' | 'sortKey'>>
        return {
          ...current,
          filters: sanitizeFilters(stored.filters),
          sortKey: SORT_KEYS.includes(stored.sortKey as PlaceSortKey)
            ? (stored.sortKey as PlaceSortKey)
            : current.sortKey,
        }
      },
    },
  ),
)

function createDefaultFilters(): PlaceFilters {
  return {
    status: 'all',
    tagIds: [],
    scoreRange: [DEFAULT_SCORE_RANGE[0], DEFAULT_SCORE_RANGE[1]],
    priceRange: [DEFAULT_PRICE_RANGE[0], DEFAULT_PRICE_RANGE[1]],
  }
}

function sanitizeFilters(input: unknown): PlaceFilters {
  const fallback = createDefaultFilters()

  if (typeof input !== 'object' || input === null) {
    return fallback
  }

  const record = input as Partial<PlaceFilters>
  return {
    status:
      record.status === 'visited' || record.status === 'wishlist' || record.status === 'all'
        ? record.status
        : fallback.status,
    categoryId: typeof record.categoryId === 'string' ? record.categoryId : undefined,
    tagIds: Array.isArray(record.tagIds)
      ? record.tagIds.filter((tagId): tagId is string => typeof tagId === 'string')
      : fallback.tagIds,
    scoreRange: sanitizeRange(record.scoreRange, fallback.scoreRange),
    priceRange: sanitizeRange(record.priceRange, fallback.priceRange),
  }
}

function sanitizeRange(input: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(input) || input.length !== 2) {
    return fallback
  }

  const [start, end] = input
  return typeof start === 'number' &&
    typeof end === 'number' &&
    Number.isFinite(start) &&
    Number.isFinite(end)
    ? [start, end]
    : fallback
}
