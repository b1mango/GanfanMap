import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../../shared/db/database'
import { exportBackup, importBackup } from './backupService'
import { parseBackupPayload } from './backupSchema'

describe('backup schema', () => {
  afterEach(async () => {
    await Promise.all([
      db.places.clear(),
      db.visits.clear(),
      db.photos.clear(),
      db.categories.clear(),
      db.tags.clear(),
      db.settings.clear(),
    ])
  })

  it('accepts versioned backup payloads', () => {
    const payload = parseBackupPayload({
      version: 1,
      exportedAt: '2026-06-21T10:00:00.000Z',
      places: [],
      visits: [],
      photos: [],
      categories: [],
      tags: [],
      settings: {
        id: 'app',
        scoreWeights: { taste: 40, environment: 20, service: 20, value: 20 },
        fallbackCity: '上海',
        backupVersion: 1,
        reducedMotion: false,
      },
    })

    expect(payload.version).toBe(1)
  })

  it('rejects unversioned backup payloads', () => {
    expect(() => parseBackupPayload({ places: [] })).toThrow()
  })

  it('reports schema failures with a readable field path instead of raw zod output', async () => {
    const payload = createValidBackupPayload()
    const [firstPlace] = payload.places
    if (firstPlace) {
      firstPlace.location = { lng: 'not-a-number' as unknown as number, lat: 31.23 }
    }

    await expect(importBackup(payload)).rejects.toThrow('备份文件字段不合法：places.0.location.lng')
  })


  it('rejects backups with visits or photos that reference missing records', async () => {
    await expect(
      importBackup({
        ...createValidBackupPayload(),
        visits: [
          {
            id: 'v1',
            placeId: 'missing',
            date: '2026-06-21',
            items: 'tea',
            amount: 28,
            notes: '',
            photoIds: [],
            createdAt: '2026-06-21T10:00:00.000Z',
            updatedAt: '2026-06-21T10:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow('备份包含不存在店铺的消费记录')

    await expect(
      importBackup({
        ...createValidBackupPayload(),
        photos: [
          {
            id: 'ph1',
            placeId: 'p1',
            visitId: 'missing',
            dataUrl: undefined,
            mimeType: 'image/jpeg',
            width: 800,
            height: 600,
            size: 5,
            purpose: 'visit',
            createdAt: '2026-06-21T10:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow('备份包含不存在消费记录的照片')
  })

  it('recalculates tag usage counts when importing a backup', async () => {
    await importBackup({
      ...createValidBackupPayload(),
      tags: [
        { id: 'repeat', name: 'Repeat', color: '#c84c36', usageCount: 99 },
        { id: 'unused', name: 'Unused', color: '#485f3f', usageCount: 42 },
      ],
      places: [
        {
          id: 'p1',
          name: 'Tagged Place',
          status: 'visited',
          categoryId: 'tea',
          tagIds: ['repeat'],
          address: 'Shanghai',
          location: { lng: 121.47, lat: 31.23 },
          scores: { taste: 8, environment: 8, service: 8, value: 8 },
          overallScore: 8,
          notes: '',
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
    })

    const tags = await db.tags.toArray()
    expect(Object.fromEntries(tags.map((tag) => [tag.id, tag.usageCount]))).toEqual({
      repeat: 1,
      unused: 0,
    })
  })

  it('imports legacy backups with zero average price without preserving an invalid zero value', async () => {    await importBackup({
      version: 1,
      exportedAt: '2026-06-21T10:00:00.000Z',
      places: [
        {
          id: 'p1',
          name: 'Legacy Place',
          status: 'visited',
          categoryId: 'tea',
          tagIds: [],
          address: 'Shanghai',
          location: { lng: 121.47, lat: 31.23 },
          averagePrice: 0,
          scores: { taste: 8, environment: 8, service: 8, value: 8 },
          overallScore: 8,
          notes: '',
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        },
      ],
      visits: [],
      photos: [],
      categories: [
        {
          id: 'tea',
          name: 'Tea',
          color: '#c84c36',
          icon: 'CupSoda',
          order: 1,
          hidden: false,
        },
      ],
      tags: [],
      settings: {
        id: 'app',
        scoreWeights: { taste: 40, environment: 20, service: 20, value: 20 },
        fallbackCity: 'Shanghai',
        backupVersion: 1,
        reducedMotion: false,
      },
    })

    expect((await db.places.get('p1'))?.averagePrice).toBeUndefined()
  })

  it('round-trips places and photo blobs through export and re-import', async () => {
    const firstImport = await importBackup({
      ...createValidBackupPayload(),
      photos: [
        {
          id: 'ph1',
          placeId: 'p1',
          dataUrl: 'data:image/jpeg;base64,aGVsbG8=',
          mimeType: 'image/jpeg',
          width: 2,
          height: 2,
          size: 5,
          purpose: 'place',
          createdAt: '2026-06-21T10:00:00.000Z',
        },
      ],
    })
    expect(firstImport.skippedPhotos).toBe(0)

    const exported = await exportBackup()
    expect(exported.photos[0]?.dataUrl).toMatch(/^data:/)
    expect(exported.places.map((place) => place.id)).toContain('p1')

    await Promise.all([db.places.clear(), db.photos.clear()])

    const secondImport = await importBackup(exported)
    expect(secondImport.skippedPhotos).toBe(0)
    expect(await db.places.get('p1')).toBeTruthy()
    const photo = await db.photos.get('ph1')
    expect(photo?.blob.size).toBeGreaterThan(0)
  })

  it('skips photos without image data and reports the skipped count', async () => {
    const summary = await importBackup({
      ...createValidBackupPayload(),
      photos: [
        {
          id: 'ph1',
          placeId: 'p1',
          dataUrl: undefined,
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
          size: 5,
          purpose: 'place',
          createdAt: '2026-06-21T10:00:00.000Z',
        },
      ],
    })

    expect(summary.skippedPhotos).toBe(1)
    expect(await db.photos.count()).toBe(0)
  })
})


function createValidBackupPayload() {
  return {
    version: 1,
    exportedAt: '2026-06-21T10:00:00.000Z',
    places: [
      {
        id: 'p1',
        name: 'Valid Place',
        status: 'visited',
        categoryId: 'tea',
        tagIds: [],
        address: 'Shanghai',
        location: { lng: 121.47, lat: 31.23 },
        scores: { taste: 8, environment: 8, service: 8, value: 8 },
        overallScore: 8,
        notes: '',
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-21T10:00:00.000Z',
      },
    ],
    visits: [],
    photos: [],
    categories: [
      {
        id: 'tea',
        name: 'Tea',
        color: '#c84c36',
        icon: 'CupSoda',
        order: 1,
        hidden: false,
      },
    ],
    tags: [],
    settings: {
      id: 'app',
      scoreWeights: { taste: 40, environment: 20, service: 20, value: 20 },
      fallbackCity: 'Shanghai',
      backupVersion: 1,
      reducedMotion: false,
    },
  }
}
