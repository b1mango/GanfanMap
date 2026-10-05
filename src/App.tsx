import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Eye, EyeOff, Filter, MapPin, Moon, MousePointerClick, Search, Sun, SunDim, X } from 'lucide-react'
import { filterPlaces, hasActiveFilters, sortPlaces } from './entities/place/filter'
import { createDefaultScores } from './entities/place/rating'
import type { Place, PlaceStatus, Visit } from './entities/place/types'
import { useFoodMapData } from './shared/db/useFoodMapData'
import {
  type MapContextMenuPayload,
  type PoiCandidate,
} from './features/map/mapAdapter'
import { usePoiSearch } from './features/map/usePoiSearch'
import { MapCanvas } from './features/map/ui/MapCanvas'
import { MapContextMenu } from './features/map/ui/MapContextMenu'
import { MapPoiPanel, type PoiMarkDraft } from './features/map/ui/MapPoiPanel'
import { MapSearchBar } from './features/map/ui/MapSearchBar'
import { useUiStore } from './features/places/uiStore'
import { useShallow } from 'zustand/shallow'
import { savePlaceDraft } from './features/places/placeService'
import { DetailsPanel } from './features/places/ui/DetailsPanel'
import { FilterSidebar } from './features/places/ui/FilterSidebar'
import { AddPlaceDialog } from './features/places/ui/PlaceEditorDialog'
import { PlaceOverlayList, PlaceStatusBar } from './features/places/ui/PlaceOverlayList'
import { StatsDialog } from './features/stats/StatsDialog'
import { SettingsDialog } from './features/backup/SettingsDialog'
import { toggleTheme, useTheme, THEME_LABELS } from './shared/theme'
import { trapPanelFocus } from './shared/focusTrap'
import { getErrorMessage } from './shared/errors'
import { DEFAULT_CATEGORY_ID } from './shared/constants'

const emptyVisits: Visit[] = []

