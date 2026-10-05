import { useEffect, useMemo, useRef } from 'react'
import { ChevronDown, ChevronRight, Pencil, SearchX, X } from 'lucide-react'
import type { Category, Place, Tag } from '../../../entities/place/types'
import { trapPanelFocus } from '../../../shared/focusTrap'
import { formatCurrency, formatScore } from '../../../shared/format'
import { EditPlaceDialog } from './PlaceEditorDialog'

export function PlaceStatusBar({
  count,
  hasActiveFilters,
  isOpen,
  onToggle,
}: {
  count: number
  hasActiveFilters: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      aria-expanded={isOpen}
      aria-label={isOpen ? '收起店铺列表' : '展开店铺列表'}
      className={isOpen ? 'place-status-bar open' : 'place-status-bar'}
      type="button"
      onClick={onToggle}
    >
      <span className="place-status-label">档案</span>
      <span className="place-status-sep">·</span>
      <span className="place-status-count">{count}</span>
      {hasActiveFilters ? <span className="place-status-filter-dot" /> : null}
      <span className="place-status-chevron">
        {isOpen ? (
          <ChevronDown aria-hidden="true" size={14} />
        ) : (
          <ChevronRight aria-hidden="true" size={14} />
        )}
      </span>
    </button>
  )
}

export function PlaceOverlayList({
  categories,
  onPlaceSaved,
  onSelectPlace,
  places,
  selectedPlaceId,
  tags,
  onClose,
}: {
  categories: Category[]
  onPlaceSaved: (placeId: string, savedPlace: Place) => void
  onSelectPlace: (placeId: string | undefined) => void
  places: Place[]
  selectedPlaceId?: string
  tags: Tag[]
  onClose: () => void
}) {
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedPlaceId || !listRef.current) return
    const activeItem = listRef.current.querySelector('.overlay-item.active')
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedPlaceId])

  useEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    list.querySelector<HTMLElement>('[aria-label="收起店铺列表"]')?.focus()

    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [])

  return (
    <>
      <div className="place-overlay-scrim" onClick={onClose} aria-hidden="true" />
      <section
        className="place-overlay-list"
        ref={listRef}
        aria-label="店铺列表"
        onKeyDown={(event) => trapPanelFocus(event, listRef.current)}
      >
        <div className="place-overlay-header">
          <span className="place-overlay-title">{places.length}家店</span>
          <button className="icon-button" type="button" aria-label="收起店铺列表" onClick={onClose}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="place-overlay-items">
          {places.map((place) => {
            const category = categoryById.get(place.categoryId)
            const isActive = selectedPlaceId === place.id
            return (
              <div
                className={isActive ? 'overlay-item active' : 'overlay-item'}
                key={place.id}
              >
                <button
                  aria-label={place.name}
                  className="overlay-item-main"
                  type="button"
                  onClick={() => onSelectPlace(place.id)}
                >
                  <span className="overlay-item-dot" style={{ background: category?.color ?? 'var(--accent)' }} />
                  <span className="overlay-item-name">{place.name}</span>
                  <span className="overlay-item-meta">{category?.name ?? '未分类'}</span>
                  <span className="overlay-item-score">{formatScore(place.overallScore)}</span>
                  <span className="overlay-item-price">{formatCurrency(place.averagePrice)}</span>
                </button>
                <EditPlaceDialog
                  categories={categories}
                  place={place}
                  tags={tags}
                  trigger={
                    <button className="overlay-item-edit" type="button" aria-label={`编辑${place.name}`}>
                      <Pencil aria-hidden="true" size={12} />
                    </button>
                  }
                  onPlaceSaved={onPlaceSaved}
                />
              </div>
            )
          })}
          {places.length === 0 ? (
            <div className="overlay-empty">
              <SearchX aria-hidden="true" size={20} />
              <span>没有符合条件的店。可以放宽筛选，或右键地图新增一家店。</span>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}

