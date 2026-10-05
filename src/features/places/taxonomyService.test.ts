import { afterEach, describe, expect, it } from 'vitest'
import { createAppDatabase } from '../../shared/db/database'
import type { FoodMapDatabase } from '../../shared/db/database'
import { createTaxonomyService } from './taxonomyService'

describe('taxonomy service', () => {
  afterEach(async () => {
    await indexedDB.deleteDatabase('test-taxonomy-map')
  })

  it('creates and updates categories with normalized names and colors', async () => {
    const db = createTestDatabase()
    const service = createTaxonomyService(db)
    await seedTaxonomy(db)

    const category = await service.createCategory({ name: '  粤菜  ', color: '#2f6f4f' })
    expect(category.name).toBe('粤菜')
    expect(category.order).toBe(3)

    const updatedCategory = await service.updateCategory(category.id, {
      name: '潮汕菜',
      color: '#bb3e2f',
    })
    expect(updatedCategory.name).toBe('潮汕菜')
    expect(updatedCategory.color).toBe('#bb3e2f')
  })

  it('reassigns places to the next category when deleting a category', async () => {
    const db = createTestDatabase()
    const service = createTaxonomyService(db)
    await seedTaxonomy(db)
    await db.places.add({
      id: 'p1',
      name: '雾社火锅',
      status: 'visited',
      categoryId: 'hotpot',
      tagIds: ['group'],
      address: '上海市徐汇区',
      location: { lng: 121.43, lat: 31.2 },
      averagePrice: 216,
      notes: '',
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    })

    const fallbackCategoryId = await service.deleteCategory('hotpot')
    const place = await db.places.get('p1')

    expect(fallbackCategoryId).toBe('tea')
    expect(await db.categories.get('hotpot')).toBeUndefined()
    expect(place?.categoryId).toBe('tea')
  })

  it('removes deleted tags from all affected places', async () => {
    const db = createTestDatabase()
    const service = createTaxonomyService(db)
    await seedTaxonomy(db)
    await db.places.add({
      id: 'p1',
      name: '荔枝巷茶室',
      status: 'visited',
      categoryId: 'tea',
      tagIds: ['repeat', 'group'],
      address: '上海市静安区',
      location: { lng: 121.45, lat: 31.22 },
      notes: '',
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    })

    await service.deleteTag('group')
    const place = await db.places.get('p1')

    expect(await db.tags.get('group')).toBeUndefined()
    expect(place?.tagIds).toEqual(['repeat'])
  })

  it('rejects duplicate taxonomy names case-insensitively', async () => {
    const db = createTestDatabase()
    const service = createTaxonomyService(db)
    await seedTaxonomy(db)

    await expect(service.createTag({ name: '适合聚餐', color: '#9b7a27' })).rejects.toThrow(
      '标签名称已存在',
    )
  })
})

function createTestDatabase(): FoodMapDatabase {
  return createAppDatabase('test-taxonomy-map')
}

async function seedTaxonomy(db: FoodMapDatabase): Promise<void> {
  await db.categories.bulkPut([
    { id: 'tea', name: '下午茶', color: '#c84c36', icon: 'CupSoda', order: 1, hidden: false },
    { id: 'hotpot', name: '火锅', color: '#bb3e2f', icon: 'Utensils', order: 2, hidden: false },
  ])
  await db.tags.bulkPut([
    { id: 'repeat', name: '会复吃', color: '#c84c36', usageCount: 1 },
    { id: 'group', name: '适合聚餐', color: '#9b7a27', usageCount: 1 },
  ])
}
