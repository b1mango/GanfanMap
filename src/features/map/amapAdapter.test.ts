import { describe, expect, it } from 'vitest'
import { createAmapAdapter, mapAmapPoisToCandidates } from './amapAdapter'
import type { AmapMap, AmapMarker, AmapNamespace } from './amapAdapter'

describe('amap adapter', () => {
  it('normalizes valid AMap POI results into internal candidates', () => {
    expect(
      mapAmapPoisToCandidates([
        {
          name: '雾社火锅',
          address: '衡山路 188 号',
          location: { lng: 121.44, lat: 31.2 },
          tel: '021-12345678',
          type: '餐饮服务;火锅店',
        },
      ]),
    ).toEqual([
      {
        name: '雾社火锅',
        address: '衡山路 188 号',
        location: { lng: 121.44, lat: 31.2 },
        tel: '021-12345678',
        type: '餐饮服务;火锅店',
      },
    ])
  })

  it('drops POI results without usable coordinates', () => {
    expect(
      mapAmapPoisToCandidates([
        { name: '缺坐标', address: '上海', location: undefined },
        { name: '', address: '上海', location: { lng: 121.44, lat: 31.2 } },
      ]),
    ).toEqual([])
  })

  it('mounts a real map and renders clickable place markers through the adapter boundary', async () => {
    const selected: string[] = []
    const createdMarkers: FakeMarker[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor(container: HTMLElement, options: Record<string, unknown>) {
              super()
              fakeMap.container = container
              fakeMap.options = options
              return fakeMap
            }
          },
          Marker: class extends FakeMarker {
            constructor(options: Record<string, unknown>) {
              super(options)
              createdMarkers.push(this)
            }
          },
          PlaceSearch: FakePlaceSearch,
        }),
      },
    )
    const container = document.createElement('div')

    await adapter.mount(container, {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onSelectPlace: (placeId) => selected.push(placeId),
    })
    adapter.setMarkers([
      {
        id: 'place_1',
        label: '雾社火锅',
        location: { lng: 121.44, lat: 31.2 },
        score: 8.2,
        status: 'visited',
      },
    ])
    createdMarkers[0]?.content.click()
    createdMarkers[0]?.click()

    expect(fakeMap.container).toBe(container)
    expect(fakeMap.options).toMatchObject({ zoom: 12, viewMode: '2D' })
    expect(createdMarkers).toHaveLength(1)
    expect(createdMarkers[0]?.attachedMap).toBe(fakeMap)
    expect(selected).toEqual(['place_1', 'place_1'])
  })

  it('reports map right-click coordinates through the adapter boundary', async () => {
    const contextMenus: unknown[] = []
    const fakeMap = new FakeMap()
    const container = document.createElement('div')
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: FakeMarker,
          PlaceSearch: FakePlaceSearch,
        }),
      },
    )

    await adapter.mount(container, {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onContextMenu: (payload) => contextMenus.push(payload),
      onSelectPlace: () => undefined,
    })
    fakeMap.containerToLngLatResult = { lng: 121.49, lat: 31.23 }
    container.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 320,
        clientY: 240,
      }),
    )

    expect(contextMenus).toEqual([
      {
        location: { lng: 121.49, lat: 31.23 },
        pixel: { x: 320, y: 240 },
      },
    ])
  })

  it('reports AMap hotspot clicks as POI candidates through the adapter boundary', async () => {
    const selectedPois: unknown[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: FakeMarker,
          PlaceSearch: FakePlaceSearch,
        }),
      },
    )

    await adapter.mount(document.createElement('div'), {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onPoiSelect: (candidate) => selectedPois.push(candidate),
      onSelectPlace: () => undefined,
    })
    fakeMap.emit('hotspotclick', {
      name: '衡山坊',
      lnglat: { lng: 121.44, lat: 31.2 },
      address: '上海市徐汇区衡山路',
      type: '商务住宅',
    })
    await waitForPois(selectedPois)

    expect(selectedPois).toEqual([
      {
        name: '衡山坊',
        address: '上海市徐汇区衡山路',
        location: { lng: 121.44, lat: 31.2 },
        type: '商务住宅',
      },
    ])
  })

  it('keeps the explicitly clicked POI when AMap gives a concrete place name without an id', async () => {
    const selectedPois: unknown[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: FakeMarker,
          PlaceSearch: class extends FakePlaceSearch {
            search(_keyword: string, callback: (status: string, result: unknown) => void): void {
              callback('complete', {
                poiList: {
                  pois: [
                    {
                      id: 'near_other',
                      name: '旁边不是点击目标的店',
                      address: '旁边路 1 号',
                      location: { lng: 121.3954, lat: 31.2228 },
                      type: '餐饮服务',
                    },
                  ],
                },
              })
            }
          },
        }),
      },
    )

    await adapter.mount(document.createElement('div'), {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onPoiSelect: (candidate) => selectedPois.push(candidate),
      onSelectPlace: () => undefined,
    })
    fakeMap.emit('hotspotclick', {
      name: 'JOYCODE(长风大悦城店)',
      lnglat: { lng: 121.39539, lat: 31.22273 },
      address: '大渡河路196号长风大悦城1层L1-53号',
      type: '购物服务;购物相关场所',
    })
    await waitForPois(selectedPois)

    expect(selectedPois).toEqual([
      {
        name: 'JOYCODE(长风大悦城店)',
        address: '大渡河路196号长风大悦城1层L1-53号',
        location: { lng: 121.39539, lat: 31.22273 },
        type: '购物服务;购物相关场所',
      },
    ])
  })

  it('enriches explicitly clicked POIs only when the search result has the same name', async () => {
    const selectedPois: unknown[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: FakeMarker,
          PlaceSearch: class extends FakePlaceSearch {
            search(_keyword: string, callback: (status: string, result: unknown) => void): void {
              callback('complete', {
                poiList: {
                  pois: [
                    {
                      id: 'joycode_1',
                      name: 'JOYCODE(长风大悦城店)',
                      address: '大渡河路196号长风大悦城1层L1-53号',
                      location: { lng: 121.39539, lat: 31.22273 },
                      type: '购物服务;购物相关场所',
                    },
                  ],
                },
              })
            }

            getDetails(
              poiId: string,
              callback: (status: string, result: unknown) => void,
            ): void {
              callback('complete', {
                poiList: {
                  pois: [
                    {
                      id: poiId,
                      name: 'JOYCODE(长风大悦城店)',
                      address: '大渡河路196号长风大悦城1层L1-53号',
                      location: { lng: 121.39539, lat: 31.22273 },
                      tel: '18501985623',
                      type: '购物服务;购物相关场所',
                    },
                  ],
                },
              })
            }
          },
        }),
      },
    )

    await adapter.mount(document.createElement('div'), {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onPoiSelect: (candidate) => selectedPois.push(candidate),
      onSelectPlace: () => undefined,
    })
    fakeMap.emit('hotspotclick', {
      name: 'JOYCODE(长风大悦城店)',
      lnglat: { lng: 121.39539, lat: 31.22273 },
      address: '大渡河路196号长风大悦城1层L1-53号',
      type: '购物服务;购物相关场所',
    })
    await waitForPois(selectedPois)

    expect(selectedPois).toEqual([
      {
        address: '大渡河路196号长风大悦城1层L1-53号',
        distanceMeters: 0,
        location: { lng: 121.39539, lat: 31.22273 },
        name: 'JOYCODE(长风大悦城店)',
        sourceId: 'joycode_1',
        tel: '18501985623',
        type: '购物服务;购物相关场所',
      },
    ])
  })

  it('returns the actual clicked location via reverse geocoding instead of snapping to a nearby POI', async () => {
    const selectedPois: unknown[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Geocoder: class {
            getAddress(
              _location: [number, number],
              callback: (status: string, result: unknown) => void,
            ): void {
              callback('complete', {
                regeocode: {
                  formattedAddress: '上海市黄浦区点击路 1 号',
                },
              })
            }
          },
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: FakeMarker,
          PlaceSearch: class extends FakePlaceSearch {
            searchNearBy(
              _keyword: string,
              _center: [number, number],
              _radius: number,
              callback: (status: string, result: unknown) => void,
            ): void {
              // Nearby POIs exist, but a plain click must NOT snap to them.
              callback('complete', {
                poiList: {
                  pois: [
                    {
                      id: 'near_company',
                      name: '近处公司',
                      address: '近处路 2 号',
                      location: { lng: 121.4738, lat: 31.23045 },
                      type: '公司企业',
                    },
                  ],
                },
              })
            }
          },
        }),
      },
    )

    await adapter.mount(document.createElement('div'), {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onPoiSelect: (candidate) => selectedPois.push(candidate),
      onSelectPlace: () => undefined,
    })
    fakeMap.emit('click', {
      lnglat: { lng: 121.4737, lat: 31.2304 },
    })
    await waitForPois(selectedPois)

    expect(selectedPois).toEqual([
      expect.objectContaining({
        address: '上海市黄浦区点击路 1 号',
        location: { lng: 121.4737, lat: 31.2304 },
      }),
    ])
    // Must not have snapped to the nearby company POI.
    expect(selectedPois[0]).not.toMatchObject({ sourceId: 'near_company' })
  })

  it('enriches hotspot clicks with POI details when AMap provides a POI id', async () => {
    const selectedPois: unknown[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: FakeMarker,
          PlaceSearch: class extends FakePlaceSearch {
            getDetails(
              poiId: string,
              callback: (status: string, result: unknown) => void,
            ): void {
              callback('complete', {
                poiList: {
                  pois: [
                    {
                      id: poiId,
                      name: '上海长风公园',
                      address: '上海市普陀区大渡河路189号',
                      location: { lng: 121.3914, lat: 31.22858 },
                      tel: '021-62453270',
                      type: '风景名胜;公园广场;公园',
                    },
                  ],
                },
              })
            }
          },
        }),
      },
    )

    await adapter.mount(document.createElement('div'), {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onPoiSelect: (candidate) => selectedPois.push(candidate),
      onSelectPlace: () => undefined,
    })
    fakeMap.emit('hotspotclick', {
      poi: {
        id: 'park_1',
        name: '长风公园',
        lnglat: { lng: 121.3914, lat: 31.22858 },
      },
    })
    await waitForPois(selectedPois)

    expect(selectedPois).toEqual([
      {
        address: '上海市普陀区大渡河路189号',
        location: { lng: 121.3914, lat: 31.22858 },
        name: '上海长风公园',
        sourceId: 'park_1',
        tel: '021-62453270',
        type: '风景名胜;公园广场;公园',
      },
    ])
  })

  it('focuses a place marker by centering the map and marking the selected marker', async () => {
    const createdMarkers: FakeMarker[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: class extends FakeMarker {
            constructor(options: Record<string, unknown>) {
              super(options)
              createdMarkers.push(this)
            }
          },
          PlaceSearch: FakePlaceSearch,
        }),
      },
    )

    await adapter.mount(document.createElement('div'), {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onSelectPlace: () => undefined,
    })
    adapter.setMarkers([
      {
        id: 'place_1',
        label: '雾社火锅',
        location: { lng: 121.44, lat: 31.2 },
        score: 8.2,
        status: 'visited',
      },
    ])
    adapter.focusPlace('place_1')

    expect(fakeMap.zoomAndCenter).toEqual({ zoom: 15, center: [121.44, 31.2] })
    expect(createdMarkers[0]?.content.classList.contains('selected')).toBe(true)
  })

  it('aborts mounting when the adapter is destroyed while the SDK is still loading', async () => {
    const contextMenus: unknown[] = []
    let constructedMaps = 0
    let resolveLoad!: (namespace: AmapNamespace) => void
    const loadPromise = new Promise<AmapNamespace>((resolve) => {
      resolveLoad = resolve
    })
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      { loadAmap: () => loadPromise },
    )
    const container = document.createElement('div')
    document.body.append(container)

    const mountPromise = adapter.mount(container, {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onContextMenu: (payload) => contextMenus.push(payload),
      onSelectPlace: () => undefined,
    })

    // Destroy before the SDK finishes loading (StrictMode-style double mount).
    adapter.destroy()
    resolveLoad({
      Map: class extends FakeMap {
        constructor() {
          super()
          constructedMaps += 1
        }
      },
      Marker: FakeMarker,
      PlaceSearch: FakePlaceSearch,
    })
    await mountPromise

    container.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    )

    expect(constructedMaps).toBe(0)
    expect(contextMenus).toEqual([])
    container.remove()
  })

  it('focuses a POI search candidate and renders a temporary search marker', async () => {
    const createdMarkers: FakeMarker[] = []
    const fakeMap = new FakeMap()
    const adapter = createAmapAdapter(
      { enabled: true, key: 'web-key', securityJsCode: '' },
      {
        loadAmap: async () => ({
          Map: class extends FakeMap {
            constructor() {
              super()
              return fakeMap
            }
          },
          Marker: class extends FakeMarker {
            constructor(options: Record<string, unknown>) {
              super(options)
              createdMarkers.push(this)
            }
          },
          PlaceSearch: FakePlaceSearch,
        }),
      },
    )

    await adapter.mount(document.createElement('div'), {
      center: { lng: 121.4737, lat: 31.2304 },
      zoom: 12,
      onSelectPlace: () => undefined,
    })
    adapter.setSearchPreview({
      name: '海底捞火锅',
      address: '南京东路 123 号',
      location: { lng: 121.48759, lat: 31.23825 },
    })

    expect(fakeMap.zoomAndCenter).toEqual({ zoom: 16, center: [121.48759, 31.23825] })
    expect(createdMarkers).toHaveLength(1)
    expect(createdMarkers[0]?.content.classList.contains('amap-search-marker')).toBe(true)
    expect(createdMarkers[0]?.attachedMap).toBe(fakeMap)
  })
})

