import { describe, expect, it } from 'vitest'
import type { Place } from './types'
import { filterPlaces, hasActiveFilters, sortPlaces } from './filter'

const places: Place[] = [
  {
    id: 'p1',
    name: '荔枝巷',
    status: 'visited',
    categoryId: 'tea',
    tagIds: ['quiet', 'repeat'],
    address: '上海市静安区',
    location: { lng: 121.45, lat: 31.23 },
    averagePrice: 88,
    scores: { taste: 9, environment: 8, service: 8, value: 7 },
    overallScore: 8.2,
    notes: '',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-12T10:00:00.000Z',
  },
  {
    id: 'p2',
    name: '炭火研究所',
    status: 'wishlist',
    categoryId: 'bbq',
    tagIds: ['group'],
    address: '上海市黄浦区',
    location: { lng: 121.49, lat: 31.22 },
    averagePrice: 168,
    notes: '',
    createdAt: '2026-06-02T10:00:00.000Z',
    updatedAt: '2026-06-14T10:00:00.000Z',
  },
]

describe('place filtering', () => {
  it('filters by status, category, tags, score and price', () => {
    expect(
      filterPlaces(places, {
        status: 'visited',
        categoryId: 'tea',
        tagIds: ['repeat'],
        scoreRange: [8, 10],
        priceRange: [0, 100],
      }).map((place) => place.id),
    ).toEqual(['p1'])
  })

  it('sorts places by score and keeps unscored wishlist items last', () => {
    expect(sortPlaces(places, 'score-desc').map((place) => place.id)).toEqual([
      'p1',
      'p2',
    ])
  })

  it('detects active filters against the default ranges', () => {
    expect(
      hasActiveFilters({
        status: 'all',
        tagIds: [],
        scoreRange: [1, 10],
        priceRange: [0, 500],
      }),
    ).toBe(false)

    expect(
      hasActiveFilters({
        status: 'visited',
        tagIds: [],
        scoreRange: [1, 10],
        priceRange: [0, 500],
      }),
    ).toBe(true)

    expect(
      hasActiveFilters({
        status: 'all',
        tagIds: [],
        scoreRange: [1, 10],
        priceRange: [0, 300],
      }),
    ).toBe(true)
  })
})
