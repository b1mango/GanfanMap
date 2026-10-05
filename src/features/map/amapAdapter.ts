import type { LocationPoint, PlaceId } from '../../entities/place/types'
import { DEFAULT_CITY } from '../../shared/constants'
import { prefersReducedMotion } from '../../shared/motion'
import type { AmapConfig } from './amapConfig'
import type {
  MapAdapter,
  MapMountOptions,
  PlaceMarker,
  PoiCandidate,
} from './mapAdapter'

const AMAP_LOADER_URL = 'https://webapi.amap.com/loader.js'
const AMAP_PLUGINS = ['AMap.Geocoder', 'AMap.Geolocation', 'AMap.PlaceSearch']

type AmapLoaderOptions = {
  key: string
  version: '2.0'
  plugins: string[]
}

type AmapLoaderGlobal = {
  load(options: AmapLoaderOptions): Promise<AmapNamespace>
}

export type AmapNamespace = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AmapMap
  Marker: new (options: Record<string, unknown>) => AmapMarker
  Pixel?: new (x: number, y: number) => unknown
  PlaceSearch: new (options: Record<string, unknown>) => AmapPlaceSearch
  Geocoder?: new (options: Record<string, unknown>) => AmapGeocoder
  Geolocation?: new (options: Record<string, unknown>) => AmapGeolocation
}

export type AmapGeolocation = {
  getCurrentPosition(callback: (status: string, result: unknown) => void): void
}

export type AmapMap = {
  destroy(): void
  setCenter(center: [number, number]): void
  setMapStyle?: (style: string) => void
  setZoomAndCenter?: (zoom: number, center: [number, number], immediately?: boolean) => void
  setFitView?: (overlays?: AmapMarker[], immediately?: boolean, avoid?: number[]) => void
  containerToLngLat?: (pixel: unknown) => unknown
  getCenter?: () => unknown
  on?: (eventName: 'click' | 'hotspotclick', callback: (event: unknown) => void) => void
  setStatus?: (status: Record<string, unknown>) => void
}

export type AmapMarker = {
  setMap(map: AmapMap | null): void
  setPosition?: (position: [number, number]) => void
  on?: (eventName: 'click', callback: () => void) => void
}

type AmapPlaceSearch = {
  search(keyword: string, callback: (status: string, result: unknown) => void): void
  getDetails?: (poiId: string, callback: (status: string, result: unknown) => void) => void
  searchNearBy?: (
    keyword: string,
    center: [number, number],
    radius: number,
    callback: (status: string, result: unknown) => void,
  ) => void
}

type AmapGeocoder = {
  getAddress(location: [number, number], callback: (status: string, result: unknown) => void): void
}

type AmapSecurityConfig = {
  securityJsCode: string
}

type AmapPoiLike = {
  id?: unknown
  name?: unknown
  address?: unknown
  location?: unknown
  type?: unknown
  tel?: unknown
  photos?: unknown
  biz_ext?: unknown
  distance?: unknown
  website?: unknown
  business_area?: unknown
}

type AmapPhotoLike = {
  url?: unknown
}

type AmapBizExtLike = {
  rating?: unknown
  cost?: unknown
}

type AmapLngLatLike = {
  lng?: unknown
  lat?: unknown
  getLng?: () => unknown
  getLat?: () => unknown
}

type AmapMapClickLike = {
  id?: unknown
  lnglat?: unknown
  poi?: unknown
  name?: unknown
  address?: unknown
  type?: unknown
}

declare global {
  interface Window {
    AMapLoader?: AmapLoaderGlobal
    _AMapSecurityConfig?: AmapSecurityConfig
  }
}

let loaderScriptPromise: Promise<void> | undefined
let amapPromise: Promise<AmapNamespace> | undefined

export type AmapAdapterDependencies = {
  loadAmap?: (config: AmapConfig) => Promise<AmapNamespace>
}

type RenderedMarker = {
  marker: AmapMarker
  content: HTMLElement
  location: [number, number]
  signature: string
}

