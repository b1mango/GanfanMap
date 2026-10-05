import { useEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Pencil, Trash2, X } from 'lucide-react'
import { createDefaultScores } from '../../../entities/place/rating'
import type {
  Category,
  FoodPhoto,
  Place,
  PlaceScores,
  Tag,
  Visit,
} from '../../../entities/place/types'
import { SCORE_DIMENSIONS } from '../../../shared/constants'
import { db } from '../../../shared/db/database'
import { getErrorMessage } from '../../../shared/errors'
import { getNumber, getString } from '../../../shared/formData'
import { formatCurrency, formatDate, formatLocalDateInputValue } from '../../../shared/format'
import { formatScore } from '../../../shared/format'
import { trapPanelFocus } from '../../../shared/focusTrap'
import { useConfirmDialog } from '../../../shared/useConfirmDialog'
import {
  addVisitDraft,
  deletePhoto,
  deletePlace,
  deleteVisit,
  markPlaceVisited,
  updateVisit,
} from '../placeService'
import { EditPlaceDialog } from './PlaceEditorDialog'

const emptyPhotos: FoodPhoto[] = []

export function DetailsPanel({
  categories,
  onClose,
  onPlaceSaved,
  place,
  tags,
  visits,
}: {
  categories: Category[]
  onClose: () => void
  onPlaceSaved: (placeId: string, savedPlace: Place) => void
  place: Place
  tags: Tag[]
  visits: Visit[]
}) {
  const panelRef = useRef<HTMLElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  // Photos load on demand for the open place instead of hydrating the whole
  // photo table (blobs included) into App state.
  const placeId = place.id
  const photos = useLiveQuery(
    () => (placeId ? db.photos.where('placeId').equals(placeId).toArray() : []),
    [placeId],
  )

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) {
      return
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
    panel.querySelector<HTMLElement>('[aria-label="关闭详情面板"]')?.focus()

    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [])

  const category = categories.find((item) => item.id === place.categoryId)
  const placeTags = tags.filter((tag) => place.tagIds.includes(tag.id))

  return (
    <aside
      aria-label="店铺详情"
      className="details-panel"
      ref={panelRef}
      onKeyDown={(event) => trapPanelFocus(event, panelRef.current)}
    >
      <div className="details-top-actions">
        <EditPlaceDialog
          categories={categories}
          place={place}
          tags={tags}
          onPlaceSaved={onPlaceSaved}
        />
        <button className="icon-button drawer-close" type="button" aria-label="关闭详情面板" onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="details-hero">
        <div>
          <span className="status-pill">{place.status === 'visited' ? '已探店' : '想去'}</span>
          <h2>{place.name}</h2>
          <p>{place.address}</p>
        </div>
        <div className="score-plate">
          <strong data-wide={place.overallScore === undefined ? '' : undefined}>{formatScore(place.overallScore)}</strong>
          <span>综合分</span>
        </div>
      </div>

      {place.photoUrls && place.photoUrls.length > 0 ? (
        <PlacePhotoStrip key={place.id} urls={place.photoUrls} />
      ) : null}

      <div className="meta-grid">
        <div>
          <span>类型</span>
          <strong>{category?.name ?? '未分类'}</strong>
        </div>
        <div>
          <span>人均</span>
          <strong>{formatCurrency(place.averagePrice)}</strong>
        </div>
        <div>
          <span>消费次数</span>
          <strong>{visits.length}</strong>
        </div>
      </div>

      <div className="tag-row">
        {placeTags.map((tag) => (
          <span key={tag.id}>{tag.name}</span>
        ))}
      </div>

      {place.scores ? <ScoreBoard scores={place.scores} /> : <p className="quiet-note">这家店还在待探清单，暂未评分。</p>}

      <section className="notes-block">
        <h3>笔记</h3>
        <p>{place.notes || '还没有写下具体印象。'}</p>
      </section>

      <VisitForm key={place.id} place={place} />
      <VisitTimeline photos={photos ?? emptyPhotos} visits={visits} />

      <section className="place-management" aria-label="店铺管理">
        <div>
          <h3>店铺管理</h3>
          <p>删除会同时移除这家店的消费记录和照片。</p>
        </div>
        {deleteError ? (
          <p className="form-note form-error" role="alert">
            {deleteError}
          </p>
        ) : null}
        <button
          className="danger-button"
          type="button"
          disabled={isDeleting}
          onClick={async () => {
            if (isDeleting) {
              return
            }

            const confirmed = await confirm({
              title: '删除店铺',
              description: '删除会同时移除这家店的消费记录和照片，且不可撤销。',
              confirmLabel: '删除店铺',
              danger: true,
            })
            if (!confirmed) {
              return
            }

            setDeleteError('')
            setIsDeleting(true)
            try {
              await deletePlace(place.id)
              onClose()
            } catch (error) {
              setDeleteError(getErrorMessage(error))
            } finally {
              setIsDeleting(false)
            }
          }}
        >
          <Trash2 aria-hidden="true" size={16} />
          {isDeleting ? '删除中…' : '删除店铺'}
        </button>
      </section>
      {confirmDialog}
    </aside>
  )
}

