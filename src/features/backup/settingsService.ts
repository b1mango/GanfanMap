import { calculateOverallScore } from '../../entities/place/rating'
import type { ScoreWeights } from '../../entities/place/types'
import { SCORE_DIMENSIONS } from '../../shared/constants'
import { db } from '../../shared/db/database'

export function isValidScoreWeights(weights: ScoreWeights): boolean {
  const values = SCORE_DIMENSIONS.map(([key]) => weights[key])
  return (
    values.every((value) => Number.isInteger(value) && value >= 0 && value <= 100) &&
    values.some((value) => value > 0)
  )
}

// Persisting new weights recomputes every stored overall score so the map,
// list and filters stay consistent with the new preference.
export async function updateScoreWeights(weights: ScoreWeights): Promise<void> {
  if (!isValidScoreWeights(weights)) {
    throw new Error('评分权重需为 0-100 的整数，且至少一项大于 0')
  }

  await db.transaction('rw', [db.settings, db.places], async () => {
    const settings = await db.settings.get('app')
    if (!settings) {
      throw new Error('应用设置缺失')
    }
    await db.settings.put({ ...settings, scoreWeights: weights })

    const places = await db.places.toArray()
    const updated = places
      .filter((place) => place.scores)
      .map((place) => ({
        ...place,
        overallScore: calculateOverallScore(place.scores!, weights),
      }))
    await db.places.bulkPut(updated)
  })
}