export function createAmapAdapter(
  config: AmapConfig,
  dependencies: AmapAdapterDependencies = {},
): MapAdapter {
  let amap: AmapNamespace | undefined
  let map: AmapMap | undefined
  let mountOptions: MapMountOptions | undefined
  let destroyed = false
  let focusedPlaceId: PlaceId | undefined
  let cleanupNativeContextMenu: (() => void) | undefined
  let contextMenuBindTimer: number | undefined
  let searchPreviewMarker: AmapMarker | undefined
  const searchResultMarkers: AmapMarker[] = []
  const loadNamespace = dependencies.loadAmap ?? loadAmap
  let lastFitSignature = ''
  let markersVisible = true
  let searchPreviewLocation: [number, number] | undefined
  const renderedMarkers = new Map<PlaceId, RenderedMarker>()

  function clearMarkers(): void {
    for (const { marker } of renderedMarkers.values()) {
      marker.setMap(null)
    }
    renderedMarkers.clear()
  }

  function updateFocusedMarker(): void {
    for (const [placeId, rendered] of renderedMarkers) {
      rendered.content.classList.toggle('selected', placeId === focusedPlaceId)
    }
  }

  function clearSearchResultMarkers(): void {
    for (const marker of searchResultMarkers) {
      marker.setMap(null)
    }
    searchResultMarkers.length = 0
  }

  return {
    async mount(container, options) {
      mountOptions = options

      if (!config.enabled) {
        return
      }

      const namespace = await loadNamespace(config)

      // The adapter may have been destroyed while the SDK was loading
      // (e.g. StrictMode double-mount). Binding here would leak a second
      // map instance plus document-level handlers that swallow right-clicks.
      if (destroyed) {
        return
      }

      amap = namespace
      map = new amap.Map(container, {
        center: [options.center.lng, options.center.lat],
        isHotspot: true,
        mapStyle: mapStyleForTheme(options.theme ?? 'light', config.mapStyle),
        resizeEnable: true,
        viewMode: '2D',
        zoom: options.zoom,
      })
      map.setStatus?.({ isHotspot: true })

      const handlePoiClick = (event: unknown) => {
        void resolveMapClickCandidate(event).then((candidate) => {
          if (candidate) {
            mountOptions?.onPoiSelect?.(candidate)
          }
        })
      }

      map.on?.('hotspotclick', handlePoiClick)
      map.on?.('click', handlePoiClick)

      const openNativeContextMenu = (event: MouseEvent) => {
        event.preventDefault()
        event.stopImmediatePropagation()
        event.stopPropagation()
        const rect = container.getBoundingClientRect()
        const relativePixel = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
        const pixelInput = amap?.Pixel
          ? new amap.Pixel(relativePixel.x, relativePixel.y)
          : [relativePixel.x, relativePixel.y]
        const location =
          parseLocation(convertContainerPixelToLocation(map, pixelInput)) ??
          parseLocation(map?.getCenter?.()) ??
          options.center

        mountOptions?.onContextMenu?.({
          location,
          pixel: {
            x: event.clientX,
            y: event.clientY,
          },
        })
      }

      const handleNativeContextMenu = (event: MouseEvent) => {
        openNativeContextMenu(event)
      }

      const handleNativeMouseDown = (event: MouseEvent) => {
        if (event.button === 2) {
          openNativeContextMenu(event)
        }
      }

      const handleDocumentMouseDown = (event: MouseEvent) => {
        const target = event.target
        if (event.button === 2 && target instanceof Node && container.contains(target)) {
          openNativeContextMenu(event)
        }
      }

      const handleDocumentContextMenu = (event: MouseEvent) => {
        const target = event.target
        if (target instanceof Node && container.contains(target)) {
          openNativeContextMenu(event)
        }
      }

      const bindNativeContextMenuTargets = () => {
        cleanupNativeContextMenu?.()
        const targets = [
          container,
          ...Array.from(container.querySelectorAll<HTMLElement>('canvas, .amap-layer')),
        ]

        for (const target of targets) {
          target.addEventListener('contextmenu', handleNativeContextMenu, true)
          target.addEventListener('mousedown', handleNativeMouseDown, true)
        }
        document.addEventListener('contextmenu', handleDocumentContextMenu, true)
        document.addEventListener('mousedown', handleDocumentMouseDown, true)

        cleanupNativeContextMenu = () => {
          for (const target of targets) {
            target.removeEventListener('contextmenu', handleNativeContextMenu, true)
            target.removeEventListener('mousedown', handleNativeMouseDown, true)
          }
          document.removeEventListener('contextmenu', handleDocumentContextMenu, true)
          document.removeEventListener('mousedown', handleDocumentMouseDown, true)
        }
      }

      bindNativeContextMenuTargets()
      contextMenuBindTimer = window.setTimeout(bindNativeContextMenuTargets, 300)
    },

    setMarkers(markers) {
      if (!amap || !map) {
        return
      }

      // Incremental diff: only create/remove/update what actually changed so
      // a note edit or a new visit does not rebuild every marker DOM node.
      const incomingIds = new Set<PlaceId>()
      for (const place of markers) {
        incomingIds.add(place.id)
        const signature = markerSignature(place)
        const existing = renderedMarkers.get(place.id)

        if (existing) {
          if (existing.signature !== signature) {
            existing.content.className = `amap-place-marker ${place.status}`
            existing.content.setAttribute('aria-label', place.label)
            const scoreSpan = existing.content.querySelector('.marker-score')
            if (scoreSpan) {
              scoreSpan.textContent = place.score ? place.score.toFixed(1) : '想去'
            }
            const labelSpan = existing.content.querySelector('.marker-label')
            if (labelSpan) {
              labelSpan.textContent = place.label
            }
            const nextLocation: [number, number] = [place.location.lng, place.location.lat]
            if (
              existing.location[0] !== nextLocation[0] ||
              existing.location[1] !== nextLocation[1]
            ) {
              existing.marker.setPosition?.(nextLocation)
              existing.location = nextLocation
            }
            existing.signature = signature
          }
          continue
        }

        const content = createMarkerContent(place)
        const marker = new amap.Marker({
          content,
          offset: [-14, -30],
          position: [place.location.lng, place.location.lat],
          title: place.label,
        })

        content.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          mountOptions?.onSelectPlace(place.id)
        })
        marker.on?.('click', () => mountOptions?.onSelectPlace(place.id))
        marker.setMap(markersVisible ? map : null)
        renderedMarkers.set(place.id, {
          content,
          location: [place.location.lng, place.location.lat],
          marker,
          signature,
        })
      }

      for (const [placeId, rendered] of renderedMarkers) {
        if (!incomingIds.has(placeId)) {
          rendered.marker.setMap(null)
          renderedMarkers.delete(placeId)
        }
      }

      updateFocusedMarker()

      // Refit only when the visible place set changes (filter/search), not on
      // every write that touches a place record.
      const fitSignature = [...incomingIds].sort().join('|')
      if (renderedMarkers.size > 0 && fitSignature !== lastFitSignature) {
        lastFitSignature = fitSignature
        map.setFitView?.(
          Array.from(renderedMarkers.values()).map((rendered) => rendered.marker),
          prefersReducedMotion(),
          [72, 72, 72, 72],
        )
      }
      if (renderedMarkers.size === 0) {
        lastFitSignature = ''
      }
    },

    setMapTheme(theme) {
      map?.setMapStyle?.(mapStyleForTheme(theme, config.mapStyle))
    },

    setSelectedMarker(placeId) {
      focusedPlaceId = placeId
      updateFocusedMarker()
    },

    setMarkersVisible(visible) {
      markersVisible = visible
      for (const { marker } of renderedMarkers.values()) {
        marker.setMap(visible ? map ?? null : null)
      }
    },

    setSearchResultMarkers(candidates) {
      if (!amap || !map) {
        return
      }

      clearSearchResultMarkers()

      for (const candidate of candidates) {
        // Skip the candidate already shown as the preview pin to avoid two
        // stacked pins at the same coordinate.
        if (
          searchPreviewLocation &&
          Math.abs(candidate.location.lng - searchPreviewLocation[0]) < 1e-6 &&
          Math.abs(candidate.location.lat - searchPreviewLocation[1]) < 1e-6
        ) {
          continue
        }

        const content = createSearchMarkerContent(candidate.name)
        const marker = new amap.Marker({
          content,
          offset: [-14, -30],
          position: [candidate.location.lng, candidate.location.lat],
          title: candidate.name,
        })

        content.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          mountOptions?.onPoiSelect?.(candidate)
        })
        marker.on?.('click', () => mountOptions?.onPoiSelect?.(candidate))
        marker.setMap(map)
        searchResultMarkers.push(marker)
      }

      if (searchResultMarkers.length > 0) {
        map.setFitView?.(searchResultMarkers, prefersReducedMotion(), [72, 72, 72, 72])
      }
    },

    focusPlace(placeId) {
      if (!map) {
        return
      }

      const rendered = renderedMarkers.get(placeId)
      if (!rendered) {
        return
      }

      focusedPlaceId = placeId
      updateFocusedMarker()
      if (map.setZoomAndCenter) {
        map.setZoomAndCenter(15, rendered.location, prefersReducedMotion())
        return
      }

      map.setCenter(rendered.location)
    },

    focusLocation(location, zoom = 16) {
      if (!map) {
        return
      }

      const center: [number, number] = [location.lng, location.lat]
      if (map.setZoomAndCenter) {
        map.setZoomAndCenter(zoom, center, prefersReducedMotion())
        return
      }

      map.setCenter(center)
    },

    // Browser geolocation returns WGS-84, which drifts on GCJ-02 AMap tiles;
    // the AMap plugin already returns map-ready coordinates.
    async locate() {
      const namespace = await loadNamespace(config)
      if (!namespace.Geolocation) {
        throw new Error('定位插件不可用')
      }

      const geolocation = new namespace.Geolocation({
        enableHighAccuracy: true,
        showButton: false,
        showCircle: false,
        showMarker: false,
        timeout: 8000,
      })

      return new Promise<LocationPoint>((resolve, reject) => {
        geolocation.getCurrentPosition((status, result) => {
          const location =
            status === 'complete'
              ? parseLocation((result as { position?: unknown } | undefined)?.position)
              : undefined
          if (location) {
            resolve(location)
          } else {
            reject(new Error('定位失败'))
          }
        })
      })
    },

    setSearchPreview(candidate) {
      searchPreviewMarker?.setMap(null)
      searchPreviewMarker = undefined
      searchPreviewLocation = undefined

      if (!amap || !map || !candidate) {
        return
      }

      const marker = new amap.Marker({
        content: createSearchPreviewContent(candidate.name),
        offset: [-14, -30],
        position: [candidate.location.lng, candidate.location.lat],
        title: candidate.name,
      })
      marker.setMap(map)
      searchPreviewMarker = marker
      searchPreviewLocation = [candidate.location.lng, candidate.location.lat]
      this.focusLocation(candidate.location, 16)
    },

    async searchPoi(keyword) {
      const query = keyword.trim()

      if (!config.enabled || query.length === 0) {
        return []
      }

      const loadedAmap = await loadNamespace(config)
      amap = loadedAmap
      const placeSearch = new loadedAmap.PlaceSearch({
        city: DEFAULT_CITY,
        extensions: 'all',
        pageSize: 8,
      })

      return new Promise((resolve, reject) => {
        placeSearch.search(query, async (status, result) => {
          if (status === 'complete') {
            const candidates = mapAmapPoisToCandidates(readPoiList(result))
            resolve(
              await Promise.all(
                candidates.map(async (candidate) =>
                  candidate.sourceId
                    ? ((await getPoiDetails(candidate.sourceId, candidate.location)) ?? candidate)
                    : candidate,
                ),
              ),
            )
            return
          }

          if (status === 'no_data') {
            resolve([])
            return
          }

          reject(new Error('高德地点搜索失败'))
        })
      })
    },

    destroy() {
      destroyed = true
      clearMarkers()
      clearSearchResultMarkers()
      if (contextMenuBindTimer !== undefined) {
        window.clearTimeout(contextMenuBindTimer)
        contextMenuBindTimer = undefined
      }
      cleanupNativeContextMenu?.()
      cleanupNativeContextMenu = undefined
      searchPreviewMarker?.setMap(null)
      searchPreviewMarker = undefined
      searchPreviewLocation = undefined
      map?.destroy()
      map = undefined
      amap = undefined
      mountOptions = undefined
      focusedPlaceId = undefined
      lastFitSignature = ''
    },
  }

  async function resolveMapClickCandidate(event: unknown): Promise<PoiCandidate | undefined> {
    const eventCandidate = mapClickEventToCandidate(event)

    if (eventCandidate?.sourceId) {
      return (await getPoiDetails(eventCandidate.sourceId)) ?? eventCandidate
    }

    if (eventCandidate?.name && eventCandidate.name !== '地图选点') {
      return (await enrichExactEventCandidate(eventCandidate)) ?? eventCandidate
    }

    const location = eventCandidate?.location ?? parseLocation((event as AmapMapClickLike | undefined)?.lnglat)

    if (!location) {
      return undefined
    }

    const reverseGeocodeCandidate = await reverseGeocode(location)

    if (reverseGeocodeCandidate) {
      return reverseGeocodeCandidate
    }

    return {
      name: '附近位置',
      address: `${location.lng.toFixed(5)}, ${location.lat.toFixed(5)}`,
      location,
      type: '地图坐标',
    }
  }

  async function enrichExactEventCandidate(
    candidate: PoiCandidate,
  ): Promise<PoiCandidate | undefined> {
    if (!config.enabled || !amap?.PlaceSearch) {
      return undefined
    }

    const placeSearch = new amap.PlaceSearch({
      city: DEFAULT_CITY,
      extensions: 'all',
      pageSize: 6,
    })

    return new Promise((resolve) => {
      placeSearch.search(candidate.name, async (status, result) => {
        if (status !== 'complete') {
          resolve(undefined)
          return
        }

        const sameNamedCandidate = chooseSameNamedCandidate(
          mapAmapPoisToCandidates(readPoiList(result), candidate.location),
          candidate,
        )

        if (!sameNamedCandidate) {
          resolve(undefined)
          return
        }

        resolve(
          sameNamedCandidate.sourceId
            ? ((await getPoiDetails(sameNamedCandidate.sourceId, candidate.location)) ??
                sameNamedCandidate)
            : sameNamedCandidate,
        )
      })
    })
  }

  async function getPoiDetails(
    poiId: string,
    clickLocation?: PoiCandidate['location'],
  ): Promise<PoiCandidate | undefined> {
    if (!amap?.PlaceSearch) {
      return undefined
    }

    const placeSearch = new amap.PlaceSearch({
      city: DEFAULT_CITY,
      extensions: 'all',
    })
    const getDetails = placeSearch.getDetails

    if (!getDetails) {
      return undefined
    }

    return new Promise((resolve) => {
      getDetails.call(placeSearch, poiId, (status, result) => {
        if (status === 'complete') {
          resolve(mapAmapPoisToCandidates(readPoiList(result), clickLocation)[0])
          return
        }

        resolve(undefined)
      })
    })
  }

  async function reverseGeocode(
    location: PoiCandidate['location'],
  ): Promise<PoiCandidate | undefined> {
    if (!amap?.Geocoder) {
      return undefined
    }

    const geocoder = new amap.Geocoder({
      city: DEFAULT_CITY,
      extensions: 'base',
    })

    return new Promise((resolve) => {
      geocoder.getAddress([location.lng, location.lat], (status, result) => {
        if (status !== 'complete') {
          resolve(undefined)
          return
        }

        const formattedAddress = readFormattedAddress(result)

        if (!formattedAddress) {
          resolve(undefined)
          return
        }

        resolve({
          name: formattedAddress,
          address: formattedAddress,
          location,
          type: '地址',
        })
      })
    })
  }
}

