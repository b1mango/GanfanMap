import type { Category, Place, Visit } from '../../entities/place/types'

export type CategoryStat = {
  categoryId: string
  name: string
  color: string
  count: number
}

export type TopPlaceStat = {
  placeId: string
  name: string
  visitCount: number
  totalAmount: number
}

export type FoodMapStats = {
  totalPlaces: number
  visitedPlaces: number
  wishlistPlaces: number
  totalVisits: number
  totalSpending: number
  monthLabel: string
  monthVisits: number
  monthSpending: number
  categoryBreakdown: CategoryStat[]
  topPlaces: TopPlaceStat[]
}

export function computeStats(
  places: Place[],
  visits: Visit[],
  categories: Category[],
  now: Date = new Date(),
): FoodMapStats {
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let visitedPlaces = 0
  const placeCountByCategoryId = new Map<string, number>()
  for (const place of places) {
    if (place.status === 'visited') {
      visitedPlaces += 1
    }
    placeCountByCategoryId.set(
      place.categoryId,
      (placeCountByCategoryId.get(place.categoryId) ?? 0) + 1,
    )
  }

  let totalSpending = 0
  let monthVisits = 0
  let monthSpending = 0
  const visitAggregateByPlaceId = new Map<string, { visitCount: number; totalAmount: number }>()
  for (const visit of visits) {
    totalSpending += visit.amount
    if (visit.date.startsWith(monthPrefix)) {
      monthVisits += 1
      monthSpending += visit.amount
    }

    const aggregate = visitAggregateByPlaceId.get(visit.placeId) ?? { visitCount: 0, totalAmount: 0 }
    aggregate.visitCount += 1
    aggregate.totalAmount += visit.amount
    visitAggregateByPlaceId.set(visit.placeId, aggregate)
  }

  const categoryBreakdown = categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      color: category.color,
      count: placeCountByCategoryId.get(category.id) ?? 0,
    }))
    .filter((stat) => stat.count > 0)
    .sort((left, right) => right.count - left.count)

  const placeNameById = new Map(places.map((place) => [place.id, place.name]))
  const topPlaces = [...visitAggregateByPlaceId.entries()]
    .flatMap(([placeId, aggregate]) => {
      const name = placeNameById.get(placeId)
      return name ? [{ placeId, name, ...aggregate }] : []
    })
    .sort(
      (left, right) =>
        right.visitCount - left.visitCount || right.totalAmount - left.totalAmount,
    )
    .slice(0, 3)

  return {
    totalPlaces: places.length,
    visitedPlaces,
    wishlistPlaces: places.length - visitedPlaces,
    totalVisits: visits.length,
    totalSpending,
    monthLabel: `${now.getMonth() + 1} 月`,
    monthVisits,
    monthSpending,
    categoryBreakdown,
    topPlaces,
  }
}
