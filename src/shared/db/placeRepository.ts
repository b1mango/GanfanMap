import type { FoodMapDatabase } from './database'
import { db } from './database'
import type { Place } from '../../entities/place/types'

export function createPlaceRepository(db: FoodMapDatabase) {
  return {
    async savePlace(place: Place): Promise<void> {
      await db.places.put(place)
    },

    async deletePlaceCascade(placeId: string): Promise<void> {
      await db.transaction('rw', db.places, db.visits, db.photos, async () => {
        const visits = await db.visits.where('placeId').equals(placeId).toArray()
        const visitIds = visits.map((visit) => visit.id)

        await db.photos.where('placeId').equals(placeId).delete()
        for (const visitId of visitIds) {
          await db.photos.where('visitId').equals(visitId).delete()
        }

        await db.visits.where('placeId').equals(placeId).delete()
        await db.places.delete(placeId)
      })
    },
  }
}

export const placeRepository = createPlaceRepository(db)