function ScoreBoard({ scores }: { scores: PlaceScores }) {
  return (
    <section className="score-board" aria-label="分项评分">
      {[
        ['口味', scores.taste],
        ['环境', scores.environment],
        ['服务', scores.service],
        ['性价比', scores.value],
      ].map(([label, score]) => {
        const value = Number(score)
        return (
          <div key={label}>
            <span>{label}</span>
            <div
              aria-label={`${label} ${value} 分`}
              aria-valuemax={10}
              aria-valuemin={1}
              aria-valuenow={value}
              className="score-bar"
              role="progressbar"
            >
              <span className="score-bar-fill" style={{ width: `${(value / 10) * 100}%` }} />
            </div>
            <strong>{score}</strong>
          </div>
        )
      })}
    </section>
  )
}

function VisitForm({ place }: { place: Place }) {
  const [fileCount, setFileCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [conversionVisible, setConversionVisible] = useState(false)

  async function submitVisit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSaving) {
      return
    }

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const files = form.getAll('photos').filter((item): item is File => item instanceof File && item.size > 0)
    setSubmitError('')
    setIsSaving(true)

    try {
      await addVisitDraft({
        placeId: place.id,
        date: getString(form, 'date') || formatLocalDateInputValue(),
        items: getString(form, 'items'),
        amount: getNumber(form, 'amount', 0),
        notes: getString(form, 'notes'),
        photos: files,
      })

      setFileCount(0)
      formElement.reset()
      setSuccessMessage('消费记录已保存')
      setTimeout(() => setSuccessMessage(''), 3000)
      if (place.status === 'wishlist') {
        setConversionVisible(true)
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error, '消费记录保存失败，请稍后重试。'))
    } finally {
      setIsSaving(false)
    }
  }

  if (conversionVisible && place.status === 'wishlist') {
    return (
      <WishlistConversionCard
        placeId={place.id}
        onDismiss={() => setConversionVisible(false)}
      />
    )
  }

  return (
    <form className="visit-form" onSubmit={(event) => void submitVisit(event)}>
      <h3>记录一次消费</h3>
      <div className="form-grid">
        <label>
          日期
          <input name="date" type="date" defaultValue={formatLocalDateInputValue()} />
        </label>
        <label>
          金额
          <input name="amount" type="number" min={0} inputMode="numeric" required placeholder="例如：128…" />
        </label>
      </div>
      <label>
        吃了什么
        <input name="items" autoComplete="off" placeholder="菜品、饮品、套餐…" />
      </label>
      <label>
        备注
        <textarea name="notes" placeholder="这次体验的细节…" />
      </label>
      <label className="photo-input">
        <ImagePlus aria-hidden="true" size={18} />
        <span>{fileCount > 0 ? `已选择 ${fileCount} 张照片` : '添加照片'}</span>
        <input
          name="photos"
          type="file"
          accept="image/*"
          multiple
          disabled={isSaving}
          onChange={(event) => setFileCount(event.currentTarget.files?.length ?? 0)}
        />
      </label>
      {submitError ? (
        <p className="form-note form-error" role="alert">
          {submitError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="form-note form-success" role="status" aria-live="polite">
          {successMessage}
        </p>
      ) : null}
      <button className="primary-button full" type="submit" disabled={isSaving}>
        {isSaving ? '保存中' : '保存消费记录'}
      </button>
    </form>
  )
}

