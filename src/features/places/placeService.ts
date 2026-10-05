import {
  calculateAveragePrice,
  calculateOverallScore,
  defaultScoreWeights,
  isValidScore,
  normalizeAveragePrice,
} from '../../entities/place/rating'
import type { FoodPhoto, Place, PlaceScores, PlaceStatus, ScoreWeights, Visit } from '../../entities/place/types'
import { createId, nowIso } from '../../shared/id'
import { db } from '../../shared/db/database'
import { placeRepository } from '../../shared/db/placeRepository'


export type PlaceDraft = {
  name: string
  status: PlaceStatus
  categoryId: string
  tagIds: string[]
  address: string
  lng: number
  lat: number
  averagePrice?: number
  scores?: PlaceScores
  notes: string
  photoUrls?: string[]
}

export type VisitDraft = {
  placeId: string
  date: string
  items: string
  amount: number
  notes: string
  photos: File[]
}

export async function savePlaceDraft(draft: PlaceDraft): Promise<Place> {
  const timestamp = nowIso()
  await validatePlaceDraft(draft)
  const place = buildPlaceFromDraft(draft, timestamp, timestamp, await getScoreWeights())

  await db.transaction('rw', [db.places, db.tags], async () => {
    await placeRepository.savePlace(place)
    await refreshTagUsage(place.tagIds)
  })
  return place
}

export async function updatePlaceDraft(placeId: string, draft: PlaceDraft): Promise<Place> {
  const existingPlace = await db.places.get(placeId)

  if (!existingPlace) {
    throw new Error('店铺不存在')
  }

  await validatePlaceDraft(draft)
  const place = buildPlaceFromDraft(
    draft,
    existingPlace.createdAt,
    nowIso(),
    await getScoreWeights(),
    existingPlace.id,
  )

  await db.transaction('rw', [db.places, db.tags], async () => {
    await placeRepository.savePlace(place)
    await refreshTagUsage([...existingPlace.tagIds, ...place.tagIds])
  })
  return place
}

async function getScoreWeights(): Promise<ScoreWeights> {
  const settings = await db.settings.get('app')
  return settings?.scoreWeights ?? defaultScoreWeights
}

function buildPlaceFromDraft(
  draft: PlaceDraft,
  createdAt: string,
  updatedAt: string,
  weights: ScoreWeights,
  id = createId('place'),
): Place {
  const overallScore = draft.scores
    ? calculateOverallScore(draft.scores, weights)
    : undefined
  const averagePrice = normalizeAveragePrice(draft.averagePrice)

  const place: Place = {
    id,
    name: draft.name.trim(),
    status: draft.status,
    categoryId: draft.categoryId,
    tagIds: uniqueIds(draft.tagIds),
    address: draft.address.trim(),
    location: { lng: draft.lng, lat: draft.lat },
    averagePrice,
    averagePriceManual: averagePrice !== undefined,
    scores: draft.scores,
    overallScore,
    notes: draft.notes.trim(),
    photoUrls: normalizePhotoUrls(draft.photoUrls),
    createdAt,
    updatedAt,
  }

  return place
}

const MAX_PLACE_PHOTO_URLS = 6

