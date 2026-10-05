import { useEffect, useRef } from 'react'
import type { PlaceStatus } from '../../../entities/place/types'
import type { MapContextMenuPayload } from '../mapAdapter'

export function MapContextMenu({
  errorMessage,
  onClose,
  onSave,
  payload,
  savingStatus,
}: {
  errorMessage: string
  onClose: () => void
  onSave: (status: PlaceStatus) => void
  payload: MapContextMenuPayload
  savingStatus?: PlaceStatus
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCloseRef.current()
      }
    }

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus()
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)

    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }

    let nextIndex: number | undefined
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = items.length - 1
    }

    const nextItem = nextIndex !== undefined ? items[nextIndex] : undefined
    if (nextItem) {
      event.preventDefault()
      nextItem.focus()
    }
  }

  // Keep the menu inside the viewport when triggered near screen edges.
  const menuSize = { width: 224, height: 216 }
  const style = {
    left: payload.pixel
      ? `${Math.max(8, Math.min(payload.pixel.x, window.innerWidth - menuSize.width))}px`
      : '50%',
    top: payload.pixel
      ? `${Math.max(8, Math.min(payload.pixel.y, window.innerHeight - menuSize.height))}px`
      : '50%',
  } as React.CSSProperties

  const isSaving = savingStatus !== undefined
  return (
    <div
      aria-label="地图标记操作"
      className="map-context-menu"
      ref={menuRef}
      role="menu"
      style={style}
      onKeyDown={handleKeyDown}
    >
      <div>
        <span>地图标记</span>
        <strong>
          {payload.location.lng.toFixed(5)}, {payload.location.lat.toFixed(5)}
        </strong>
      </div>
      <button
        type="button"
        role="menuitem"
        disabled={isSaving}
        onClick={() => onSave('visited')}
      >
        {savingStatus === 'visited' ? '保存中…' : '标记为已探店'}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={isSaving}
        onClick={() => onSave('wishlist')}
      >
        {savingStatus === 'wishlist' ? '保存中…' : '标记为想去'}
      </button>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button className="quiet-menu-action" type="button" role="menuitem" onClick={onClose}>
        取消
      </button>
    </div>
  )
}
