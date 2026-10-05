import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppSettings, Category, Place, Tag, Visit } from '../../entities/place/types'
import { getErrorMessage } from '../errors'
import { db } from './database'
import { defaultSettings, ensureSeedData } from './seed'

export type FoodMapData = {
  places: Place[]
  visits: Visit[]
  categories: Category[]
  tags: Tag[]
  settings: AppSettings
  loading: boolean
  loadError?: string
}

export function useFoodMapData(): FoodMapData {
  const [loadError, setLoadError] = useState<string | undefined>(undefined)

  useEffect(() => {
    void ensureSeedData(db).catch((error: unknown) => {
      setLoadError(getErrorMessage(error))
    })
  }, [])

  // A rejected liveQuery leaves the value undefined forever, which used to pin
  // the UI on the loading banner. Catch per query and surface a real error.
  const report = <T,>(fallback: T[]) =>
    (error: unknown): T[] => {
      console.error(error)
      queueMicrotask(() => setLoadError(getErrorMessage(error)))
      return fallback
    }

  const places = useLiveQuery(
    () => db.places.orderBy('updatedAt').reverse().toArray().catch(report<Place>([])),
    [],
  )
  const visits = useLiveQuery(
    () => db.visits.orderBy('date').reverse().toArray().catch(report<Visit>([])),
    [],
  )
  const categories = useLiveQuery(
    () => db.categories.orderBy('order').toArray().catch(report<Category>([])),
    [],
  )
  const tags = useLiveQuery(() => db.tags.orderBy('name').toArray().catch(report<Tag>([])), [])
  const settings = useLiveQuery(() => db.settings.get('app'), [])

  return {
    places: places ?? [],
    visits: visits ?? [],
    categories: categories ?? [],
    tags: tags ?? [],
    settings: settings ?? defaultSettings,
    loading: !places || !visits || !categories || !tags,
    loadError,
  }
}