export function normalizePhotoUrls(urls: string[] | undefined): string[] | undefined {
  if (!urls) {
    return undefined
  }

  const cleaned = [...new Set(urls.map((url) => url.trim()).filter((url) => /^https?:\/\//.test(url)))]
  return cleaned.length > 0 ? cleaned.slice(0, MAX_PLACE_PHOTO_URLS) : undefined
}


async function validatePlaceDraft(draft: PlaceDraft): Promise<void> {
  if (draft.name.trim().length === 0) {
    throw new Error('店铺名称不能为空')
  }

  if (!Number.isFinite(draft.lng) || !Number.isFinite(draft.lat) || draft.lng < -180 || draft.lng > 180 || draft.lat < -90 || draft.lat > 90) {
    throw new Error('坐标不合法')
  }

  if (
    draft.averagePrice !== undefined &&
    (!Number.isFinite(draft.averagePrice) || draft.averagePrice < 0)
  ) {
    throw new Error('人均价格不能为负数')
  }

  if (draft.scores && !Object.values(draft.scores).every(isValidScore)) {
    throw new Error('评分必须在 1-10 之间')
  }

  const category = await db.categories.get(draft.categoryId)
  if (!category) {
    throw new Error('分类不存在')
  }

  const tagIds = uniqueIds(draft.tagIds)
  if (tagIds.length > 0) {
    const existingTags = await db.tags.bulkGet(tagIds)
    const missingTagIds = tagIds.filter((_, index) => !existingTags[index])

    if (missingTagIds.length > 0) {
      throw new Error(`标签不存在：${missingTagIds.join(', ')}`)
    }
  }
}

async function validateVisitDraft(draft: VisitDraft): Promise<void> {
  if ((await db.places.get(draft.placeId)) === undefined) {
    throw new Error('店铺不存在')
  }

  assertValidVisitFields(draft.date, draft.amount)
}

function assertValidVisitFields(date: string, amount: number): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    throw new Error('消费日期格式必须为 YYYY-MM-DD')
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('消费金额不能为负数')
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

export async function addVisitDraft(draft: VisitDraft): Promise<Visit> {
  await validateVisitDraft(draft)
  const timestamp = nowIso()
  const visitId = createId('visit')
  const photos: FoodPhoto[] = []

  for (const file of draft.photos) {
    try {
      photos.push(await createCompressedPhoto(file, draft.placeId, visitId))
    } catch (error) {
      throw new Error('照片处理失败，请换一张图片重试。', { cause: error })
    }
  }

  const visit: Visit = {
    id: visitId,
    placeId: draft.placeId,
    date: draft.date,
    items: draft.items.trim(),
    amount: draft.amount,
    notes: draft.notes.trim(),
    photoIds: photos.map((photo) => photo.id),
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await db.transaction('rw', db.visits, db.photos, db.places, async () => {
    if (photos.length > 0) {
      await db.photos.bulkAdd(photos)
    }

    await db.visits.add(visit)
    await recalcPlaceAveragePrice(draft.placeId, timestamp)
  })

  return visit
}

export type VisitUpdateDraft = {
  date: string
  items: string
  amount: number
  notes: string
}

export async function updateVisit(visitId: string, draft: VisitUpdateDraft): Promise<Visit> {
  const existingVisit = await db.visits.get(visitId)

  if (!existingVisit) {
    throw new Error('消费记录不存在')
  }

  assertValidVisitFields(draft.date, draft.amount)

  const timestamp = nowIso()
  const updatedVisit: Visit = {
    ...existingVisit,
    date: draft.date,
    items: draft.items.trim(),
    amount: draft.amount,
    notes: draft.notes.trim(),
    updatedAt: timestamp,
  }

  await db.transaction('rw', db.visits, db.places, async () => {
    await db.visits.put(updatedVisit)
    await recalcPlaceAveragePrice(existingVisit.placeId, timestamp)
  })

  return updatedVisit
}

export async function deleteVisit(visitId: string): Promise<void> {
  const existingVisit = await db.visits.get(visitId)

  if (!existingVisit) {
    return
  }

  const timestamp = nowIso()
  await db.transaction('rw', db.visits, db.photos, db.places, async () => {
    await db.photos.where('visitId').equals(visitId).delete()
    await db.visits.delete(visitId)
    await recalcPlaceAveragePrice(existingVisit.placeId, timestamp)
  })
}

export async function deletePhoto(photoId: string): Promise<void> {
  await db.transaction('rw', db.photos, db.visits, async () => {
    const photo = await db.photos.get(photoId)
    if (!photo) {
      return
    }

    if (photo.visitId) {
      const visit = await db.visits.get(photo.visitId)
      if (visit) {
        await db.visits.update(visit.id, {
          photoIds: visit.photoIds.filter((id) => id !== photoId),
          updatedAt: nowIso(),
        })
      }
    }

    await db.photos.delete(photoId)
  })
}

async function recalcPlaceAveragePrice(placeId: string, timestamp: string): Promise<void> {
  const place = await db.places.get(placeId)
  if (!place) {
    return
  }

  // A hand-entered price wins over the computed one; visits only keep the
  // place's updatedAt fresh in that case.
  if (place.averagePriceManual) {
    await db.places.update(placeId, { updatedAt: timestamp })
    return
  }

  const visits = await db.visits.where('placeId').equals(placeId).toArray()
  const averagePrice = calculateAveragePrice(visits.map((item) => item.amount))
  await db.places.update(placeId, { averagePrice, updatedAt: timestamp })
}

export async function markPlaceVisited(placeId: string, scores: PlaceScores): Promise<Place> {
  const existingPlace = await db.places.get(placeId)

  if (!existingPlace) {
    throw new Error('店铺不存在')
  }

  if (!Object.values(scores).every(isValidScore)) {
    throw new Error('评分必须在 1-10 之间')
  }

  const weights = await getScoreWeights()
  const updatedPlace: Place = {
    ...existingPlace,
    status: 'visited',
    scores,
    overallScore: calculateOverallScore(scores, weights),
    updatedAt: nowIso(),
  }

  await db.places.put(updatedPlace)
  return updatedPlace
}

export async function deletePlace(placeId: string): Promise<void> {
  await db.transaction('rw', [db.places, db.visits, db.photos, db.tags], async () => {
    const existingPlace = await db.places.get(placeId)
    await placeRepository.deletePlaceCascade(placeId)
    await refreshTagUsage(existingPlace?.tagIds ?? [])
  })
}


export async function refreshAllTagUsage(): Promise<void> {
  const tags = await db.tags.toArray()
  await refreshTagUsage(tags.map((tag) => tag.id))
}

async function refreshTagUsage(tagIds: string[]): Promise<void> {
  const uniqueTagIds = [...new Set(tagIds)]

  if (uniqueTagIds.length === 0) {
    return
  }

  // Read and write inside one transaction so concurrent writes cannot leave
  // usageCount half-updated.
  await db.transaction('rw', [db.places, db.tags], async () => {
    const usageCounts = new Map(uniqueTagIds.map((tagId) => [tagId, 0]))
    const places = await db.places.where('tagIds').anyOf(uniqueTagIds).distinct().toArray()

    for (const place of places) {
      for (const tagId of place.tagIds) {
        if (usageCounts.has(tagId)) {
          usageCounts.set(tagId, (usageCounts.get(tagId) ?? 0) + 1)
        }
      }
    }

    for (const [tagId, usageCount] of usageCounts) {
      await db.tags.update(tagId, { usageCount })
    }
  })
}

async function createCompressedPhoto(
  file: File,
  placeId: string,
  visitId: string | undefined,
): Promise<FoodPhoto> {
  const image = await loadImage(file)
  const maxEdge = 1600
  const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const width = Math.round(image.width * ratio)
  const height = Math.round(image.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('图片处理不可用')
  }

  context.drawImage(image, 0, 0, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('图片压缩失败'))
      return
    }

        resolve(result)
      },
      'image/jpeg',
      0.82,
    )
  })

  return {
    id: createId('photo'),
    placeId,
    visitId,
    blob,
    mimeType: blob.type,
    width,
    height,
    size: blob.size,
    purpose: 'visit',
    createdAt: nowIso(),
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片无法加载'))
    }
    image.src = url
  })
}
