import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Pencil, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import type {
  Category,
  LocationPoint,
  PlaceStatus,
  Place,
  PlaceScores,
  Tag,
} from '../../../entities/place/types'
import { DEFAULT_CATEGORY_ID, SCORE_DIMENSIONS } from '../../../shared/constants'
import { getErrorMessage } from '../../../shared/errors'
import {
  getNumber,
  getOptionalNumber,
  getString,
  setFormControlValue,
} from '../../../shared/formData'
import { shanghaiCenter, type PoiCandidate } from '../../map/mapAdapter'
import { usePoiSearch } from '../../map/usePoiSearch'
import { savePlaceDraft, updatePlaceDraft } from '../placeService'
import type { PlaceDraft } from '../placeService'
import { taxonomyService } from '../taxonomyService'
import { CategoryManager, TagManager } from './TaxonomyManager'

export function AddPlaceDialog({
  categories,
  onPlaceSaved,
  tags,
}: {
  categories: Category[]
  onPlaceSaved: (placeId: string, savedPlace: Place) => void
  tags: Tag[]
}) {
  return (
    <PlaceEditorDialog
      categories={categories}
      mode="create"
      tags={tags}
      trigger={
        <button className="primary-button add-place-icon-button" type="button" aria-label="新增店铺">
          <Plus aria-hidden="true" size={18} />
        </button>
      }
      onPlaceSaved={onPlaceSaved}
    />
  )
}

export function EditPlaceDialog({
  categories,
  onPlaceSaved,
  place,
  tags,
  trigger,
}: {
  categories: Category[]
  onPlaceSaved: (placeId: string, savedPlace: Place) => void
  place: Place
  tags: Tag[]
  trigger?: React.ReactElement
}) {
  return (
    <PlaceEditorDialog
      categories={categories}
      mode="edit"
      place={place}
      tags={tags}
      trigger={trigger ?? (
        <button className="ghost-button details-edit-button" type="button">
          <Pencil aria-hidden="true" size={15} />
          编辑店铺
        </button>
      )}
      onPlaceSaved={onPlaceSaved}
    />
  )
}

function InlineTagCreator({ onTagCreated }: { onTagCreated: (tagId: string) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setMessage('')
    try {
      const tag = await taxonomyService.createTag({ name: trimmed, color: '#485f3f' })
      onTagCreated(tag.id)
      setName('')
      setMessage('已新增并选中标签')
    } catch (error) {
      setMessage(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-tag-creator">
      <input
        placeholder="新增标签…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            void handleCreate()
          }
        }}
        aria-label="新标签名称"
      />
      <button type="button" aria-label="快速新增标签" disabled={busy || name.trim().length === 0} onClick={() => void handleCreate()}>+</button>
      {message ? (
        <span className="form-note" role="status" aria-live="polite">
          {message}
        </span>
      ) : null}
    </div>
  )
}

