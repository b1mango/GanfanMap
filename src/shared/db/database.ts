import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  Category,
  FoodPhoto,
  Place,
  Tag,
  Visit,
} from '../../entities/place/types'

export type FoodMapDatabase = Dexie & {
  places: EntityTable<Place, 'id'>
  visits: EntityTable<Visit, 'id'>
  photos: EntityTable<FoodPhoto, 'id'>
  categories: EntityTable<Category, 'id'>
  tags: EntityTable<Tag, 'id'>
  settings: EntityTable<AppSettings, 'id'>
}

export function createAppDatabase(name = 'food-map-guide'): FoodMapDatabase {
  const db = new Dexie(name) as FoodMapDatabase

  db.version(1).stores({
    places:
      'id, status, categoryId, overallScore, averagePrice, updatedAt, [status+categoryId], *tagIds',
    visits: 'id, placeId, date, amount, [placeId+date]',
    photos: 'id, placeId, visitId, createdAt',
    categories: 'id, &name, order, hidden',
    tags: 'id, &name, usageCount',
    settings: 'id',
  })

  return db
}

export const db = createAppDatabase()

