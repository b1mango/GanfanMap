import { useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { Category, Tag } from '../../../entities/place/types'
import { taxonomyService } from '../taxonomyService'
import { getErrorMessage } from '../../../shared/errors'
import { useConfirmDialog } from '../../../shared/useConfirmDialog'

type TaxonomyEditDraft = {
  color: string
  name: string
}

export function CategoryManager({
  activeCategoryId,
  categories,
  onCreatedCategory,
  title = '整理类型',
  onDeletedActiveCategory,
}: {
  activeCategoryId?: string
  categories: Category[]
  onCreatedCategory?: (categoryId: string) => void
  title?: string
  onDeletedActiveCategory: (fallbackCategoryId: string) => void
}) {
  const { confirm, dialog } = useConfirmDialog()

  return (
    <>
      <TaxonomyManager
        createAriaLabel="新增类型"
        createInputLabel="新增类型名称"
        createLabel="新增类型"
        emptyColor="#bb3e2f"
        itemKind="类型"
        items={categories.map((category) => ({
          id: category.id,
          name: category.name,
          color: category.color,
        }))}
        minItems={1}
        title={title}
        onCreate={async (draft) => {
          const category = await taxonomyService.createCategory(draft)
          onCreatedCategory?.(category.id)
          return '已新增类型'
        }}
        onDelete={async (item) => {
          const confirmed = await confirm({
            title: '删除类型',
            description: `删除类型“${item.name}”后，该类型下的店铺会迁移到其他类型。`,
            confirmLabel: '删除类型',
            danger: true,
          })
          if (!confirmed) {
            return undefined
          }
          const fallbackCategoryId = await taxonomyService.deleteCategory(item.id)
          if (activeCategoryId === item.id) {
            onDeletedActiveCategory(fallbackCategoryId)
          }
          return '已删除类型'
        }}
        onUpdate={async (item, draft) => {
          await taxonomyService.updateCategory(item.id, draft)
          return '已保存类型'
        }}
      />
      {dialog}
    </>
  )
}

export function TagManager({
  activeTagIds,
  onCreatedTag,
  onDeletedActiveTag,
  tags,
  title = '整理标签',
}: {
  activeTagIds: string[]
  onCreatedTag?: (tagId: string) => void
  onDeletedActiveTag: (tagId: string) => void
  tags: Tag[]
  title?: string
}) {
  const { confirm, dialog } = useConfirmDialog()

  return (
    <>
      <TaxonomyManager
        createAriaLabel="新增标签"
        createInputLabel="新增标签名称"
        createLabel="新增标签"
        emptyColor="#485f3f"
        itemKind="标签"
        items={tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        }))}
        title={title}
        onCreate={async (draft) => {
          const tag = await taxonomyService.createTag(draft)
          onCreatedTag?.(tag.id)
          return '已新增标签'
        }}
        onDelete={async (item) => {
          const confirmed = await confirm({
            title: '删除标签',
            description: `删除标签“${item.name}”后，已有店铺会移除这个标签。`,
            confirmLabel: '删除标签',
            danger: true,
          })
          if (!confirmed) {
            return undefined
          }
          await taxonomyService.deleteTag(item.id)
          if (activeTagIds.includes(item.id)) {
            onDeletedActiveTag(item.id)
          }
          return '已删除标签'
        }}
        onUpdate={async (item, draft) => {
          await taxonomyService.updateTag(item.id, draft)
          return '已保存标签'
        }}
      />
      {dialog}
    </>
  )
}

type TaxonomyItem = {
  id: string
  name: string
  color: string
}

function TaxonomyManager({
  createAriaLabel,
  createInputLabel,
  createLabel,
  emptyColor,
  itemKind,
  items,
  minItems = 0,
  onCreate,
  onDelete,
  onUpdate,
  title,
}: {
  createAriaLabel: string
  createInputLabel: string
  createLabel: string
  emptyColor: string
  itemKind: string
  items: TaxonomyItem[]
  minItems?: number
  onCreate: (draft: TaxonomyEditDraft) => Promise<string>
  onDelete: (item: TaxonomyItem) => Promise<string | undefined>
  onUpdate: (item: TaxonomyItem, draft: TaxonomyEditDraft) => Promise<string>
  title: string
}) {
  const [drafts, setDrafts] = useState<Record<string, TaxonomyEditDraft>>({})
  const [newDraft, setNewDraft] = useState<TaxonomyEditDraft>({
    color: emptyColor,
    name: '',
  })
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timer)
  }, [message])

  async function handleCreate(): Promise<void> {
    setMessage('')
    try {
      const nextMessage = await onCreate(newDraft)
      setNewDraft({ color: emptyColor, name: '' })
      setMessage(nextMessage)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  async function handleUpdate(item: TaxonomyItem): Promise<void> {
    setMessage('')
    const draft = drafts[item.id] ?? { color: item.color, name: item.name }
    try {
      const nextMessage = await onUpdate(item, draft)
      setDrafts((currentDrafts) => {
        const remainingDrafts = { ...currentDrafts }
        delete remainingDrafts[item.id]
        return remainingDrafts
      })
      setMessage(nextMessage)
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  async function handleDelete(item: TaxonomyItem): Promise<void> {
    setMessage('')
    try {
      const nextMessage = await onDelete(item)
      if (nextMessage) {
        setMessage(nextMessage)
      }
    } catch (error) {
      setMessage(getErrorMessage(error))
    }
  }

  return (
    <div className="taxonomy-manager">
      <div className="taxonomy-heading">
        <div>
          <span>{title}</span>
          <small>新增、改名、换色或删除</small>
        </div>
      </div>
      <div className="taxonomy-list">
        {items.map((item) => {
          const draft = drafts[item.id] ?? { color: item.color, name: item.name }
          return (
            <div className="taxonomy-row" key={item.id}>
              <input
                aria-label={`${itemKind}名称 ${item.name}`}
                value={draft.name}
                onChange={(event) =>
                  setDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [item.id]: { ...draft, name: event.target.value },
                  }))
                }
              />
              <input
                aria-label={`${itemKind}颜色 ${item.name}`}
                className="taxonomy-color"
                type="color"
                value={draft.color}
                onChange={(event) =>
                  setDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [item.id]: { ...draft, color: event.target.value },
                  }))
                }
              />
              <div className="taxonomy-actions">
                <button
                  aria-label={`保存${itemKind} ${item.name}`}
                  className="icon-button taxonomy-icon"
                  type="button"
                  onClick={() => void handleUpdate(item)}
                >
                  <Check aria-hidden="true" size={15} />
                </button>
                <button
                  aria-label={`删除${itemKind} ${item.name}`}
                  className="icon-button taxonomy-icon danger-inline"
                  disabled={items.length <= minItems}
                  type="button"
                  onClick={() => void handleDelete(item)}
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="taxonomy-row taxonomy-add-row">
        <input
          aria-label={createInputLabel}
          placeholder={createLabel}
          value={newDraft.name}
          onChange={(event) => setNewDraft((draft) => ({ ...draft, name: event.target.value }))}
        />
        <input
          aria-label={`${createLabel}颜色`}
          className="taxonomy-color"
          type="color"
          value={newDraft.color}
          onChange={(event) => setNewDraft((draft) => ({ ...draft, color: event.target.value }))}
        />
        <button
          aria-label={createAriaLabel}
          className="icon-button taxonomy-icon"
          type="button"
          onClick={() => void handleCreate()}
        >
          <Plus aria-hidden="true" size={15} />
        </button>
      </div>
      <p aria-live="polite" className="taxonomy-message">
        {message}
      </p>
    </div>
  )
}
