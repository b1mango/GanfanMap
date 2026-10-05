import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PoiCandidate } from './features/map/mapAdapter'

const searchPoiMock = vi.fn<() => Promise<PoiCandidate[]>>()

vi.mock('./features/map/amapConfig', () => ({
  getAmapConfig: () => ({
    enabled: true,
    key: 'test-key',
    securityJsCode: '',
  }),
}))

vi.mock('./features/map/amapAdapter', () => ({
  createAmapAdapter: () => ({
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
    searchPoi: searchPoiMock,
    destroy: vi.fn(),
  }),
  mapAmapPoisToCandidates: vi.fn(),
}))

import App from './App'
import { db } from './shared/db/database'

describe('App search requests', () => {
  beforeEach(() => {
    searchPoiMock.mockReset()
  })

  it('saves the applied POI coordinates instead of the default map center', async () => {
    const candidate: PoiCandidate = {
      name: 'POI 坐标店',
      address: 'POI 坐标店地址',
      location: { lng: 121.5301, lat: 31.3102 },
    }
    searchPoiMock.mockResolvedValueOnce([candidate])

    const user = userEvent.setup()
    const { container } = render(<App />)
    const openDialogButton = container.querySelector<HTMLButtonElement>('.search-primary-action button')
    await user.click(openDialogButton as HTMLButtonElement)

    const dialogInput = document.querySelector<HTMLInputElement>('.poi-search-panel input')
    await user.type(dialogInput as HTMLInputElement, 'poi{Enter}')

    await user.click(await screen.findByRole('button', { name: /POI 坐标店/ }))
    await user.click(screen.getByRole('button', { name: '保存店铺' }))

    await waitFor(async () => {
      const savedPlace = (await db.places.toArray()).find((place) => place.name === 'POI 坐标店')
      expect(savedPlace).toBeDefined()
      expect(savedPlace?.location).toEqual(candidate.location)
    })

    await db.places.filter((place) => place.name === 'POI 坐标店').delete()
  })

  it('keeps the newest map search result when responses resolve out of order', async () => {
    const first = createDeferred<PoiCandidate[]>()
    const second = createDeferred<PoiCandidate[]>()
    searchPoiMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const user = userEvent.setup()
    const { container } = render(<App />)
    const input = container.querySelector('input[type="search"]')

    expect(input).toBeInstanceOf(HTMLInputElement)

    await user.type(input as HTMLInputElement, 'first{Enter}')
    await user.clear(input as HTMLInputElement)
    await user.type(input as HTMLInputElement, 'second{Enter}')

    second.resolve([createCandidate('Second Search Result')])
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Second Search Result' })).toBeInTheDocument()
      expect(
        screen.getByText('Second Search Result', { selector: '.map-search-results strong' }),
      ).toBeInTheDocument()
    })

    first.resolve([createCandidate('First Search Result')])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Second Search Result' })).toBeInTheDocument()
      expect(
        screen.getByText('Second Search Result', { selector: '.map-search-results strong' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'First Search Result' })).not.toBeInTheDocument()
      expect(
        screen.queryByText('First Search Result', { selector: '.map-search-results strong' }),
      ).not.toBeInTheDocument()
    })
  })

  it('clears map search state from the search bar', async () => {
    searchPoiMock.mockResolvedValueOnce([createCandidate('Clearable Search Result')])

    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('搜索地图地点')

    await user.type(input, 'clearable{Enter}')

    expect(await screen.findByRole('heading', { name: 'Clearable Search Result' })).toBeInTheDocument()
    expect(
      screen.getByText('Clearable Search Result', { selector: '.map-search-results strong' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清空地图搜索' }))

    expect(input).toHaveValue('')
    expect(screen.getByRole('button', { name: '清空地图搜索' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Clearable Search Result' })).not.toBeInTheDocument()
    expect(
      screen.queryByText('Clearable Search Result', { selector: '.map-search-results strong' }),
    ).not.toBeInTheDocument()

    await user.type(input, 'draft')
    expect(screen.getByRole('button', { name: '清空地图搜索' })).toBeEnabled()

    await user.keyboard('{Escape}')

    expect(input).toHaveValue('')
    expect(screen.getByRole('button', { name: '清空地图搜索' })).toBeDisabled()
  })

  it('keeps the newest add-place POI search result when responses resolve out of order', async () => {
    const first = createDeferred<PoiCandidate[]>()
    const second = createDeferred<PoiCandidate[]>()
    searchPoiMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const user = userEvent.setup()
    const { container } = render(<App />)
    const openDialogButton = container.querySelector<HTMLButtonElement>('.search-primary-action button')

    expect(openDialogButton).toBeInstanceOf(HTMLButtonElement)
    await user.click(openDialogButton as HTMLButtonElement)

    const dialogInput = document.querySelector<HTMLInputElement>('.poi-search-panel input')

    expect(dialogInput).toBeInstanceOf(HTMLInputElement)

    await user.type(dialogInput as HTMLInputElement, 'first{Enter}')
    await user.clear(dialogInput as HTMLInputElement)
    await user.type(dialogInput as HTMLInputElement, 'second{Enter}')

    second.resolve([createCandidate('Second Dialog Result')])
    await waitFor(() => {
      const resultList = document.querySelector('.poi-candidate-list')
      expect(resultList).toBeTruthy()
      expect(within(resultList as HTMLElement).getByText('Second Dialog Result')).toBeInTheDocument()
    })

    first.resolve([createCandidate('First Dialog Result')])

    await waitFor(() => {
      const resultList = document.querySelector('.poi-candidate-list')
      expect(resultList).toBeTruthy()
      expect(within(resultList as HTMLElement).getByText('Second Dialog Result')).toBeInTheDocument()
      expect(
        within(resultList as HTMLElement).queryByText('First Dialog Result'),
      ).not.toBeInTheDocument()
    })
  })
})

function createCandidate(name: string): PoiCandidate {
  return {
    name,
    address: `${name} address`,
    location: { lng: 121.47, lat: 31.23 },
  }
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}