function WishlistConversionCard({
  onDismiss,
  placeId,
}: {
  onDismiss: () => void
  placeId: string
}) {
  const [scores, setScores] = useState<PlaceScores>(createDefaultScores)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  async function handleConvert(): Promise<void> {
    if (isSaving) {
      return
    }

    setSubmitError('')
    setIsSaving(true)
    try {
      await markPlaceVisited(placeId, scores)
      // The live query flips place.status, which removes this card.
    } catch (error) {
      setSubmitError(getErrorMessage(error))
      setIsSaving(false)
    }
  }

  return (
    <section className="conversion-card" aria-label="标记为已探店">
      <div>
        <h3>第一次打卡完成</h3>
        <p>这家店还在「想去」清单，补上评分就能移入已探店。</p>
      </div>
      <div className="score-input-grid">
        {SCORE_DIMENSIONS.map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              type="number"
              min={1}
              max={10}
              value={scores[name]}
              onChange={(event) =>
                setScores((currentScores) => ({
                  ...currentScores,
                  [name]: Number(event.target.value),
                }))
              }
            />
          </label>
        ))}
      </div>
      {submitError ? (
        <p className="form-note form-error" role="alert">
          {submitError}
        </p>
      ) : null}
      <div className="dialog-actions">
        <button className="ghost-button" type="button" disabled={isSaving} onClick={onDismiss}>
          暂不
        </button>
        <button className="primary-button" type="button" disabled={isSaving} onClick={() => void handleConvert()}>
          {isSaving ? '保存中' : '标记为已探店'}
        </button>
      </div>
    </section>
  )
}

function VisitTimeline({ photos, visits }: { photos: FoodPhoto[]; visits: Visit[] }) {
  const photosByVisitId = useMemo(() => {
    const groupedPhotos = new Map<string, FoodPhoto[]>()

    for (const photo of photos) {
      if (!photo.visitId) {
        continue
      }

      const visitPhotos = groupedPhotos.get(photo.visitId)
      if (visitPhotos) {
        visitPhotos.push(photo)
        continue
      }

      groupedPhotos.set(photo.visitId, [photo])
    }

    return groupedPhotos
  }, [photos])

  return (
    <section className="timeline">
      <h3>消费记录</h3>
      {visits.length === 0 ? <p className="quiet-note">还没有消费记录。</p> : null}
      {visits.map((visit) => (
        <VisitCard key={visit.id} photos={photosByVisitId.get(visit.id) ?? emptyPhotos} visit={visit} />
      ))}
    </section>
  )
}

