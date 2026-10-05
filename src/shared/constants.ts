import type { PlaceScores, PlaceStatus } from '../entities/place/types'

export const DEFAULT_CATEGORY_ID = 'tea'
export const DEFAULT_CITY = '上海'
export const DEFAULT_SCORE_RANGE: [number, number] = [1, 10]
export const DEFAULT_PRICE_RANGE: [number, number] = [0, 500]

export const STATUS_OPTIONS: [PlaceStatus, string][] = [
  ['visited', '已探店'],
  ['wishlist', '想去'],
]

export const FILTER_STATUS_OPTIONS: [string, string][] = [
  ['all', '全部'],
  ...STATUS_OPTIONS,
]

export const SCORE_DIMENSIONS: [keyof PlaceScores, string][] = [
  ['taste', '口味'],
  ['environment', '环境'],
  ['service', '服务'],
  ['value', '性价比'],
]