function mapStyleForTheme(theme: 'light' | 'plain' | 'dark', customStyle?: string): string {
  if (theme === 'dark') {
    return 'amap://styles/dark'
  }

  if (theme === 'plain') {
    return 'amap://styles/whitesmoke'
  }

  return customStyle ? `amap://styles/${customStyle}` : 'amap://styles/normal'
}

function mapClickEventToCandidate(event: unknown): PoiCandidate | undefined {
  const click = event as AmapMapClickLike | undefined
  const poi = click?.poi as AmapMapClickLike | undefined
  const source = poi ?? click
  const location = parseLocation(source?.lnglat) ?? parseLocation(click?.lnglat)
  const sourceId = typeof source?.id === 'string' ? source.id.trim() : undefined
  const name = typeof source?.name === 'string' ? source.name.trim() : ''
  const address = typeof source?.address === 'string' ? source.address.trim() : ''
  const type = typeof source?.type === 'string' ? source.type.trim() : undefined

  if (!location) {
    return undefined
  }

  const candidate: PoiCandidate = {
    name: name || '地图选点',
    address: address || `${location.lng.toFixed(5)}, ${location.lat.toFixed(5)}`,
    location,
  }

  if (sourceId) {
    candidate.sourceId = sourceId
  }

  if (type) {
    candidate.type = type
  }

  return candidate
}

