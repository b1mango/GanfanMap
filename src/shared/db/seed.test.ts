import { afterEach, describe, expect, it } from 'vitest'
import { createAppDatabase, type FoodMapDatabase } from './database'
import { ensureSeedData } from './seed'

describe('seed data', () => {
  const databases: FoodMapDatabase[] = []

  afterEach(async () => {
    await Promise.all(databases.splice(0).map(async (database) => database.delete()))
  })

  it('derives tag usage counts from the seeded places instead of hardcoding them', async () => {
    const testDb = createAppDatabase(`seed-test-${crypto.randomUUID()}`)
    databases.push(testDb)

    await ensureSeedData(testDb)

    // 'group' is referenced by two sample places; everything else by one.
    expect((await testDb.tags.get('group'))?.usageCount).toBe(2)
    expect((await testDb.tags.get('repeat'))?.usageCount).toBe(1)
    expect((await testDb.tags.get('quiet'))?.usageCount).toBe(1)
  })

  it('does not duplicate seed data when categories already exist', async () => {
    const testDb = createAppDatabase(`seed-test-${crypto.randomUUID()}`)
    databases.push(testDb)

    await ensureSeedData(testDb)
    await ensureSeedData(testDb)

    expect(await testDb.places.count()).toBe(3)
  })
})
