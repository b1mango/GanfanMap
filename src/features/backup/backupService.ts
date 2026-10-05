import { z } from 'zod'
import { normalizeAveragePrice } from '../../entities/place/rating'
import type { FoodPhoto } from '../../entities/place/types'
import { db } from '../../shared/db/database'
import { refreshAllTagUsage, normalizePhotoUrls } from '../places/placeService'
import { parseBackupPayload, type BackupPayload } from './backupSchema'

export async function exportBackup(): Promise<BackupPayload> {
  const [places, visits, dbPhotos, categories, tags, settings] = await Promise.all([
    db.places.toArray(),
    db.visits.toArray(),
    db.photos.toArray(),
    db.categories.toArray(),
    db.tags.toArray(),
    db.settings.get('app'),
  ])

  if (!settings) {
    throw new Error('应用设置缺失')
  }

  // Convert photos one at a time: parallel base64 conversion doubles the peak
  // memory of the whole photo library.
  const photos: BackupPayload['photos'] = []
  for (const photo of dbPhotos) {
    const { blob, ...rest } = photo
    photos.push({ ...rest, dataUrl: await blobToDataUrl(blob) })
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    places,
    visits,
    photos,
    categories,
    tags,
    settings,
  }
}

export type ImportSummary = {
  skippedPhotos: number
}

export async function importBackup(input: unknown): Promise<ImportSummary> {
  const payload = parseBackupWithFriendlyError(input)
  validateBackupReferences(payload)
  const places = payload.places.map((place) => ({
    ...place,
    averagePrice: normalizeAveragePrice(place.averagePrice),
    photoUrls: normalizePhotoUrls(place.photoUrls),
  }))

  // Photos without image data are skipped instead of being stored as
  // zero-byte shells with lying metadata.
  let skippedPhotos = 0
  const photos: FoodPhoto[] = []
  for (const photo of payload.photos) {
    if (!photo.dataUrl) {
      skippedPhotos += 1
      continue
    }

    const blob = dataUrlToBlob(photo.dataUrl)
    photos.push({
      id: photo.id,
      placeId: photo.placeId,
      visitId: photo.visitId,
      blob,
      mimeType: photo.mimeType,
      width: photo.width,
      height: photo.height,
      size: blob.size,
      purpose: photo.purpose,
      createdAt: photo.createdAt,
    })
  }

  await db.transaction(
    'rw',
    [db.places, db.visits, db.photos, db.categories, db.tags, db.settings],
    async () => {
      await Promise.all([
        db.places.clear(),
        db.visits.clear(),
        db.photos.clear(),
        db.categories.clear(),
        db.tags.clear(),
        db.settings.clear(),
      ])
      await db.categories.bulkPut(payload.categories)
      await db.tags.bulkPut(payload.tags)
      await db.places.bulkPut(places)
      await db.visits.bulkPut(payload.visits)
      await db.photos.bulkPut(photos)
      await db.settings.put(payload.settings)
      await refreshAllTagUsage()
    },
  )

  return { skippedPhotos }
}

export function downloadBackup(payload: BackupPayload): void {
  const blob = new Blob([JSON.stringify(payload)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `fan-map-backup-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

// arrayBuffer + manual base64 instead of FileReader: FileReader only accepts
// the runtime's own Blob class, which excludes blobs cloned back by IndexedDB
// in non-browser runtimes.
async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  const mimeType = blob.type || 'application/octet-stream'
  return `data:${mimeType};base64,${btoa(binary)}`
}

// Decode data URLs by hand instead of fetch(): fetch goes through the network
// stack and, in non-browser runtimes, returns a Blob class FileReader rejects.
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',')
  const header = dataUrl.slice(0, commaIndex)
  const data = dataUrl.slice(commaIndex + 1)
  const mimeType = /^data:([^;,]*)/.exec(header)?.[1] || 'application/octet-stream'

  if (header.includes(';base64')) {
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return new Blob([bytes], { type: mimeType })
  }

  return new Blob([decodeURIComponent(data)], { type: mimeType })
}

function parseBackupWithFriendlyError(input: unknown): BackupPayload {
  try {
    return parseBackupPayload(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issuePath = error.issues[0]?.path.join('.') ?? ''
      throw new Error(
        issuePath ? `备份文件字段不合法：${issuePath}` : '备份文件格式不完整或字段不合法',
        { cause: error },
      )
    }

    throw error
  }
}


function validateBackupReferences(payload: BackupPayload): void {
  const categoryIds = new Set(payload.categories.map((category) => category.id))
  const tagIds = new Set(payload.tags.map((tag) => tag.id))
  const placeIds = new Set(payload.places.map((place) => place.id))
  const visitIds = new Set(payload.visits.map((visit) => visit.id))
  const visitsById = new Map(payload.visits.map((visit) => [visit.id, visit]))

  for (const place of payload.places) {
    if (!categoryIds.has(place.categoryId)) {
      throw new Error(`备份包含不存在的分类：${place.categoryId}`)
    }

    const missingTagId = place.tagIds.find((tagId) => !tagIds.has(tagId))
    if (missingTagId) {
      throw new Error(`备份包含不存在的标签：${missingTagId}`)
    }
  }

  for (const visit of payload.visits) {
    if (!placeIds.has(visit.placeId)) {
      throw new Error(`备份包含不存在店铺的消费记录：${visit.placeId}`)
    }
  }

  for (const photo of payload.photos) {
    if (!placeIds.has(photo.placeId)) {
      throw new Error(`备份包含不存在店铺的照片：${photo.placeId}`)
    }

    if (photo.visitId && !visitIds.has(photo.visitId)) {
      throw new Error(`备份包含不存在消费记录的照片：${photo.visitId}`)
    }

    const visit = photo.visitId ? visitsById.get(photo.visitId) : undefined
    if (visit && visit.placeId !== photo.placeId) {
      throw new Error(`备份照片与消费记录不属于同一店铺：${photo.id}`)
    }
  }
}
