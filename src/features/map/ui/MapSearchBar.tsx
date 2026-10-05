import { Search, X } from 'lucide-react'
import type { PoiCandidate } from '../mapAdapter'
import type { PoiSearchStatus } from '../usePoiSearch'

export function MapSearchBar({
  activeCandidate,
  action,
  amapEnabled,
  candidates,
  onApplyCandidate,
  onClear,
  onQueryChange,
  onSearch,
  query,
  status,
}: {
  activeCandidate?: PoiCandidate
  action?: React.ReactNode
  amapEnabled: boolean
  candidates: PoiCandidate[]
  onApplyCandidate: (candidate: PoiCandidate) => void
  onClear: () => void
  onQueryChange: (query: string) => void
  onSearch: () => void
  query: string
  status: PoiSearchStatus
}) {
  const hasSearchState = query.trim().length > 0 || candidates.length > 0 || Boolean(activeCandidate)

  return (
    <section className="map-search-console" aria-label="地图搜索">
      <div className="map-search-row">
        <label className="map-search-box">
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">搜索地图地点</span>
          <input
            aria-label="搜索地图地点"
            autoComplete="off"
            placeholder="搜索地点、店名、商圈..."
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              // Ignore Enter/Escape while the IME is composing (e.g. pinyin input).
              if (event.nativeEvent.isComposing) return
              if (event.key === 'Enter') {
                event.preventDefault()
                onSearch()
              }
              if (event.key === 'Escape' && hasSearchState) {
                event.preventDefault()
                onClear()
              }
            }}
          />
          <button
            aria-label="清空地图搜索"
            className="map-search-clear"
            type="button"
            disabled={!hasSearchState}
            onClick={onClear}
          >
            <X aria-hidden="true" size={15} />
          </button>
          <button
            className="map-search-submit"
            type="button"
            disabled={!amapEnabled || !query.trim() || status === 'searching'}
            onClick={onSearch}
          >
            {status === 'searching' ? '搜索中' : '搜索'}
          </button>
        </label>
        {action ? <div className="search-primary-action">{action}</div> : null}
      </div>
      {status === 'empty' ? <p className="map-search-message">没有找到匹配地点</p> : null}
      {status === 'error' ? <p className="map-search-message">地图搜索暂时不可用</p> : null}
      {candidates.length > 0 ? (
        <div className="map-search-results">
          {candidates.map((candidate, index) => (
            <button
              className={activeCandidate === candidate ? 'active' : ''}
              key={`${candidate.name}-${candidate.location.lng}-${index}`}
              type="button"
              onClick={() => onApplyCandidate(candidate)}
            >
              <strong>{candidate.name}</strong>
              <span>{candidate.address || '未返回详细地址'}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
