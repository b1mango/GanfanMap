import type { LocationPoint, PlaceId } from '../../entities/place/types'

export type PlaceMarker = {
  id: PlaceId
  label: string
  status: 'visited' | 'wishlist'
  score?: number
  location: LocationPoint
}

export type PoiCandidate = {
  name: string
  address: string
  location: LocationPoint
  sourceId?: string
  type?: string
  tel?: string
  photos?: string[]
  rating?: string
  averageCost?: string
  businessArea?: string
  distanceMeters?: number
}

export type MapContextMenuPayload = {
  location: LocationPoint
  pixel?: {
    x: number
    y: number
  }
}

export type MapThemeMode = 'light' | 'plain' | 'dark'

export type MapMountOptions = {
  center: LocationPoint
  zoom: number
  theme?: MapThemeMode
  onSelectPlace: (placeId: PlaceId) => void
  onContextMenu?: (payload: MapContextMenuPayload) => void
  onPoiSelect?: (candidate: PoiCandidate) => void
}

export interface MapAdapter {
  mount(container: HTMLElement, options: MapMountOptions): Promise<void>
  setMapTheme(theme: MapThemeMode): void
  setMarkers(markers: PlaceMarker[]): void
  setMarkersVisible(visible: boolean): void
  setSelectedMarker(placeId: PlaceId | undefined): void
  setSearchResultMarkers(candidates: PoiCandidate[]): void
  focusPlace(placeId: string): void
  focusLocation(location: LocationPoint, zoom?: number): void
  locate(): Promise<LocationPoint>
  setSearchPreview(candidate: PoiCandidate | undefined): void
  searchPoi(keyword: string): Promise<PoiCandidate[]>
  destroy(): void
}

export const shanghaiCenter: LocationPoint = { lng: 121.4737, lat: 31.2304 }