export function mapAmapPoisToCandidates(
  pois: readonly AmapPoiLike[],
  origin?: PoiCandidate['location'],
): PoiCandidate[] {
  return pois.flatMap((poi) => {
    const sourceId = typeof poi.id === 'string' ? poi.id.trim() : undefined
    const name = typeof poi.name === 'string' ? poi.name.trim() : ''
    const address = typeof poi.address === 'string' ? poi.address.trim() : ''
    const type = typeof poi.type === 'string' ? poi.type.trim() : undefined
    const tel = typeof poi.tel === 'string' ? poi.tel.trim() : undefined
    const businessArea =
      typeof poi.business_area === 'string' ? poi.business_area.trim() : undefined
    const location = parseLocation(poi.location)
    const photos = readPhotoUrls(poi.photos)
    const bizExt = isRecord(poi.biz_ext) ? (poi.biz_ext as AmapBizExtLike) : undefined
    const rating = typeof bizExt?.rating === 'string' ? bizExt.rating.trim() : undefined
    const averageCost = typeof bizExt?.cost === 'string' ? bizExt.cost.trim() : undefined
    const apiDistance = Number(poi.distance)
    const distanceMeters = Number.isFinite(apiDistance)
      ? apiDistance
      : origin && location
        ? calculateDistanceMeters(origin, location)
        : undefined

    if (!name || !location) {
      return []
    }

    const candidate: PoiCandidate = {
      name,
      address,
      location,
    }

    if (sourceId) {
      candidate.sourceId = sourceId
    }

    if (type) {
      candidate.type = type
    }

    if (tel) {
      candidate.tel = tel
    }

    if (photos.length > 0) {
      candidate.photos = photos
    }

    if (rating) {
      candidate.rating = rating
    }

    if (averageCost) {
      candidate.averageCost = averageCost
    }

    if (businessArea) {
      candidate.businessArea = businessArea
    }

    if (distanceMeters !== undefined) {
      candidate.distanceMeters = Math.round(distanceMeters)
    }

    return [candidate]
  })
}

