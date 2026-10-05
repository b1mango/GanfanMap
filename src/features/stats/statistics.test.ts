import { describe, expect, it } from 'vitest'
import type { Category, Place, Visit } from '../../entities/place/types'
import { computeStats } from './statistics'

const categories: Category[] = [
  { id: 'tea', name: '下午茶', color: '#c84c36', icon: 'CupSoda', order: 1, hidden: false },
  { id: 'hotpot', name: '火锅', color: '#bb3e2f', icon: 'Utensils', order: 2, hidden: false },
  { id: 'bbq', name: '烧烤', color: '#485f3f', icon: 'Flame', order: 3, hidden: false },
]

const places: Place[] = [
  createPlace({ id: 'p1', name: '荔枝巷茶室', status: 'visited', categoryId: 'tea' }),
  createPlace({ id: 'p2', name: '雾社火锅', status: 'visited', categoryId: 'hotpot' }),
  createPlace({ id: 'p3', name: '炭火研究所', status: 'wishlist', categoryId: 'hotpot' }),
]

const visits: Visit[] = [
  createVisit({ id: 'v1', placeId: 'p1', date: '2026-07-02', amount: 90 }),
  createVisit({ id: 'v2', placeId: 'p1', date: '2026-07-08', amount: 110 }),
  createVisit({ id: 'v3', placeId: 'p2', date: '2026-06-18', amount: 200 }),
]

describe('computeStats', () => {
  it('aggregates totals, month figures, category breakdown, and top places', () => {
    const stats = computeStats(places, visits, categories, new Date('2026-07-12T10:00:00'))

    expect(stats.totalPlaces).toBe(3)
    expect(stats.visitedPlaces).toBe(2)
    expect(stats.wishlistPlaces).toBe(1)
    expect(stats.totalVisits).toBe(3)
    expect(stats.totalSpending).toBe(400)
    expect(stats.monthLabel).toBe('7 月')
    expect(stats.monthVisits).toBe(2)
    expect(stats.monthSpending).toBe(200)
    expect(stats.categoryBreakdown).toEqual([
      { categoryId: 'hotpot', name: '火锅', color: '#bb3e2f', count: 2 },
      { categoryId: 'tea', name: '下午茶', color: '#c84c36', count: 1 },
    ])
    expect(stats.topPlaces).toEqual([
      { placeId: 'p1', name: '荔枝巷茶室', visitCount: 2, totalAmount: 200 },
      { placeId: 'p2', name: '雾社火锅', visitCount: 1, totalAmount: 200 },
    ])
  })

  it('handles empty data without crashing', () => {
    const stats = computeStats([], [], categories, new Date('2026-07-12T10:00:00'))

    expect(stats.totalPlaces).toBe(0)
    expect(stats.totalSpending).toBe(0)
    expect(stats.categoryBreakdown).toEqual([])
    expect(stats.topPlaces).toEqual([])
  })
})

function createPlace(overrides: Partial<Place>): Place {
  return {
    id: 'p0',
    name: '店',
    status: 'visited',
    categoryId: 'tea',
    tagIds: [],
    address: '上海',
    location: { lng: 121.47, lat: 31.23 },
    notes: '',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  }
}

function createVisit(overrides: Partial<Visit>): Visit {
  return {
    id: 'v0',
    placeId: 'p0',
    date: '2026-06-01',
    items: '',
    amount: 0,
    notes: '',
    photoIds: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  }
}
