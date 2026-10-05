import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import type { Category, Place, Tag, Visit } from '../../entities/place/types'
import { db } from '../../shared/db/database'
import { defaultSettings } from '../../shared/db/seed'
import {
  addVisitDraft,
  deletePhoto,
  deletePlace,
  deleteVisit,
  markPlaceVisited,
  savePlaceDraft,
  updatePlaceDraft,
  updateVisit,
} from './placeService'

const testCategory: Category = {
  id: 'tea',
  name: 'Tea',
  color: '#c84c36',
  icon: 'CupSoda',
  order: 1,
  hidden: false,
}

const testTags: Tag[] = [
  { id: 'repeat', name: 'Repeat', color: '#c84c36', usageCount: 0 },
  { id: 'group', name: 'Group', color: '#9b7a27', usageCount: 0 },
  { id: 'quiet', name: 'Quiet', color: '#485f3f', usageCount: 0 },
]

describe('place service', () => {
  beforeEach(async () => {
    await clearDatabase()
    await db.settings.put(defaultSettings)
    await db.categories.put(testCategory)
    await db.tags.bulkPut(testTags)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await clearDatabase()
  })

  it('returns the newly created visit instead of the last existing visit for the same place', async () => {
    await db.places.put(createPlace({ id: 'p1' }))
    await db.visits.put(
      createVisit({
        id: 'visit_old',
        placeId: 'p1',
        date: '2026-06-01',
        updatedAt: '2026-06-01T10:00:00.000Z',
      }),
    )

    const savedVisit = await addVisitDraft({
      placeId: 'p1',
      date: '2026-06-22',
      items: 'noodle',
      amount: 38,
      notes: 'late dinner',
      photos: [],
    })

    expect(savedVisit.id).not.toBe('visit_old')
    expect(savedVisit.date).toBe('2026-06-22')
    expect(savedVisit.items).toBe('noodle')
    expect(await db.visits.get(savedVisit.id)).toMatchObject({
      amount: 38,
      date: '2026-06-22',
      items: 'noodle',
    })
  })

  it('saves a compressed photo with its new visit', async () => {
    await db.places.put(createPlace({ id: 'p1' }))

    class TestImage {
      width = 800
      height = 600
      onload: (() => void) | null = null

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }

    vi.stubGlobal('Image', TestImage)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-photo')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      setTimeout(() => callback(new Blob(['compressed'], { type: 'image/jpeg' })), 0)
    })

    const savedVisit = await addVisitDraft({
      placeId: 'p1',
      date: '2026-06-22',
      items: 'noodle',
      amount: 38,
      notes: 'late dinner',
      photos: [new File(['photo'], 'dinner.png', { type: 'image/png' })],
    })

    expect(savedVisit.photoIds).toHaveLength(1)
    const photoId = savedVisit.photoIds[0]!
    const savedPhoto = await db.photos.get(photoId)

    expect(savedPhoto).toBeDefined()
    expect(savedPhoto?.placeId).toBe('p1')
    expect(savedPhoto?.visitId).toBe(savedVisit.id)
    expect(await db.visits.get(savedVisit.id)).toEqual(savedVisit)
  })

  it('normalizes zero average price to undefined when saving a place', async () => {
    const place = await savePlaceDraft({
      name: 'Zero Price Place',
      status: 'visited',
      categoryId: testCategory.id,
      tagIds: [],
      address: 'Shanghai',
      lng: 121.47,
      lat: 31.23,
      averagePrice: 0,
      scores: { taste: 8, environment: 8, service: 8, value: 8 },
      notes: '',
    })

    expect(place.averagePrice).toBeUndefined()
    expect((await db.places.get(place.id))?.averagePrice).toBeUndefined()
  })

  it('keeps tag usage counts in sync when creating, updating, and deleting a place', async () => {
    const createdPlace = await savePlaceDraft({
      name: 'Tagged Place',
      status: 'visited',
      categoryId: testCategory.id,
      tagIds: ['repeat', 'group'],
      address: 'Shanghai',
      lng: 121.47,
      lat: 31.23,
      averagePrice: 88,
      scores: { taste: 8, environment: 8, service: 8, value: 8 },
      notes: '',
    })

    expect(await readTagUsageCounts()).toEqual({
      group: 1,
      quiet: 0,
      repeat: 1,
    })

    await updatePlaceDraft(createdPlace.id, {
      name: 'Tagged Place',
      status: 'visited',
      categoryId: testCategory.id,
      tagIds: ['group', 'quiet'],
      address: 'Shanghai',
      lng: 121.47,
      lat: 31.23,
      averagePrice: 88,
      scores: { taste: 8, environment: 8, service: 8, value: 8 },
      notes: '',
    })

    expect(await readTagUsageCounts()).toEqual({
      group: 1,
      quiet: 1,
      repeat: 0,
    })

    await deletePlace(createdPlace.id)

    expect(await readTagUsageCounts()).toEqual({
      group: 0,
      quiet: 0,
      repeat: 0,
    })
  })

  it('rejects invalid place drafts before saving', async () => {
    await expect(
      savePlaceDraft({
        name: '   ',
        status: 'visited',
        categoryId: testCategory.id,
        tagIds: [],
        address: 'Shanghai',
        lng: 121.47,
        lat: 31.23,
        averagePrice: 88,
        scores: { taste: 8, environment: 8, service: 8, value: 8 },
        notes: '',
      }),
    ).rejects.toThrow('店铺名称不能为空')

    await expect(
      savePlaceDraft({
        name: 'Invalid Coordinates',
        status: 'visited',
        categoryId: testCategory.id,
        tagIds: [],
        address: 'Shanghai',
        lng: 200,
        lat: 31.23,
        averagePrice: 88,
        scores: { taste: 8, environment: 8, service: 8, value: 8 },
        notes: '',
      }),
    ).rejects.toThrow('坐标不合法')

    await expect(
      savePlaceDraft({
        name: 'Invalid Score',
        status: 'visited',
        categoryId: testCategory.id,
        tagIds: [],
        address: 'Shanghai',
        lng: 121.47,
        lat: 31.23,
        averagePrice: 88,
        scores: { taste: 11, environment: 8, service: 8, value: 8 },
        notes: '',
      }),
    ).rejects.toThrow('评分必须在 1-10 之间')
  })

  it('rejects places that reference missing categories or tags', async () => {
    await expect(
      savePlaceDraft({
        name: 'Missing Category',
        status: 'visited',
        categoryId: 'missing',
        tagIds: [],
        address: 'Shanghai',
        lng: 121.47,
        lat: 31.23,
        averagePrice: 88,
        scores: { taste: 8, environment: 8, service: 8, value: 8 },
        notes: '',
      }),
    ).rejects.toThrow('分类不存在')

    await expect(
      savePlaceDraft({
        name: 'Missing Tag',
        status: 'visited',
        categoryId: testCategory.id,
        tagIds: ['repeat', 'missing'],
        address: 'Shanghai',
        lng: 121.47,
        lat: 31.23,
        averagePrice: 88,
        scores: { taste: 8, environment: 8, service: 8, value: 8 },
        notes: '',
      }),
    ).rejects.toThrow('标签不存在')
  })

  it('updates a visit and recalculates the place average price', async () => {
    await db.places.put(createPlace({ id: 'p1', averagePrice: 100 }))
    await db.visits.bulkPut([
      createVisit({ id: 'v1', placeId: 'p1', amount: 100 }),
      createVisit({ id: 'v2', placeId: 'p1', amount: 200 }),
    ])

    const updatedVisit = await updateVisit('v1', {
      date: '2026-07-01',
      items: 'set menu',
      amount: 300,
      notes: 'upgraded',
    })

    expect(updatedVisit.amount).toBe(300)
    expect(updatedVisit.date).toBe('2026-07-01')
    expect(await db.visits.get('v1')).toMatchObject({ amount: 300, items: 'set menu' })
    expect((await db.places.get('p1'))?.averagePrice).toBe(250)
  })

  it('rejects invalid visit updates', async () => {
    await db.places.put(createPlace({ id: 'p1' }))
    await db.visits.put(createVisit({ id: 'v1', placeId: 'p1' }))

    await expect(
      updateVisit('missing', { date: '2026-07-01', items: '', amount: 10, notes: '' }),
    ).rejects.toThrow('消费记录不存在')
    await expect(
      updateVisit('v1', { date: '', items: '', amount: 10, notes: '' }),
    ).rejects.toThrow('消费日期格式必须为 YYYY-MM-DD')
    await expect(
      updateVisit('v1', { date: '2026-07-01', items: '', amount: -5, notes: '' }),
    ).rejects.toThrow('消费金额不能为负数')
  })

  it('deletes a visit with its photos and recalculates the place average price', async () => {
    await db.places.put(createPlace({ id: 'p1', averagePrice: 150 }))
    await db.visits.bulkPut([
      createVisit({ id: 'v1', placeId: 'p1', amount: 100, photoIds: ['ph1'] }),
      createVisit({ id: 'v2', placeId: 'p1', amount: 200 }),
    ])
    await db.photos.put({
      id: 'ph1',
      placeId: 'p1',
      visitId: 'v1',
      blob: new Blob(['x']),
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
      size: 1,
      purpose: 'visit',
      createdAt: '2026-06-01T10:00:00.000Z',
    })

    await deleteVisit('v1')

    expect(await db.visits.get('v1')).toBeUndefined()
    expect(await db.photos.get('ph1')).toBeUndefined()
    expect((await db.places.get('p1'))?.averagePrice).toBe(200)

    await deleteVisit('v2')
    expect((await db.places.get('p1'))?.averagePrice).toBeUndefined()
  })

  it('deletes a single photo and unlinks it from its visit', async () => {
    await db.places.put(createPlace({ id: 'p1' }))
    await db.visits.put(createVisit({ id: 'v1', placeId: 'p1', photoIds: ['ph1', 'ph2'] }))
    await db.photos.bulkPut([
      {
        id: 'ph1',
        placeId: 'p1',
        visitId: 'v1',
        blob: new Blob(['x']),
        mimeType: 'image/jpeg',
        width: 10,
        height: 10,
        size: 1,
        purpose: 'visit',
        createdAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: 'ph2',
        placeId: 'p1',
        visitId: 'v1',
        blob: new Blob(['y']),
        mimeType: 'image/jpeg',
        width: 10,
        height: 10,
        size: 1,
        purpose: 'visit',
        createdAt: '2026-06-01T10:00:00.000Z',
      },
    ])

    await deletePhoto('ph1')

    expect(await db.photos.get('ph1')).toBeUndefined()
    expect(await db.photos.get('ph2')).toBeTruthy()
    expect((await db.visits.get('v1'))?.photoIds).toEqual(['ph2'])

    await expect(deletePhoto('missing')).resolves.toBeUndefined()
  })

  it('uses custom score weights when computing overall score', async () => {
    await db.settings.put({
      ...defaultSettings,
      scoreWeights: { taste: 100, environment: 0, service: 0, value: 0 },
    })
    await db.places.put(
      createPlace({ id: 'p1', status: 'wishlist', scores: undefined, overallScore: undefined }),
    )

    const updatedPlace = await markPlaceVisited('p1', {
      taste: 9,
      environment: 1,
      service: 1,
      value: 1,
    })

    expect(updatedPlace.overallScore).toBe(9)
  })

  it('marks a wishlist place as visited with scores and overall score', async () => {
    await db.places.put(
      createPlace({ id: 'p1', status: 'wishlist', scores: undefined, overallScore: undefined }),
    )

    const updatedPlace = await markPlaceVisited('p1', {
      taste: 9,
      environment: 8,
      service: 8,
      value: 7,
    })

    expect(updatedPlace.status).toBe('visited')
    expect(updatedPlace.overallScore).toBe(8.2)
    expect(await db.places.get('p1')).toMatchObject({
      status: 'visited',
      overallScore: 8.2,
    })

    await expect(
      markPlaceVisited('p1', { taste: 11, environment: 8, service: 8, value: 7 }),
    ).rejects.toThrow('评分必须在 1-10 之间')
    await expect(
      markPlaceVisited('missing', { taste: 8, environment: 8, service: 8, value: 8 }),
    ).rejects.toThrow('店铺不存在')
  })

  it('keeps place photo urls normalized when saving', async () => {
    const place = await savePlaceDraft({
      name: 'Photo Place',
      status: 'wishlist',
      categoryId: testCategory.id,
      tagIds: [],
      address: 'Shanghai',
      lng: 121.47,
      lat: 31.23,
      notes: '',
      photoUrls: [
        ' https://store.example/a.jpg ',
        'https://store.example/a.jpg',
        'javascript:alert(1)',
        'https://store.example/b.jpg',
      ],
    })

    expect(place.photoUrls).toEqual([
      'https://store.example/a.jpg',
      'https://store.example/b.jpg',
    ])
  })

  it('rejects invalid visit drafts before saving', async () => {
    await expect(
      addVisitDraft({
        placeId: 'missing',
        date: '2026-06-22',
        items: 'noodle',
        amount: 38,
        notes: '',
        photos: [],
      }),
    ).rejects.toThrow('店铺不存在')

    await db.places.put(createPlace({ id: 'p1' }))

    await expect(
      addVisitDraft({
        placeId: 'p1',
        date: '2026-06-22',
        items: 'noodle',
        amount: -1,
        notes: '',
        photos: [],
      }),
    ).rejects.toThrow('消费金额不能为负数')
  })

})

async function readTagUsageCounts(): Promise<Record<string, number>> {
  const tags = await db.tags.toArray()

  return Object.fromEntries(
    tags
      .map((tag) => [tag.id, tag.usageCount] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

function createPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place_1',
    name: 'Test Place',
    status: 'visited',
    categoryId: testCategory.id,
    tagIds: [],
    address: 'Shanghai',
    location: { lng: 121.47, lat: 31.23 },
    averagePrice: 88,
    scores: { taste: 8, environment: 8, service: 8, value: 8 },
    overallScore: 8,
    notes: '',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  }
}

function createVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'visit_1',
    placeId: 'place_1',
    date: '2026-06-01',
    items: 'tea',
    amount: 28,
    notes: '',
    photoIds: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  }
}

async function clearDatabase(): Promise<void> {
  await Promise.all([
    db.places.clear(),
    db.visits.clear(),
    db.photos.clear(),
    db.categories.clear(),
    db.tags.clear(),
    db.settings.clear(),
  ])
}
