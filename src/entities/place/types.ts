export type PlaceStatus = 'visited' | 'wishlist'

export type PlaceId = string
export type VisitId = string
export type PhotoId = string
export type CategoryId = string
export type TagId = string

export type PlaceScores = {
  taste: number
  environment: number
  service: number
  value: number
}

export type ScoreWeights = {
  taste: number
  environment: number
  service: number
  value: number
}

export type LocationPoint = {
  lng: number
  lat: number
}

export type Place = {
  id: PlaceId
  name: string
  status: PlaceStatus
  categoryId: CategoryId
  tagIds: TagId[]
  address: string
  location: LocationPoint
  averagePrice?: number
  /** true when the user typed the price by hand; auto-recalc from visits must not overwrite it. */
  averagePriceManual?: boolean
  scores?: PlaceScores
  overallScore?: number
  notes: string
  /** External photo URLs from AMap POI data; local photos live in FoodPhoto. */
  photoUrls?: string[]
  createdAt: string
  updatedAt: string
}

export type Visit = {
  id: VisitId
  placeId: PlaceId
  date: string
  items: string
  amount: number
  notes: string
  photoIds: PhotoId[]
  createdAt: string
  updatedAt: string
}

export type FoodPhoto = {
  id: PhotoId
  placeId: PlaceId
  visitId?: VisitId
  blob: Blob
  mimeType: string
  width: number
  height: number
  size: number
  purpose: 'place' | 'visit'
  createdAt: string
}

export type Category = {
  id: CategoryId
  name: string
  color: string
  icon: string
  order: number
  hidden: boolean
}

export type Tag = {
  id: TagId
  name: string
  color: string
  usageCount: number
}

export type AppSettings = {
  id: 'app'
  backupVersion: number
  scoreWeights: ScoreWeights
}

export type PlaceFilters = {
  status: 'all' | PlaceStatus
  categoryId?: CategoryId
  tagIds: TagId[]
  scoreRange: [number, number]
  priceRange: [number, number]
}

export type PlaceSortKey = 'updated-desc' | 'score-desc' | 'price-asc' | 'price-desc'
