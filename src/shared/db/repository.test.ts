import { afterEach, describe, expect, it } from 'vitest'
import { createAppDatabase } from './database'
import { createPlaceRepository } from './placeRepository'

describe('place repository', () => {
  afterEach(async () => {
    await indexedDB.deleteDatabase('test-food-map')
  })

  it('deletes visits and photos when deleting a place', async () => {
    const db = createAppDatabase('test-food-map')
    const repo = createPlaceRepository(db)

    await repo.savePlace({
      id: 'p1',
      name: '荔枝巷',
      status: 'visited',
      categoryId: 'tea',
      tagIds: ['repeat'],
      address: '上海市静安区',
      location: { lng: 121.45, lat: 31.23 },
      averagePrice: 88,
      scores: { taste: 9, environment: 8, service: 8, value: 7 },
      overallScore: 8.2,
      notes: '',
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-12T10:00:00.000Z',
    })
    await db.visits.add({
      id: 'v1',
      placeId: 'p1',
      date: '2026-06-10',
      items: '叉烧饭',
      amount: 88,
      notes: '',
      photoIds: ['ph1'],
      createdAt: '2026-06-10T10:00:00.000Z',
      updatedAt: '2026-06-10T10:00:00.000Z',
    })
    await db.photos.add({
      id: 'ph1',
      placeId: 'p1',
      visitId: 'v1',
      blob: new Blob(['image'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
      size: 5,
      purpose: 'visit',
      createdAt: '2026-06-10T10:00:00.000Z',
    })

    await repo.deletePlaceCascade('p1')

    expect(await db.places.count()).toBe(0)
    expect(await db.visits.count()).toBe(0)
    expect(await db.photos.count()).toBe(0)
  })
})
