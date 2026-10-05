export type AmapEnv = Partial<
  Record<'VITE_AMAP_KEY' | 'VITE_AMAP_SECURITY_JS_CODE' | 'VITE_AMAP_MAP_STYLE', string | undefined>
>

export type AmapConfig = {
  enabled: boolean
  key: string
  securityJsCode: string
  /** Custom style id from the AMap console; replaces the default light map style when set. */
  mapStyle?: string
}

export function getAmapConfig(env: AmapEnv = import.meta.env): AmapConfig {
  const key = env.VITE_AMAP_KEY?.trim() ?? ''
  const securityJsCode = env.VITE_AMAP_SECURITY_JS_CODE?.trim() ?? ''
  const mapStyle = env.VITE_AMAP_MAP_STYLE?.trim() ?? ''

  return {
    enabled: key.length > 0,
    key,
    securityJsCode,
    mapStyle,
  }
}
