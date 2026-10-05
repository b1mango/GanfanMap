import { describe, expect, it } from 'vitest'
import { getAmapConfig } from './amapConfig'

describe('amap config', () => {
  it('returns disabled config when key is missing', () => {
    expect(getAmapConfig({})).toEqual({
      enabled: false,
      key: '',
      securityJsCode: '',
      mapStyle: '',
    })
  })

  it('reads key and security code from Vite env', () => {
    expect(
      getAmapConfig({
        VITE_AMAP_KEY: 'web-key',
        VITE_AMAP_SECURITY_JS_CODE: 'secret-code',
      }),
    ).toEqual({
      enabled: true,
      key: 'web-key',
      securityJsCode: 'secret-code',
      mapStyle: '',
    })
  })

  it('reads a custom map style id from Vite env', () => {
    expect(
      getAmapConfig({
        VITE_AMAP_KEY: 'web-key',
        VITE_AMAP_MAP_STYLE: 'a1b2c3',
      }).mapStyle,
    ).toBe('a1b2c3')
  })
})

