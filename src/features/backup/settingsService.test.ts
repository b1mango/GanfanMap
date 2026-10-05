import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../shared/db/database'
import { defaultSettings } from '../../shared/db/seed'
import { isValidScoreWeights, updateScoreWeights } from './settingsService'

describe('settings service', () => {
  beforeEach(async () => {
    await db.settings.put(defaultSettings)
  })

  afterEach(async () => {
    await Promise.all([db.places.clear(), db.settings.clear()])
  })

  it('persists weights and recomputes every stored overall score', async () => {
    await db.places.bulkPut([
      {
        id: 'p1',
        name: 'A',
        status: 'visited',
        categoryId: 'tea',
        tagIds: [],
        address: 'Shanghai',
        location: { lng: 121.47, lat: 31.23 },
        scores: { taste: 10, environment: 4, service: 4, value: 4 },
        overallScore: 7.6,
        notes: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'p2',
        name: 'B',
        status: 'wishlist',
        categoryId: 'tea',
        tagIds: [],
        address: 'Shanghai',
        location: { lng: 121.47, lat: 31.23 },
        notes: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
    ])

    await updateScoreWeights({ taste: 100, environment: 0, service: 0, value: 0 })

    expect((await db.settings.get('app'))?.scoreWeights).toEqual({
      taste: 100,
      environment: 0,
      service: 0,
      value: 0,
    })
    // Taste-only weights: 10 for the scored place; unscored wishlist untouched.
    expect((await db.places.get('p1'))?.overallScore).toBe(10)
    expect((await db.places.get('p2'))?.overallScore).toBeUndefined()
  })

  it('rejects invalid weights without touching settings', async () => {
    expect(isValidScoreWeights({ taste: 0, environment: 0, service: 0, value: 0 })).toBe(false)
    expect(isValidScoreWeights({ taste: 101, environment: 0, service: 0, value: 0 })).toBe(false)
    expect(isValidScoreWeights({ taste: 40, environment: 20, service: 20, value: 20 })).toBe(true)

    await expect(
      updateScoreWeights({ taste: 0, environment: 0, service: 0, value: 0 }),
    ).rejects.toThrow('评分权重需为 0-100 的整数，且至少一项大于 0')
    expect((await db.settings.get('app'))?.scoreWeights).toEqual(defaultSettings.scoreWeights)
  })
})