async function loadAmap(config: AmapConfig): Promise<AmapNamespace> {
  if (!config.enabled) {
    throw new Error('未配置高德 Key')
  }

  if (config.securityJsCode) {
    window._AMapSecurityConfig = { securityJsCode: config.securityJsCode }
  }

  if (!amapPromise) {
    amapPromise = loadAmapLoaderScript().then(() => {
      if (!window.AMapLoader) {
        throw new Error('高德加载器不可用')
      }

      return window.AMapLoader.load({
        key: config.key,
        plugins: AMAP_PLUGINS,
        version: '2.0',
      })
    })
    // Drop the cached promise on failure so a later mount/search can retry.
    amapPromise.catch(() => {
      amapPromise = undefined
    })
  }

  return amapPromise
}

function loadAmapLoaderScript(): Promise<void> {
  if (loaderScriptPromise) {
    return loaderScriptPromise
  }

  loaderScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${AMAP_LOADER_URL}"]`,
    )

    if (existingScript) {
      if (window.AMapLoader) {
        resolve()
        return
      }

      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener(
        'error',
        () => {
          existingScript.remove()
          loaderScriptPromise = undefined
          reject(new Error('高德脚本加载失败'))
        },
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = AMAP_LOADER_URL
    script.onload = () => resolve()
    script.onerror = () => {
      // Remove the failed tag and reset the cache so the next attempt injects a fresh script.
      script.remove()
      loaderScriptPromise = undefined
      reject(new Error('高德脚本加载失败'))
    }
    document.head.appendChild(script)
  })

  return loaderScriptPromise
}

