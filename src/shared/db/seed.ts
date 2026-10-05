import { defaultScoreWeights } from '../../entities/place/rating'
import type { AppSettings, Category, Place, Tag, Visit } from '../../entities/place/types'
import type { FoodMapDatabase } from './database'

export const defaultCategories: Category[] = [
  { id: 'tea', name: '下午茶', color: '#c84c36', icon: 'CupSoda', order: 1, hidden: false },
  { id: 'shunde', name: '顺德菜', color: '#9b7a27', icon: 'Soup', order: 2, hidden: false },
  { id: 'bbq', name: '烧烤', color: '#485f3f', icon: 'Flame', order: 3, hidden: false },
  { id: 'grill', name: '烤肉', color: '#792f2a', icon: 'Beef', order: 4, hidden: false },
  { id: 'hotpot', name: '火锅', color: '#bb3e2f', icon: 'Utensils', order: 5, hidden: false },
  { id: 'coffee', name: '咖啡', color: '#6d5942', icon: 'Coffee', order: 6, hidden: false },
]

export const defaultTags: Tag[] = [
  { id: 'repeat', name: '会复吃', color: '#c84c36', usageCount: 1 },
  { id: 'quiet', name: '安静', color: '#485f3f', usageCount: 1 },
  { id: 'group', name: '适合聚餐', color: '#9b7a27', usageCount: 1 },
  { id: 'queue', name: '可能排队', color: '#6d5942', usageCount: 1 },
  { id: 'signature', name: '有必点菜', color: '#792f2a', usageCount: 1 },
]

export const defaultSettings: AppSettings = {
  id: 'app',
  backupVersion: 1,
  scoreWeights: defaultScoreWeights,
}

const samplePlaces: Place[] = [
  {
    id: 'sample_litchi',
    name: '荔枝巷茶室',
    status: 'visited',
    categoryId: 'tea',
    tagIds: ['quiet', 'repeat', 'signature'],
    address: '上海市静安区愚园路 68 号',
    location: { lng: 121.445, lat: 31.226 },
    averagePrice: 92,
    scores: { taste: 9, environment: 9, service: 8, value: 7 },
    overallScore: 8.4,
    notes: '适合下午慢慢坐，招牌荔枝乌龙和咸奶油卷值得复吃。',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-12T10:00:00.000Z',
  },
  {
    id: 'sample_grill',
    name: '炭火研究所',
    status: 'wishlist',
    categoryId: 'bbq',
    tagIds: ['group', 'queue'],
    address: '上海市黄浦区进贤路 21 号',
    location: { lng: 121.468, lat: 31.221 },
    averagePrice: 168,
    notes: '朋友推荐的夜宵烧烤，想试牛油小串和烤茄子。',
    createdAt: '2026-06-02T10:00:00.000Z',
    updatedAt: '2026-06-14T10:00:00.000Z',
  },
  {
    id: 'sample_hotpot',
    name: '雾社火锅',
    status: 'visited',
    categoryId: 'hotpot',
    tagIds: ['group'],
    address: '上海市徐汇区衡山路 188 号',
    location: { lng: 121.439, lat: 31.203 },
    averagePrice: 216,
    scores: { taste: 8, environment: 9, service: 9, value: 7 },
    overallScore: 8.2,
    notes: '空间漂亮，适合多人，锅底稳定但价格偏高。',
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
  },
]

const sampleVisits: Visit[] = [
  {
    id: 'visit_litchi_1',
    placeId: 'sample_litchi',
    date: '2026-06-12',
    items: '荔枝乌龙、咸奶油卷、桂花冻',
    amount: 92,
    notes: '甜度克制，适合下午茶地图第一梯队。',
    photoIds: [],
    createdAt: '2026-06-12T10:00:00.000Z',
    updatedAt: '2026-06-12T10:00:00.000Z',
  },
  {
    id: 'visit_hotpot_1',
    placeId: 'sample_hotpot',
    date: '2026-06-18',
    items: '番茄锅、雪花牛肉、贡菜丸子',
    amount: 216,
    notes: '环境和服务加分，适合约饭。',
    photoIds: [],
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
  },
]

export async function ensureSeedData(db: FoodMapDatabase): Promise<void> {
  const [categoryCount, settings] = await Promise.all([
    db.categories.count(),
    db.settings.get('app'),
  ])

  if (!settings) {
    await db.settings.put(defaultSettings)
  }

  if (categoryCount > 0) {
    return
  }

  await db.transaction('rw', db.categories, db.tags, db.places, db.visits, async () => {
    // Derive usage counts from the sample places instead of hardcoding them,
    // so the numbers can never drift from the seed data.
    const usageCounts = new Map<string, number>()
    for (const place of samplePlaces) {
      for (const tagId of place.tagIds) {
        usageCounts.set(tagId, (usageCounts.get(tagId) ?? 0) + 1)
      }
    }

    await db.categories.bulkPut(defaultCategories)
    await db.tags.bulkPut(
      defaultTags.map((tag) => ({ ...tag, usageCount: usageCounts.get(tag.id) ?? 0 })),
    )
    await db.places.bulkPut(samplePlaces)
    await db.visits.bulkPut(sampleVisits)
  })
}