class FakeMap implements AmapMap {
  container?: HTMLElement
  options?: Record<string, unknown>
  zoomAndCenter?: { zoom: number; center: [number, number] }
  fittedMarkers?: AmapMarker[]
  containerToLngLatResult?: unknown
  destroyed = false
  private handlers = new Map<string, Array<(event: unknown) => void>>()

  destroy(): void {
    this.destroyed = true
  }

  setCenter(center: [number, number]): void {
    this.zoomAndCenter = { zoom: this.zoomAndCenter?.zoom ?? 0, center }
  }

  setZoomAndCenter(zoom: number, center: [number, number]): void {
    this.zoomAndCenter = { zoom, center }
  }

  setFitView(markers?: AmapMarker[]): void {
    this.fittedMarkers = markers
  }

  containerToLngLat(): unknown {
    return this.containerToLngLatResult
  }

  on(eventName: string, callback: (event: unknown) => void): void {
    this.handlers.set(eventName, [...(this.handlers.get(eventName) ?? []), callback])
  }

  emit(eventName: string, event: unknown): void {
    for (const callback of this.handlers.get(eventName) ?? []) {
      callback(event)
    }
  }
}

class FakeMarker implements AmapMarker {
  attachedMap?: AmapMap | null
  readonly content: HTMLElement
  readonly options: Record<string, unknown>
  private clickHandler?: () => void

  constructor(options: Record<string, unknown>) {
    this.options = options
    const content = options.content
    this.content = content instanceof HTMLElement ? content : document.createElement('button')
  }

  setMap(map: AmapMap | null): void {
    this.attachedMap = map
  }

  on(eventName: 'click', callback: () => void): void {
    if (eventName === 'click') {
      this.clickHandler = callback
    }
  }

  click(): void {
    this.clickHandler?.()
  }
}

class FakePlaceSearch {
  search(_keyword: string, callback: (status: string, result: unknown) => void): void {
    callback('no_data', {})
  }
}

async function waitForPois(selectedPois: unknown[]): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    if (selectedPois.length > 0) {
      return
    }

    await new Promise((resolve) => window.setTimeout(resolve, 0))
  }
}