export function PlaceEditorDialog({
  categories,
  mode,
  onPlaceSaved,
  place,
  tags,
  trigger,
}: {
  categories: Category[]
  mode: 'create' | 'edit'
  onPlaceSaved: (placeId: string, savedPlace: Place) => void
  place?: Place
  tags: Tag[]
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [formStatus, setFormStatus] = useState<PlaceStatus>(place?.status ?? 'visited')
  // Coordinates live in state: hidden inputs reflect their value attribute directly,
  // so React re-pins any DOM-written value back on every commit.
  const [draftLocation, setDraftLocation] = useState<LocationPoint>(
    place?.location ?? shanghaiCenter,
  )
  const [draftPhotoUrls, setDraftPhotoUrls] = useState<string[] | undefined>(place?.photoUrls)
  const formRef = useRef<HTMLFormElement>(null)
  const {
    amapEnabled,
    candidates: poiCandidates,
    changeQuery: changePoiQuery,
    query: poiQuery,
    reset: resetPoiSearch,
    search: searchPoi,
    status: poiStatus,
  } = usePoiSearch()
  const [poiApplied, setPoiApplied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState(place?.categoryId ?? categories[0]?.id ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(place?.tagIds ?? [])
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)

  function handlePoiQueryChange(query: string): void {
    setPoiApplied(false)
    changePoiQuery(query)
  }

  function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) {
      setFormStatus(place?.status ?? 'visited')
      setDraftLocation(place?.location ?? shanghaiCenter)
      setDraftPhotoUrls(place?.photoUrls)
      setSelectedCategoryId(place?.categoryId ?? categories[0]?.id ?? '')
      setSelectedTagIds(place?.tagIds ?? [])
      setShowCategoryManager(false)
      setShowTagManager(false)
      setSubmitError('')
    } else {
      resetPoiSearch()
      setPoiApplied(false)
      setSubmitError('')
      setShowCategoryManager(false)
      setShowTagManager(false)
    }

    setOpen(nextOpen)
  }

  function toggleSelectedTag(tagId: string, checked: boolean): void {
    setSelectedTagIds((currentTagIds) =>
      checked
        ? Array.from(new Set([...currentTagIds, tagId]))
        : currentTagIds.filter((currentTagId) => currentTagId !== tagId),
    )
  }
  function applyPoiCandidate(candidate: PoiCandidate): void {
    if (!formRef.current) {
      return
    }

    setFormControlValue(formRef.current, 'name', candidate.name)
    setFormControlValue(formRef.current, 'address', candidate.address)
    setDraftLocation(candidate.location)
    // Adopt the picked POI's photos; a POI without photos clears stale ones.
    setDraftPhotoUrls(candidate.photos ?? [])
    changePoiQuery(candidate.name)
    setPoiApplied(true)
  }

  async function submitPlace(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSaving) {
      return
    }

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const draft = createPlaceDraftFromForm(form, categories, draftLocation)
    draft.photoUrls = draftPhotoUrls
    setSubmitError('')
    setIsSaving(true)

    try {
      const savedPlace =
        mode === 'edit' && place
          ? await updatePlaceDraft(place.id, draft)
          : await savePlaceDraft(draft)

      onPlaceSaved(savedPlace.id, savedPlace)
      setOpen(false)
      if (mode === 'create') {
        formElement.reset()
      }
      resetPoiSearch()
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const effectiveSelectedCategoryId = categories.some((category) => category.id === selectedCategoryId)
    ? selectedCategoryId
    : categories[0]?.id ?? ''
  const existingTagIds = new Set(tags.map((tag) => tag.id))
  const effectiveSelectedTagIds = selectedTagIds.filter((tagId) => existingTagIds.has(tagId))
  const dialogTitle = mode === 'edit' ? '编辑店铺' : '新增店铺'
  const submitLabel = mode === 'edit' ? '保存修改' : '保存店铺'

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <Dialog.Title>{dialogTitle}</Dialog.Title>
          <form
            className="editor-form"
            key={place?.id ?? 'new-place'}
            ref={formRef}
            onSubmit={(event) => void submitPlace(event)}
          >
            <section className="poi-search-panel" aria-label="高德搜索选点">
              <div className="poi-search-row">
                <input
                  aria-label="地点关键词"
                  autoComplete="off"
                  disabled={!amapEnabled}
                  placeholder={amapEnabled ? '搜索地点、店名、商圈…' : '配置 Key 后启用'}
                  value={poiQuery}
                  onChange={(event) => handlePoiQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void searchPoi()
                    }
                  }}
                />
                <button
                  className="ghost-button poi-search-button"
                  type="button"
                  disabled={!amapEnabled || poiStatus === 'searching' || !poiQuery.trim()}
                  onClick={() => void searchPoi()}
                >
                  <Search aria-hidden="true" size={16} />
                  {poiStatus === 'searching' ? '搜索中' : '搜索'}
                </button>
              </div>
              {poiStatus === 'empty' ? <p className="form-note">没有找到匹配地点。</p> : null}
              {poiStatus === 'error' ? (
                <p className="form-note">搜索不可用，请手动填写。</p>
              ) : null}
              {poiApplied ? (
                <p className="form-note">已回填，可继续补充。</p>
              ) : null}
              {poiCandidates.length > 0 ? (
                <div className="poi-candidate-list">
                  {poiCandidates.map((candidate, index) => (
                    <button
                      key={`${candidate.name}-${candidate.location.lng}-${index}`}
                      type="button"
                      onClick={() => applyPoiCandidate(candidate)}
                    >
                      <strong>{candidate.name}</strong>
                      <span>{candidate.address || '未返回详细地址'}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
            <label>
              店名
              <input
                name="name"
                required
                autoComplete="off"
                defaultValue={place?.name ?? ''}
                placeholder="例如：荔枝巷茶室…"
              />
            </label>
            <label>
              地址
              <input
                name="address"
                autoComplete="off"
                defaultValue={place?.address ?? ''}
                placeholder="例如：上海市静安区…"
              />
            </label>
            <div className="form-grid">
              <label>
                状态
                <select name="status" value={formStatus} onChange={(e) => setFormStatus(e.target.value as PlaceStatus)}>
                  <option value="visited">已探店</option>
                  <option value="wishlist">想去</option>
                </select>
              </label>
              <label>
                人均
                <input
                  name="averagePrice"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  defaultValue={place?.averagePrice ?? ''}
                  placeholder="例如：120…"
                />
              </label>
            </div>
            <fieldset className="tag-fieldset">
              <div className="fieldset-heading-row">
                <legend>主类型</legend>
                <button
                  aria-label="整理类型"
                  aria-expanded={showCategoryManager}
                  className="taxonomy-organize-button"
                  type="button"
                  onClick={() => setShowCategoryManager((isVisible) => !isVisible)}
                >
                  <SlidersHorizontal aria-hidden="true" size={14} />
                  <span>整理</span>
                </button>
              </div>
              <select
                aria-label="主类型"
                name="categoryId"
                value={effectiveSelectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {showCategoryManager ? (
                <CategoryManager
                  activeCategoryId={effectiveSelectedCategoryId}
                  categories={categories}
                  onCreatedCategory={(categoryId) => setSelectedCategoryId(categoryId)}
                  onDeletedActiveCategory={(fallbackCategoryId) => setSelectedCategoryId(fallbackCategoryId)}
                />
              ) : null}
            </fieldset>
            <fieldset className="tag-fieldset">
              <div className="fieldset-heading-row">
                <legend>标签</legend>
                <button
                  aria-label="整理标签"
                  aria-expanded={showTagManager}
                  className="taxonomy-organize-button"
                  type="button"
                  onClick={() => setShowTagManager((isVisible) => !isVisible)}
                >
                  <SlidersHorizontal aria-hidden="true" size={14} />
                  <span>整理</span>
                </button>
              </div>
              {tags.length === 0 ? (
                <p className="form-note">暂无标签，可在下方新增。</p>
              ) : (
                tags.map((tag) => (
                  <label key={tag.id}>
                    <input
                      name="tagIds"
                      type="checkbox"
                      value={tag.id}
                      checked={effectiveSelectedTagIds.includes(tag.id)}
                      onChange={(event) => toggleSelectedTag(tag.id, event.target.checked)}
                    />
                    <span className="tag-chip" style={{ '--tag-color': tag.color } as React.CSSProperties}>{tag.name}</span>
                  </label>
                ))
              )}
              <InlineTagCreator onTagCreated={(tagId) => toggleSelectedTag(tagId, true)} />
              {showTagManager ? (
                <TagManager
                  activeTagIds={effectiveSelectedTagIds}
                  tags={tags}
                  title="整理标签"
                  onCreatedTag={(tagId) => toggleSelectedTag(tagId, true)}
                  onDeletedActiveTag={(tagId) => toggleSelectedTag(tagId, false)}
                />
              ) : null}
            </fieldset>
            {formStatus === 'visited' ? (
              <div className="score-input-grid" aria-label="分项评分">
                {SCORE_DIMENSIONS.map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={place?.scores?.[name as keyof PlaceScores] ?? 8}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <label>
              笔记
              <textarea
                name="notes"
                defaultValue={place?.notes ?? ''}
                placeholder="记录必点菜、排队情况、复吃理由…"
              />
            </label>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button className="ghost-button" type="button" disabled={isSaving}>取消</button>
              </Dialog.Close>
              <button className="primary-button" type="submit" disabled={isSaving}>
                {isSaving ? '保存中' : submitLabel}
              </button>
            </div>
            {submitError ? (
              <p className="form-note form-error" role="alert">
                {submitError}
              </p>
            ) : null}
          </form>
          <Dialog.Close asChild>
            <button className="icon-button dialog-close" type="button" aria-label={`关闭${dialogTitle}弹窗`}>
              <X aria-hidden="true" size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function createPlaceDraftFromForm(
  form: FormData,
  categories: Category[],
  location: LocationPoint,
): PlaceDraft {
  const status: PlaceStatus = getString(form, 'status') === 'wishlist' ? 'wishlist' : 'visited'
  const scores =
    status === 'visited'
      ? {
          taste: getNumber(form, 'taste', 8),
          environment: getNumber(form, 'environment', 8),
          service: getNumber(form, 'service', 8),
          value: getNumber(form, 'value', 8),
        }
      : undefined

  return {
    name: getString(form, 'name'),
    status,
    categoryId: getString(form, 'categoryId') || categories[0]?.id || DEFAULT_CATEGORY_ID,
    tagIds: form.getAll('tagIds').map(String),
    address: getString(form, 'address') || '上海',
    lng: location.lng,
    lat: location.lat,
    averagePrice: getOptionalNumber(form, 'averagePrice'),
    scores,
    notes: getString(form, 'notes'),
  }
}