function readPoiList(result: unknown): AmapPoiLike[] {
  if (!isRecord(result)) {
    return []
  }

  const poiList = result.poiList
  if (!isRecord(poiList) || !Array.isArray(poiList.pois)) {
    return []
  }

  return poiList.pois.filter(isRecord)
}

function readFormattedAddress(result: unknown): string | undefined {
  if (!isRecord(result) || !isRecord(result.regeocode)) {
    return undefined
  }

  return typeof result.regeocode.formattedAddress === 'string'
    ? result.regeocode.formattedAddress.trim()
    : undefined
}

function readPhotoUrls(photos: unknown): string[] {
  if (!Array.isArray(photos)) {
    return []
  }

  return photos.flatMap((photo) => {
    const url = isRecord(photo) ? (photo as AmapPhotoLike).url : undefined
    return typeof url === 'string' && url.trim() ? [url.trim()] : []
  })
}

function chooseNearestCandidate(
  candidates: PoiCandidate[],
  origin: PoiCandidate['location'],
): PoiCandidate | undefined {
  const bySourceId = new Map<string, PoiCandidate>()
  const anonymousCandidates: PoiCandidate[] = []

  for (const candidate of candidates) {
    if (!candidate.sourceId) {
      anonymousCandidates.push(candidate)
      continue
    }

    const existing = bySourceId.get(candidate.sourceId)
    if (!existing || compareCandidateDistance(candidate, existing, origin) < 0) {
      bySourceId.set(candidate.sourceId, candidate)
    }
  }

  return [...bySourceId.values(), ...anonymousCandidates].sort((first, second) =>
    compareCandidateDistance(first, second, origin),
  )[0]
}

