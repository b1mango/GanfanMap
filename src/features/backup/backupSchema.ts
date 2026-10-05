import { z } from 'zod'
import { defaultScoreWeights } from '../../entities/place/rating'

const placeScoresSchema = z.object({
  taste: z.number().int().min(1).max(10),
  environment: z.number().int().min(1).max(10),
  service: z.number().int().min(1).max(10),
  value: z.number().int().min(1).max(10),
})

const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.union([z.literal('visited'), z.literal('wishlist')]),
  categoryId: z.string().min(1),
  tagIds: z.array(z.string()),
  address: z.string(),
  location: z.object({
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
  }),
  averagePrice: z.number().nonnegative().optional(),
  averagePriceManual: z.boolean().optional(),
  scores: placeScoresSchema.optional(),
  overallScore: z.number().min(1).max(10).optional(),
  notes: z.string(),
  photoUrls: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const visitSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.string(),
  amount: z.number().nonnegative(),
  notes: z.string(),
  photoIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const photoSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  visitId: z.string().optional(),
  dataUrl: z.string().startsWith('data:').optional(),
  mimeType: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  purpose: z.union([z.literal('place'), z.literal('visit')]),
  createdAt: z.string().datetime(),
})

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
  order: z.number().int(),
  hidden: z.boolean(),
})

const tagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  usageCount: z.number().int().nonnegative(),
})

// Accept legacy settings fields from older backups; scoreWeights are kept,
// everything else is dropped in favor of current defaults.
const settingsSchema = z
  .object({
    id: z.literal('app'),
    backupVersion: z.number().int().positive(),
    scoreWeights: z
      .object({
        taste: z.number().int().min(0).max(100),
        environment: z.number().int().min(0).max(100),
        service: z.number().int().min(0).max(100),
        value: z.number().int().min(0).max(100),
      })
      .optional(),
    fallbackCity: z.string().optional(),
    reducedMotion: z.boolean().optional(),
  })
  .transform((settings) => ({
    id: 'app' as const,
    backupVersion: settings.backupVersion,
    scoreWeights: settings.scoreWeights ?? defaultScoreWeights,
  }))

export const backupPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  places: z.array(placeSchema),
  visits: z.array(visitSchema),
  photos: z.array(photoSchema),
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  settings: settingsSchema,
})

export type BackupPayload = z.infer<typeof backupPayloadSchema>

export function parseBackupPayload(input: unknown): BackupPayload {
  return backupPayloadSchema.parse(input)
}
