import { useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'
import type { Place } from '../../../entities/place/types'
import { useTheme } from '../../../shared/theme'
import { createAmapAdapter } from '../amapAdapter'
import { getAmapConfig } from '../amapConfig'
import {
  shanghaiCenter,
  type MapAdapter,
  type MapContextMenuPayload,
  type PlaceMarker,
  type PoiCandidate,
} from '../mapAdapter'

export function MapCanvas({
  markersVisible,
  onMapContextMenu,
  onPoiSelect,
  onSelectPlace,
  places,
  searchPreview,
  searchResults,
  selectedPlaceId,
}: {
  markersVisible: boolean
  onMapContextMenu: (payload: MapContextMenuPayload) => void
  onPoiSelect: (candidate: PoiCandidate) => void
  onSelectPlace: (placeId: string | undefined) => void
  places: Place[]
  searchPreview?: PoiCandidate
  searchResults: PoiCandidate[]
  selectedPlaceId?: string
}) {
  const amapConfig = useMemo(() => getAmapConfig(), [])
  const amapContainerRef = useRef<HTMLDivElement>(null)
  const amapAdapterRef = useRef<MapAdapter | undefined>(undefined)
  const theme = useTheme()
  const themeRef = useRef(theme)
  const [mapProvider, setMapProvider] = useState<'local' | 'loading' | 'amap' | 'error'>(
    amapConfig.enabled ? 'loading' : 'local',
  )
  const [mountNonce, setMountNonce] = useState(0)
  const [isLocating, setIsLocating] = useState(false)
  const [locateFailed, setLocateFailed] = useState(false)
  const locateMessageTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      window.clearTimeout(locateMessageTimerRef.current)
    }
  }, [])

  useEffect(() => {
    themeRef.current = theme
  }, [theme])
  const markers = useMemo<PlaceMarker[]>(
    () =>
      places.map((place) => ({
        id: place.id,
        label: place.name,
        location: place.location,
        score: place.overallScore,
        status: place.status,
      })),
    [places],
  )

  useEffect(() => {
    if (!amapConfig.enabled || !amapContainerRef.current) {
      return undefined
    }

    const adapter = createAmapAdapter(amapConfig)
    const container = amapContainerRef.current
    let disposed = false
    amapAdapterRef.current = adapter

    adapter
      .mount(container, {
        center: shanghaiCenter,
        theme: themeRef.current,
        onContextMenu: onMapContextMenu,
        onPoiSelect,
        zoom: 12,
        onSelectPlace,
      })
      .then(() => {
        if (!disposed) {
          setMapProvider('amap')
        }
      })
      .catch(() => {
        if (!disposed) {
          setMapProvider('error')
        }
      })

    return () => {
      disposed = true
      adapter.destroy()
      if (amapAdapterRef.current === adapter) {
        amapAdapterRef.current = undefined
      }
    }
  }, [amapConfig, mountNonce, onMapContextMenu, onPoiSelect, onSelectPlace])

  useEffect(() => {
    if (mapProvider !== 'amap') {
      return
    }

    amapAdapterRef.current?.setMapTheme(theme)
  }, [mapProvider, theme])

  useEffect(() => {
    if (mapProvider !== 'amap') {
      return
    }

    amapAdapterRef.current?.setMarkers(markers)
  }, [mapProvider, markers])

  useEffect(() => {
    if (mapProvider !== 'amap') {
      return
    }

    // Selecting a place (list, marker, search) also moves the camera to it;
    // deselecting only clears the highlight.
    if (selectedPlaceId) {
      amapAdapterRef.current?.focusPlace(selectedPlaceId)
    } else {
      amapAdapterRef.current?.setSelectedMarker(undefined)
    }
  }, [mapProvider, selectedPlaceId])

  useEffect(() => {
    if (mapProvider !== 'amap') {
      return
    }

    amapAdapterRef.current?.setSearchPreview(searchPreview)
  }, [mapProvider, searchPreview])

  useEffect(() => {
    if (mapProvider !== 'amap') {
      return
    }

    amapAdapterRef.current?.setMarkersVisible(markersVisible)
  }, [mapProvider, markersVisible])

  useEffect(() => {
    if (mapProvider !== 'amap') {
      return
    }

    amapAdapterRef.current?.setSearchResultMarkers(searchResults)
  }, [mapProvider, searchResults])

  const isAmapActive = mapProvider === 'amap'
  const showLocalMap = !amapConfig.enabled && mapProvider === 'local'
  const selectedMarker = markers.find((marker) => marker.id === selectedPlaceId)
  const contextMenuLocation = searchPreview?.location ?? selectedMarker?.location ?? shanghaiCenter

  // The adapter binds its own document-level contextmenu handlers once AMap is
  // up; this fallback only serves the no-key local mode.
  useEffect(() => {
    const handleDocumentContextMenu = (event: MouseEvent) => {
      if (isAmapActive) return

      const target = event.target

      if (!amapContainerRef.current) {
        return
      }

      const targetElement = target instanceof Element ? target : undefined
      const isOverlayTarget = Boolean(
        targetElement?.closest(
          '.map-search-console, .details-panel, .filter-drawer, .place-status-bar, .place-overlay-list, .command-settings, .command-brand, .floating-filter-button, .map-context-menu, .dialog-content',
        ),
      )
      const rect = amapContainerRef.current.getBoundingClientRect()
      const isInsideMap =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom

      if (!isInsideMap || isOverlayTarget) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      onMapContextMenu({
        location: contextMenuLocation,
        pixel: {
          x: event.clientX,
          y: event.clientY,
        },
      })
    }

    document.addEventListener('contextmenu', handleDocumentContextMenu, true)

    return () => {
      document.removeEventListener('contextmenu', handleDocumentContextMenu, true)
    }
  }, [contextMenuLocation, onMapContextMenu, isAmapActive])

  function retryMount(): void {
    setMapProvider('loading')
    setMountNonce((nonce) => nonce + 1)
  }

  async function handleLocate(): Promise<void> {
    const adapter = amapAdapterRef.current
    if (!adapter || mapProvider !== 'amap' || isLocating) {
      return
    }

    setIsLocating(true)
    setLocateFailed(false)
    try {
      const location = await adapter.locate()
      adapter.focusLocation(location, 15)
    } catch {
      adapter.focusLocation(shanghaiCenter, 12)
      setLocateFailed(true)
      window.clearTimeout(locateMessageTimerRef.current)
      locateMessageTimerRef.current = window.setTimeout(() => setLocateFailed(false), 3000)
    } finally {
      setIsLocating(false)
    }
  }

  return (
    <div className={isAmapActive ? 'map-canvas amap-enabled' : 'map-canvas'}>
      {amapConfig.enabled ? <div className="amap-map-layer" ref={amapContainerRef} /> : null}
      {showLocalMap ? (
        <div className="map-config-empty">
          <MapPin aria-hidden="true" size={20} />
          <strong>请配置高德地图 Key</strong>
          <span>配置后这里会显示真实高德地图。</span>
        </div>
      ) : null}
      {mapProvider === 'loading' ? <div className="map-loading">正在加载高德地图…</div> : null}
      {isAmapActive ? (
        <>
          <button
            aria-label="定位到我的位置"
            aria-busy={isLocating}
            className="icon-button map-locate-button"
            disabled={isLocating}
            type="button"
            onClick={() => void handleLocate()}
          >
            <LocateFixed aria-hidden="true" size={18} />
          </button>
          {locateFailed ? (
            <div className="map-locate-status" role="status">
              定位失败，已回到上海
            </div>
          ) : null}
        </>
      ) : null}
      {mapProvider === 'error' ? (
        <div className="map-error" role="alert">
          <MapPin aria-hidden="true" size={20} />
          <strong>高德地图加载失败</strong>
          <span>筛选、列表和手动新增店铺仍可使用。</span>
          <button className="text-button" type="button" onClick={retryMount}>
            重试加载地图
          </button>
        </div>
      ) : null}
    </div>
  )
}