function chooseSameNamedCandidate(
  candidates: PoiCandidate[],
  source: PoiCandidate,
): PoiCandidate | undefined {
  const sourceName = normalizePoiName(source.name)
  const matchingCandidates = candidates.filter((candidate) => {
    const candidateName = normalizePoiName(candidate.name)
    return (
      candidateName === sourceName ||
      candidateName.includes(sourceName) ||
      sourceName.includes(candidateName)
    )
  })

  return chooseNearestCandidate(matchingCandidates, source.location)
}

function normalizePoiName(name: string): string {
  return name
    .toLocaleLowerCase('zh-CN')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function compareCandidateDistance(
  first: PoiCandidate,
  second: PoiCandidate,
  origin: PoiCandidate['location'],
): number {
  return getCandidateDistance(first, origin) - getCandidateDistance(second, origin)
}

function getCandidateDistance(
  candidate: PoiCandidate,
  origin: PoiCandidate['location'],
): number {
  return candidate.distanceMeters ?? calculateDistanceMeters(origin, candidate.location)
}

function calculateDistanceMeters(
  start: PoiCandidate['location'],
  end: PoiCandidate['location'],
): number {
  const earthRadiusMeters = 6371000
  const startLat = toRadians(start.lat)
  const endLat = toRadians(end.lat)
  const deltaLat = toRadians(end.lat - start.lat)
  const deltaLng = toRadians(end.lng - start.lng)
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function parseLocation(location: unknown): PoiCandidate['location'] | undefined {
  if (Array.isArray(location)) {
    return toLocationPoint(location[0], location[1])
  }

  if (!isRecord(location)) {
    return undefined
  }

  const point = location as AmapLngLatLike
  const lng = typeof point.getLng === 'function' ? point.getLng() : point.lng
  const lat = typeof point.getLat === 'function' ? point.getLat() : point.lat

  return toLocationPoint(lng, lat)
}

function toLocationPoint(lng: unknown, lat: unknown): PoiCandidate['location'] | undefined {
  const normalizedLng = Number(lng)
  const normalizedLat = Number(lat)

  if (!Number.isFinite(normalizedLng) || !Number.isFinite(normalizedLat)) {
    return undefined
  }

  return { lng: normalizedLng, lat: normalizedLat }
}

function convertContainerPixelToLocation(map: AmapMap | undefined, pixel: unknown): unknown {
  if (!map?.containerToLngLat) {
    return undefined
  }

  try {
    return map.containerToLngLat(pixel)
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function markerSignature(place: PlaceMarker): string {
  return [
    place.label,
    place.status,
    place.score ?? '',
    place.location.lng,
    place.location.lat,
  ].join('|')
}

function createMarkerContent(place: PlaceMarker): HTMLElement {
  const marker = document.createElement('button')
  marker.className = `amap-place-marker ${place.status}`
  marker.type = 'button'
  marker.setAttribute('aria-label', place.label)

  const scoreSpan = document.createElement('span')
  scoreSpan.className = 'marker-score'
  scoreSpan.textContent = place.score ? place.score.toFixed(1) : '想去'
  marker.append(scoreSpan)

  const label = document.createElement('span')
  label.className = 'marker-label'
  label.textContent = place.label
  marker.append(label)
  return marker
}

function createSearchMarkerContent(labelText: string): HTMLElement {
  const marker = document.createElement('button')
  marker.className = 'amap-search-marker'
  marker.type = 'button'
  marker.setAttribute('aria-label', labelText)
  const label = document.createElement('span')
  label.textContent = '搜'
  marker.append(label)
  return marker
}

function createSearchPreviewContent(labelText: string): HTMLElement {
  const marker = document.createElement('button')
  marker.className = 'amap-search-marker preview'
  marker.type = 'button'
  marker.setAttribute('aria-label', labelText)
  const label = document.createElement('span')
  label.textContent = '搜'
  marker.append(label)

  const nameTag = document.createElement('span')
  nameTag.className = 'marker-label'
  nameTag.textContent = labelText
  marker.append(nameTag)
  return marker
}
