import { useState } from 'react'
import { Copy, ExternalLink, MapPin, Phone, X } from 'lucide-react'
import type { Category, PlaceStatus } from '../../../entities/place/types'
import { STATUS_OPTIONS } from '../../../shared/constants'
import { getOptionalNumberFromString } from '../../../shared/formData'
import type { PoiCandidate } from '../mapAdapter'

export type PoiMarkDraft = {
  status: PlaceStatus
  categoryId: string
  averagePrice?: number
  notes: string
}

export function MapPoiPanel({
  candidate,
  categories,
  errorMessage,
  isSaving,
  onClose,
  onMarkCandidate,
}: {
  candidate: PoiCandidate
  categories: Category[]
  errorMessage: string
  isSaving: boolean
  onClose: () => void
  onMarkCandidate: (candidate: PoiCandidate, draft: PoiMarkDraft) => void
}) {
  const [markStatus, setMarkStatus] = useState<PlaceStatus>('visited')
  const [markCategoryId, setMarkCategoryId] = useState('')
  const [markAveragePrice, setMarkAveragePrice] = useState(candidate.averageCost ?? '')
  const [markNotes, setMarkNotes] = useState('')
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resolvedCategoryId = markCategoryId || categories[0]?.id || ''
  const primaryPhoto = candidate.photos?.[0]
  // Distances under 50m are artifacts of comparing a POI with its own search hit.
  const distanceLabel =
    candidate.distanceMeters !== undefined && candidate.distanceMeters >= 50
      ? formatDistance(candidate.distanceMeters)
      : undefined
  const amapUrl = `https://uri.amap.com/marker?position=${candidate.location.lng},${candidate.location.lat}&name=${encodeURIComponent(candidate.name)}`

  async function copyAddress(): Promise<void> {
    if (!navigator.clipboard) {
      setCopyFeedback('failed')
      return
    }

    try {
      await navigator.clipboard.writeText(candidate.address || candidate.name)
      setCopyFeedback('copied')
    } catch {
      setCopyFeedback('failed')
    }

    window.setTimeout(() => setCopyFeedback('idle'), 2000)
  }

  return (
    <aside className="map-poi-card" aria-label="地图地点详情">
      <button className="icon-button map-poi-close" type="button" aria-label="关闭地图地点详情" onClick={onClose}>
        <X aria-hidden="true" size={17} />
      </button>
      <div className={primaryPhoto ? 'map-poi-cover' : 'map-poi-cover empty'}>
        {primaryPhoto ? <img alt="" src={primaryPhoto} referrerPolicy="no-referrer" /> : <MapPin aria-hidden="true" size={30} />}
      </div>
      <div className="map-poi-head">
        <div>
          <span>{candidate.type || '高德地图地点'}</span>
          <h2>{candidate.name}</h2>
          <p>{candidate.address || '未返回详细地址'}</p>
        </div>
        <MapPin aria-hidden="true" size={18} />
      </div>
      <div className="map-poi-stats">
        <div>
          <span>评分</span>
          <strong>{candidate.rating || '未返回'}</strong>
        </div>
        <div>
          <span>人均</span>
          <strong>{candidate.averageCost ? `¥${candidate.averageCost}` : '未返回'}</strong>
        </div>
        <div>
          <span>距离</span>
          <strong>{distanceLabel || '—'}</strong>
        </div>
      </div>
      <dl className="map-poi-meta">
        <div>
          <dt>地址</dt>
          <dd>{candidate.address || '未返回详细地址'}</dd>
        </div>
        {candidate.tel ? (
          <div>
            <dt>电话</dt>
            <dd>{candidate.tel}</dd>
          </div>
        ) : null}
        {candidate.businessArea ? (
          <div>
            <dt>商圈</dt>
            <dd>{candidate.businessArea}</dd>
          </div>
        ) : null}
        <div>
          <dt>坐标</dt>
          <dd>
            {candidate.location.lng.toFixed(5)}, {candidate.location.lat.toFixed(5)}
          </dd>
        </div>
      </dl>
      <div className="map-poi-actions">
        <button type="button" onClick={() => void copyAddress()}>
          <Copy aria-hidden="true" size={15} />
          {copyFeedback === 'copied' ? '已复制' : copyFeedback === 'failed' ? '复制失败' : '复制地址'}
        </button>
        {candidate.tel ? (
          <a href={`tel:${candidate.tel}`}>
            <Phone aria-hidden="true" size={15} />
            拨号
          </a>
        ) : null}
        <a href={amapUrl} rel="noreferrer" target="_blank">
          <ExternalLink aria-hidden="true" size={15} />
          高德查看
        </a>
      </div>
      <div className="poi-mark-form">
        <div className="segmented compact" role="group" aria-label="标记状态">
          {STATUS_OPTIONS.map(([value, label]) => (
            <button
              className={markStatus === value ? 'active' : ''}
              aria-pressed={markStatus === value}
              key={value}
              type="button"
              onClick={() => setMarkStatus(value as PlaceStatus)}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          类型
          <select
            value={resolvedCategoryId}
            onChange={(event) => setMarkCategoryId(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          人均
          <input
            inputMode="numeric"
            min={0}
            placeholder="例如：128"
            type="number"
            value={markAveragePrice}
            onChange={(event) => setMarkAveragePrice(event.target.value)}
          />
        </label>
        <label className="poi-mark-notes">
          备注
          <textarea
            placeholder="推荐菜、排队情况、为什么想去…"
            value={markNotes}
            onChange={(event) => setMarkNotes(event.target.value)}
          />
        </label>
        {errorMessage ? (
          <p className="form-note form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          className="primary-button full"
          type="button"
          disabled={isSaving}
          onClick={() =>
            onMarkCandidate(candidate, {
              averagePrice: getOptionalNumberFromString(markAveragePrice),
              categoryId: resolvedCategoryId,
              notes: markNotes,
              status: markStatus,
            })
          }
        >
          添加到标记
        </button>
      </div>
    </aside>
  )
}

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.max(1, Math.round(distanceMeters))}m`
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`
}
