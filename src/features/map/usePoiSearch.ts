import { useCallback, useMemo, useRef, useState } from 'react'
import { createRequestTracker } from '../../shared/requestTracker'
import { createAmapAdapter } from './amapAdapter'
import { getAmapConfig } from './amapConfig'
import type { PoiCandidate } from './mapAdapter'

export type PoiSearchStatus = 'idle' | 'searching' | 'ready' | 'empty' | 'error'

// Shared POI search state machine for the map search console and the place
// editor dialog: query + candidates + status + stale-request guarding.
// `search` resolves with the candidates so callers can auto-pick the first
// hit; it resolves undefined for stale or rejected requests.
export function usePoiSearch() {
  const amapConfig = useMemo(() => getAmapConfig(), [])
  const adapter = useMemo(() => createAmapAdapter(amapConfig), [amapConfig])
  const requestTrackerRef = useRef(createRequestTracker())
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<PoiCandidate[]>([])
  const [status, setStatus] = useState<PoiSearchStatus>('idle')

  const search = useCallback(async (): Promise<PoiCandidate[] | undefined> => {
    const keyword = query.trim()
    if (!amapConfig.enabled || keyword.length === 0) {
      return undefined
    }

    const requestId = requestTrackerRef.current.begin()
    setStatus('searching')
    setCandidates([])

    try {
      const results = await adapter.searchPoi(keyword)
      if (!requestTrackerRef.current.isCurrent(requestId)) {
        return undefined
      }

      setCandidates(results)
      setStatus(results.length > 0 ? 'ready' : 'empty')
      return results
    } catch {
      if (requestTrackerRef.current.isCurrent(requestId)) {
        setStatus('error')
      }
      return undefined
    }
  }, [adapter, amapConfig.enabled, query])

  // One path for "the query changed or a candidate was applied": drop any
  // in-flight request and clear the result list.
  const changeQuery = useCallback((nextQuery: string) => {
    requestTrackerRef.current.invalidate()
    setQuery(nextQuery)
    setCandidates([])
    setStatus('idle')
  }, [])

  const reset = useCallback(() => {
    changeQuery('')
  }, [changeQuery])

  return {
    amapEnabled: amapConfig.enabled,
    candidates,
    changeQuery,
    query,
    reset,
    search,
    status,
  }
}
