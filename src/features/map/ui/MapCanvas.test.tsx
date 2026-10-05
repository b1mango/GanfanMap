import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Place } from '../../../entities/place/types'
import { MapCanvas } from './MapCanvas'

const adapterSpies = vi.hoisted(() => ({
  mount: vi.fn().mockResolvedValue(undefined),
  setMapTheme: vi.fn(),
  setMarkers: vi.fn(),
  setMarkersVisible: vi.fn(),
  setSelectedMarker: vi.fn(),
  setSearchResultMarkers: vi.fn(),
  focusPlace: vi.fn(),
  focusLocation: vi.fn(),
  locate: vi.fn().mockRejectedValue(new Error('定位失败')),
  setSearchPreview: vi.fn(),
  searchPoi: vi.fn().mockResolvedValue([]),
  destroy: vi.fn(),
}))

vi.mock('../amapAdapter', () => ({
  createAmapAdapter: () => adapterSpies,
}))

vi.mock('../amapConfig', () => ({
  getAmapConfig: () => ({ enabled: true, key: 'test-key', securityJsCode: 'test-code' }),
}))

const samplePlace: Place = {
  id: 'p1',
  name: '测试面馆',
  status: 'visited',
  categoryId: 'noodles',
  tagIds: [],
  address: '上海市测试路 1 号',
  location: { lng: 121.47, lat: 31.23 },
  scores: { taste: 8, environment: 7, service: 7, value: 9 },
  overallScore: 7.8,
  notes: '',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-21T10:00:00.000Z',
}

function renderMap(selectedPlaceId?: string) {
  return render(
    <MapCanvas
      markersVisible
      onMapContextMenu={() => {}}
      onPoiSelect={() => {}}
      onSelectPlace={() => {}}
      places={[samplePlace]}
      searchResults={[]}
      selectedPlaceId={selectedPlaceId}
    />,
  )
}

describe('MapCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adapterSpies.mount.mockResolvedValue(undefined)
  })

  it('moves the camera to the place when selection changes', async () => {
    const { rerender } = renderMap(undefined)
    await waitFor(() => expect(adapterSpies.setMarkers).toHaveBeenCalled())

    rerender(
      <MapCanvas
        markersVisible
        onMapContextMenu={() => {}}
        onPoiSelect={() => {}}
        onSelectPlace={() => {}}
        places={[samplePlace]}
        searchResults={[]}
        selectedPlaceId="p1"
      />,
    )

    await waitFor(() => expect(adapterSpies.focusPlace).toHaveBeenCalledWith('p1'))
  })

  it('clears the highlight without moving the camera when selection is cleared', async () => {
    const { rerender } = renderMap('p1')
    await waitFor(() => expect(adapterSpies.focusPlace).toHaveBeenCalledWith('p1'))

    adapterSpies.focusPlace.mockClear()

    rerender(
      <MapCanvas
        markersVisible
        onMapContextMenu={() => {}}
        onPoiSelect={() => {}}
        onSelectPlace={() => {}}
        places={[samplePlace]}
        searchResults={[]}
        selectedPlaceId={undefined}
      />,
    )

    await waitFor(() => expect(adapterSpies.setSelectedMarker).toHaveBeenCalledWith(undefined))
    expect(adapterSpies.focusPlace).not.toHaveBeenCalled()
  })

  it('destroys the adapter on unmount', async () => {
    const { unmount } = renderMap(undefined)
    await waitFor(() => expect(adapterSpies.mount).toHaveBeenCalled())

    unmount()

    expect(adapterSpies.destroy).toHaveBeenCalled()
  })

  it('falls back to Shanghai with a status message when locating fails', async () => {
    const { findByRole, findByText } = renderMap(undefined)
    await waitFor(() => expect(adapterSpies.mount).toHaveBeenCalled())

    const button = await findByRole('button', { name: '定位到我的位置' })
    button.click()

    await findByText('定位失败，已回到上海')
    expect(adapterSpies.focusLocation).toHaveBeenCalledWith({ lng: 121.4737, lat: 31.2304 }, 12)
  })

  it('focuses the resolved location when locating succeeds', async () => {
    adapterSpies.locate.mockResolvedValueOnce({ lng: 113.26, lat: 23.13 })
    const { findByRole } = renderMap(undefined)
    await waitFor(() => expect(adapterSpies.mount).toHaveBeenCalled())

    const button = await findByRole('button', { name: '定位到我的位置' })
    button.click()

    await waitFor(() =>
      expect(adapterSpies.focusLocation).toHaveBeenCalledWith({ lng: 113.26, lat: 23.13 }, 15),
    )
  })
})