function App() {
  const { places, visits, categories, tags, loading, loadError } = useFoodMapData()
  const { filters, sortKey, selectedPlaceId } = useUiStore(useShallow((state) => ({
    filters: state.filters,
    sortKey: state.sortKey,
    selectedPlaceId: state.selectedPlaceId,
  })))
  const selectPlace = useUiStore((state) => state.selectPlace)
  const resetFilters = useUiStore((state) => state.resetFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const {
    amapEnabled,
    candidates: mapSearchResults,
    changeQuery: changeMapSearchQuery,
    query: mapSearchQuery,
    reset: resetMapSearch,
    search: searchPoi,
    status: mapSearchStatus,
  } = usePoiSearch()
  const [activeMapPoi, setActiveMapPoi] = useState<PoiCandidate | undefined>(undefined)
  const [mapSearchPreview, setMapSearchPreview] = useState<PoiCandidate | undefined>(undefined)
  const [mapContextMenu, setMapContextMenu] = useState<MapContextMenuPayload | undefined>(undefined)
  const [mapActionError, setMapActionError] = useState('')
  const [isSavingMapPoi, setIsSavingMapPoi] = useState(false)
  const [savingMapPointStatus, setSavingMapPointStatus] = useState<PlaceStatus | undefined>(undefined)
  const [overlayListOpen, setOverlayListOpen] = useState(false)
  const [markersVisible, setMarkersVisible] = useState(true)
  const filterDrawerRef = useRef<HTMLElement>(null)
  const placesById = useMemo(
    () => new Map(places.map((place) => [place.id, place] as const)),
    [places],
  )
  const visitsByPlaceId = useMemo(() => {
    const groupedVisits = new Map<string, Visit[]>()

    for (const visit of visits) {
      const placeVisits = groupedVisits.get(visit.placeId)
      if (placeVisits) {
        placeVisits.push(visit)
        continue
      }

      groupedVisits.set(visit.placeId, [visit])
    }

    return groupedVisits
  }, [visits])
  const filteredPlaces = useMemo(
    () => sortPlaces(filterPlaces(places, filters), sortKey),
    [filters, places, sortKey],
  )
  const selectedPlace = selectedPlaceId ? placesById.get(selectedPlaceId) : undefined
  const selectedVisits = selectedPlace ? visitsByPlaceId.get(selectedPlace.id) ?? emptyVisits : emptyVisits
  const filtersActive = hasActiveFilters(filters)
  const handleSelectPlace = useCallback(
    (placeId: string | undefined) => {
      // Selecting a place closes the POI panel so the two right-side floaters
      // never stack on top of each other.
      setActiveMapPoi(undefined)
      setMapSearchPreview(undefined)
      selectPlace(placeId)
      setDetailsOpen(Boolean(placeId))
    },
    [selectPlace],
  )
  const ensurePlaceVisible = useCallback(
    (place: Place) => {
      if (filterPlaces([place], filters).length === 0) {
        resetFilters()
      }
    },
    [filters, resetFilters],
  )
  const handlePlaceSaved = useCallback(
    (placeId: string, savedPlace: Place) => {
      ensurePlaceVisible(savedPlace)
      handleSelectPlace(placeId)
    },
    [ensurePlaceVisible, handleSelectPlace],
  )
  const handleMapContextMenu = useCallback((payload: MapContextMenuPayload) => {
    setMapActionError('')
    setMapContextMenu(payload)
  }, [])

  useEffect(() => {
    function handleGlobalEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.isComposing) return
      // Radix dialogs and the search input handle their own Escape and preventDefault it.
      if (event.defaultPrevented) return
      if (document.querySelector('.dialog-overlay')) return

      if (mapContextMenu) {
        setMapContextMenu(undefined)
      } else if (filterOpen) {
        setFilterOpen(false)
      } else if (activeMapPoi) {
        setActiveMapPoi(undefined)
        setMapSearchPreview(undefined)
      } else if (overlayListOpen) {
        setOverlayListOpen(false)
      } else if (detailsOpen) {
        setDetailsOpen(false)
        selectPlace(undefined)
      }
    }
    document.addEventListener('keydown', handleGlobalEscape)
    return () => document.removeEventListener('keydown', handleGlobalEscape)
  }, [mapContextMenu, filterOpen, activeMapPoi, overlayListOpen, detailsOpen, selectPlace])

  useEffect(() => {
    if (!filterOpen || !filterDrawerRef.current) {
      return
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    filterDrawerRef.current.querySelector<HTMLElement>('[aria-label="关闭筛选面板"]')?.focus()

    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [filterOpen])

  async function searchMapPoi(): Promise<void> {
    const results = await searchPoi()
    // Stale/empty requests resolve undefined; only auto-open the top hit.
    if (results && results.length > 0) {
      setActiveMapPoi(results[0])
      setMapSearchPreview(results[0])
    }
  }

  function applyMapSearchCandidate(candidate: PoiCandidate): void {
    changeMapSearchQuery(candidate.name)
    setActiveMapPoi(candidate)
    setMapSearchPreview(candidate)
  }

  function handleMapSearchQueryChange(query: string): void {
    changeMapSearchQuery(query)
    setActiveMapPoi(undefined)
    setMapSearchPreview(undefined)
    setMapActionError('')
  }

  function clearMapSearch(): void {
    resetMapSearch()
    setActiveMapPoi(undefined)
    setMapSearchPreview(undefined)
  }

  const handleMapPoiSelect = useCallback(
    (candidate: PoiCandidate): void => {
      changeMapSearchQuery(candidate.name)
      setActiveMapPoi(candidate)
      setMapSearchPreview(candidate)
      setDetailsOpen(false)
    },
    [changeMapSearchQuery],
  )

  async function savePoiAsPlace(candidate: PoiCandidate, draft: PoiMarkDraft): Promise<void> {
    if (isSavingMapPoi) {
      return
    }

    setMapActionError('')
    setIsSavingMapPoi(true)

    try {
      const place = await savePlaceDraft({
        name: candidate.name,
        status: draft.status,
        categoryId: draft.categoryId || categories[0]?.id || DEFAULT_CATEGORY_ID,
        tagIds: [],
        address: candidate.address || '高德地图搜索地点',
        lng: candidate.location.lng,
        lat: candidate.location.lat,
        averagePrice: draft.averagePrice,
        scores: draft.status === 'visited' ? createDefaultScores() : undefined,
        notes: draft.notes || '通过高德地图搜索添加。',
        photoUrls: candidate.photos,
      })

      ensurePlaceVisible(place)
      resetMapSearch()
      setActiveMapPoi(undefined)
      setMapSearchPreview(undefined)
      handleSelectPlace(place.id)
    } catch (error) {
      setMapActionError(getErrorMessage(error))
    } finally {
      setIsSavingMapPoi(false)
    }
  }

  async function saveMapPoint(status: PlaceStatus): Promise<void> {
    if (!mapContextMenu || savingMapPointStatus) {
      return
    }

    setMapActionError('')
    setSavingMapPointStatus(status)

    try {
      const place = await savePlaceDraft({
        name: `地图标记 ${new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date())}`,
        status,
        categoryId: categories[0]?.id || DEFAULT_CATEGORY_ID,
        tagIds: [],
        address: `${mapContextMenu.location.lng.toFixed(5)}, ${mapContextMenu.location.lat.toFixed(5)}`,
        lng: mapContextMenu.location.lng,
        lat: mapContextMenu.location.lat,
        scores: status === 'visited' ? createDefaultScores() : undefined,
        notes: '通过地图右键添加，可在详情中继续完善。',
      })

      ensurePlaceVisible(place)
      setMapContextMenu(undefined)
      handleSelectPlace(place.id)
    } catch (error) {
      setMapActionError(getErrorMessage(error))
    } finally {
      setSavingMapPointStatus(undefined)
    }
  }

  return (
    <Tooltip.Provider delayDuration={180}>
      <main className={detailsOpen ? 'command-shell details-open' : 'command-shell'}>
        {loading ? (
          <div className="app-loading-banner" role="status" aria-live="polite">
            正在读取本地档案…
          </div>
        ) : null}
        {loadError ? (
          <div className="app-error-banner" role="alert">
            <span>本地档案读取失败:{loadError}</span>
            <button className="text-button" type="button" onClick={() => window.location.reload()}>
              刷新重试
            </button>
          </div>
        ) : null}
        <MapCanvas
          places={filteredPlaces}
          searchPreview={mapSearchPreview}
          searchResults={mapSearchResults}
          markersVisible={markersVisible}
          selectedPlaceId={selectedPlace?.id}
          onMapContextMenu={handleMapContextMenu}
          onPoiSelect={handleMapPoiSelect}
          onSelectPlace={handleSelectPlace}
        />

        <header className="command-brand">
          <span className="brand-mark">
            <img src="/brand-icon.svg" alt="" aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">Private Food Atlas</p>
            <h1>干饭地图指北</h1>
          </div>
        </header>

        <MapSearchBar
          candidates={mapSearchResults}
          activeCandidate={activeMapPoi}
          query={mapSearchQuery}
          status={mapSearchStatus}
          amapEnabled={amapEnabled}
          action={
            <AddPlaceDialog
              categories={categories}
              tags={tags}
              onPlaceSaved={handlePlaceSaved}
            />
          }
          onApplyCandidate={applyMapSearchCandidate}
          onClear={clearMapSearch}
          onQueryChange={handleMapSearchQueryChange}
          onSearch={() => void searchMapPoi()}
        />

        {activeMapPoi ? (
          <MapPoiPanel
            candidate={activeMapPoi}
            categories={categories}
            key={activeMapPoi.sourceId ?? `${activeMapPoi.location.lng}-${activeMapPoi.location.lat}`}
            errorMessage={mapActionError}
            isSaving={isSavingMapPoi}
            onClose={() => {
              changeMapSearchQuery(mapSearchQuery)
              setMapActionError('')
              setActiveMapPoi(undefined)
              setMapSearchPreview(undefined)
            }}
            onMarkCandidate={(candidate, draft) => void savePoiAsPlace(candidate, draft)}
          />
        ) : null}

        <div className="command-settings">
          <ThemeToggle />
          <StatsDialog categories={categories} places={places} visits={visits} />
          <SettingsDialog
            onImported={() => {
              // Import replaces the whole database; session-scoped UI state
              // that references old ids must reset with it.
              selectPlace(undefined)
              setDetailsOpen(false)
              resetFilters()
            }}
          />
        </div>

        <button
          aria-label="打开筛选面板"
          className="floating-filter-button"
          type="button"
          onClick={() => setFilterOpen(true)}
        >
          <Filter aria-hidden="true" size={17} />
          <span className="filter-button-text">筛选</span>
          <span className="filter-count">{filteredPlaces.length}</span>
        </button>

        <button
          aria-label={markersVisible ? '隐藏地图标记' : '显示地图标记'}
          className="marker-toggle-button"
          type="button"
          onClick={() => setMarkersVisible((prev) => !prev)}
        >
          {markersVisible ? <Eye aria-hidden="true" size={17} /> : <EyeOff aria-hidden="true" size={17} />}
        </button>

        {filterOpen ? (
          <>
            <div
              className="drawer-scrim"
              aria-hidden="true"
              onClick={() => setFilterOpen(false)}
            />
            <aside
              className="filter-drawer"
              aria-label="筛选面板"
              ref={filterDrawerRef}
              onKeyDown={(event) => trapPanelFocus(event, filterDrawerRef.current)}
            >
              <button
                className="icon-button drawer-close"
                type="button"
                aria-label="关闭筛选面板"
                onClick={() => setFilterOpen(false)}
              >
                <X aria-hidden="true" size={18} />
              </button>
              <FilterSidebar
                categories={categories}
                filteredCount={filteredPlaces.length}
                placesCount={places.length}
                tags={tags}
              />
            </aside>
          </>
        ) : null}

        {mapContextMenu ? (
          <MapContextMenu
            errorMessage={mapActionError}
            payload={mapContextMenu}
            savingStatus={savingMapPointStatus}
            onClose={() => {
              setMapActionError('')
              setMapContextMenu(undefined)
            }}
            onSave={(status) => void saveMapPoint(status)}
          />
        ) : null}

        <PlaceStatusBar
          count={filteredPlaces.length}
          hasActiveFilters={filtersActive}
          isOpen={overlayListOpen}
          onToggle={() => setOverlayListOpen((prev) => !prev)}
        />

        {loading ? null : <OnboardingHint />}

        {overlayListOpen ? (
          <PlaceOverlayList
            categories={categories}
            tags={tags}
            places={filteredPlaces}
            selectedPlaceId={selectedPlace?.id}
            onPlaceSaved={handlePlaceSaved}
            onSelectPlace={(placeId) => {
              handleSelectPlace(placeId)
              setOverlayListOpen(false)
            }}
            onClose={() => setOverlayListOpen(false)}
          />
        ) : null}

        {detailsOpen && selectedPlace ? (
          <DetailsPanel
            categories={categories}
            key={selectedPlace.id}
            place={selectedPlace}
            tags={tags}
            visits={selectedVisits}
            onPlaceSaved={handlePlaceSaved}
            onClose={() => {
              setDetailsOpen(false)
              selectPlace(undefined)
            }}
          />
        ) : null}
      </main>
    </Tooltip.Provider>
  )
}

const ONBOARDING_STORAGE_KEY = 'fan-map-onboarded'

function OnboardingHint() {
  const [visible, setVisible] = useState(() => {
    try {
      return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1'
    } catch {
      return false
    }
  })

  if (!visible) {
    return null
  }

  function dismiss(): void {
    setVisible(false)
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    } catch {
      // localStorage unavailable; the hint simply shows again next launch
    }
  }

  return (
    <aside className="onboarding-hint" aria-label="使用提示">
      <ul>
        <li>
          <MousePointerClick aria-hidden="true" size={15} />
          右键地图任意位置，快速新增店铺
        </li>
        <li>
          <Search aria-hidden="true" size={15} />
          顶部搜索框可搜高德地点并直接标记
        </li>
        <li>
          <MapPin aria-hidden="true" size={15} />
          点击地图钉或底部档案列表查看详情
        </li>
      </ul>
      <button
        aria-label="关闭使用提示"
        className="icon-button onboarding-dismiss"
        type="button"
        onClick={dismiss}
      >
        <X aria-hidden="true" size={15} />
      </button>
    </aside>
  )
}

function ThemeToggle() {
  const theme = useTheme()
  const icons = {
    light: <Sun aria-hidden="true" size={18} />,
    plain: <SunDim aria-hidden="true" size={18} />,
    dark: <Moon aria-hidden="true" size={18} />,
  } as const

  return (
    <button
      aria-label={`切换主题（当前：${THEME_LABELS[theme]}）`}
      className="icon-button theme-toggle"
      type="button"
      onClick={() => toggleTheme()}
    >
      {icons[theme]}
    </button>
  )
}

export default App