function VisitCard({ photos, visit }: { photos: FoodPhoto[]; visit: Visit }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const { confirm, dialog: confirmDialog } = useConfirmDialog()

  async function handleDelete(): Promise<void> {
    if (isDeleting) {
      return
    }

    const confirmed = await confirm({
      title: '删除消费记录',
      description: '删除这条消费记录会同时移除它的照片，并重新计算人均。',
      confirmLabel: '删除记录',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    setActionError('')
    setIsDeleting(true)
    try {
      await deleteVisit(visit.id)
      // The card unmounts via the live query once the record is gone.
    } catch (error) {
      setActionError(getErrorMessage(error))
      setIsDeleting(false)
    }
  }

  if (isEditing) {
    return (
      <VisitEditForm
        visit={visit}
        onCancel={() => setIsEditing(false)}
        onSaved={() => setIsEditing(false)}
      />
    )
  }

  return (
    <article className="visit-card">
      <div>
        <time dateTime={visit.date}>{formatDate(visit.date)}</time>
        <div className="visit-card-tools">
          <strong>{formatCurrency(visit.amount)}</strong>
          <button
            aria-label="编辑这条消费记录"
            className="icon-button"
            type="button"
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" size={13} />
          </button>
          <button
            aria-label="删除这条消费记录"
            className="icon-button"
            type="button"
            disabled={isDeleting}
            onClick={() => void handleDelete()}
          >
            <Trash2 aria-hidden="true" size={13} />
          </button>
        </div>
      </div>
      <p>{visit.items || '未填写菜品'}</p>
      {visit.notes ? <span>{visit.notes}</span> : null}
      {actionError ? (
        <p className="form-note form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <PhotoRow photos={photos} />
      {confirmDialog}
    </article>
  )
}

function VisitEditForm({
  onCancel,
  onSaved,
  visit,
}: {
  onCancel: () => void
  onSaved: () => void
  visit: Visit
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  async function submitEdit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSaving) {
      return
    }

    const form = new FormData(event.currentTarget)
    setSubmitError('')
    setIsSaving(true)

    try {
      await updateVisit(visit.id, {
        date: getString(form, 'date') || visit.date,
        items: getString(form, 'items'),
        amount: getNumber(form, 'amount', 0),
        notes: getString(form, 'notes'),
      })
      onSaved()
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="visit-card visit-edit-form" onSubmit={(event) => void submitEdit(event)}>
      <div className="form-grid">
        <label>
          日期
          <input name="date" type="date" defaultValue={visit.date} required />
        </label>
        <label>
          金额
          <input name="amount" type="number" min={0} inputMode="numeric" defaultValue={visit.amount} required />
        </label>
      </div>
      <label>
        吃了什么
        <input name="items" autoComplete="off" defaultValue={visit.items} />
      </label>
      <label>
        备注
        <textarea name="notes" defaultValue={visit.notes} />
      </label>
      {submitError ? (
        <p className="form-note form-error" role="alert">
          {submitError}
        </p>
      ) : null}
      <div className="dialog-actions">
        <button className="ghost-button" type="button" disabled={isSaving} onClick={onCancel}>
          取消
        </button>
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? '保存中' : '保存修改'}
        </button>
      </div>
    </form>
  )
}

function PhotoRow({ photos }: { photos: FoodPhoto[] }) {
  const [selected, setSelected] = useState<{ id: string; url: string } | undefined>(undefined)
  const [deleteError, setDeleteError] = useState('')
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const urls = useMemo(
    () => photos.map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.blob) })),
    [photos],
  )

  useEffect(() => {
    return () => {
      for (const photo of urls) {
        URL.revokeObjectURL(photo.url)
      }
    }
  }, [urls])

  if (urls.length === 0) {
    return null
  }

  async function handleDelete(photo: { id: string; url: string }): Promise<void> {
    const confirmed = await confirm({
      title: '删除这张照片？',
      description: '照片删除后不可恢复。',
      confirmLabel: '删除照片',
      danger: true,
    })
    if (!confirmed) {
      return
    }

    try {
      await deletePhoto(photo.id)
      setDeleteError('')
      setSelected(undefined)
    } catch (error) {
      setDeleteError(getErrorMessage(error))
    }
  }

  return (
    <>
      <div className="photo-row">
        {urls.map((photo) => (
          <button
            className="photo-thumb-button"
            key={photo.id}
            type="button"
            onClick={() => {
              setDeleteError('')
              setSelected(photo)
            }}
          >
            <img alt="消费记录照片" src={photo.url} width={88} height={66} loading="lazy" />
          </button>
        ))}
      </div>
      <PhotoLightbox
        url={selected?.url}
        onClose={() => setSelected(undefined)}
        onDelete={selected ? () => void handleDelete(selected) : undefined}
      />
      {deleteError ? (
        <p className="form-note form-error" role="alert">
          {deleteError}
        </p>
      ) : null}
      {confirmDialog}
    </>
  )
}

function PlacePhotoStrip({ urls }: { urls: string[] }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | undefined>(undefined)
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(new Set())
  const visibleUrls = urls.filter((url) => !failedUrls.has(url))

  if (visibleUrls.length === 0) {
    return null
  }

  return (
    <section className="place-photo-strip" aria-label="店铺照片">
      {visibleUrls.map((url) => (
        <button
          className="photo-thumb-button"
          key={url}
          type="button"
          onClick={() => setLightboxUrl(url)}
        >
          <img
            alt="店铺照片"
            src={url}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedUrls((current) => new Set(current).add(url))}
          />
        </button>
      ))}
      <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(undefined)} />
    </section>
  )
}

function PhotoLightbox({
  onClose,
  onDelete,
  url,
}: {
  onClose: () => void
  onDelete?: () => void
  url: string | undefined
}) {
  if (!url) {
    return null
  }

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay lightbox-overlay" />
        <Dialog.Content className="lightbox-content" aria-label="照片预览">
          <img alt="照片预览" src={url} className="lightbox-image" referrerPolicy="no-referrer" />
          <div className="lightbox-tools">
            {onDelete ? (
              <button
                className="icon-button lightbox-delete"
                type="button"
                aria-label="删除这张照片"
                onClick={onDelete}
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
            ) : null}
            <Dialog.Close asChild>
              <button className="icon-button lightbox-close" type="button" aria-label="关闭照片预览">
                <X aria-hidden="true" size={22} />
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

