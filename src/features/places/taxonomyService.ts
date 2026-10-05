import { z } from 'zod'
import type { Category, CategoryId, Tag, TagId } from '../../entities/place/types'
import { db, type FoodMapDatabase } from '../../shared/db/database'
import { createId } from '../../shared/id'

const taxonomyDraftSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(24, '名称最多 24 个字符'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色必须是 #RRGGBB 格式'),
})

export type TaxonomyDraft = z.input<typeof taxonomyDraftSchema>

type TaxonomyRecord = Category | Tag

export function createTaxonomyService(database: FoodMapDatabase = db) {
  async function normalizeDraft(draft: TaxonomyDraft): Promise<z.output<typeof taxonomyDraftSchema>> {
    return taxonomyDraftSchema.parse(draft)
  }

  async function assertUniqueCategoryName(name: string, excludingId?: CategoryId): Promise<void> {
    const categories = await database.categories.toArray()
    assertUniqueName(categories, name, excludingId, '类型')
  }

  async function assertUniqueTagName(name: string, excludingId?: TagId): Promise<void> {
    const tags = await database.tags.toArray()
    assertUniqueName(tags, name, excludingId, '标签')
  }

  return {
    async createCategory(draft: TaxonomyDraft): Promise<Category> {
      const parsedDraft = await normalizeDraft(draft)
      await assertUniqueCategoryName(parsedDraft.name)
      const categories = await database.categories.toArray()
      const maxOrder = Math.max(0, ...categories.map((category) => category.order))
      const category: Category = {
        id: createId('category'),
        name: parsedDraft.name,
        color: parsedDraft.color,
        icon: 'Utensils',
        order: maxOrder + 1,
        hidden: false,
      }

      await database.categories.add(category)
      return category
    },

    async updateCategory(categoryId: CategoryId, draft: TaxonomyDraft): Promise<Category> {
      const parsedDraft = await normalizeDraft(draft)
      const category = await database.categories.get(categoryId)

      if (!category) {
        throw new Error(`类型不存在：${categoryId}`)
      }

      await assertUniqueCategoryName(parsedDraft.name, categoryId)

      const updatedCategory = {
        ...category,
        name: parsedDraft.name,
        color: parsedDraft.color,
      }

      await database.categories.put(updatedCategory)
      return updatedCategory
    },

    async deleteCategory(categoryId: CategoryId): Promise<CategoryId> {
      const categories = await database.categories.orderBy('order').toArray()
      const fallbackCategory = categories.find((category) => category.id !== categoryId)

      if (!fallbackCategory) {
        throw new Error('至少需要保留一个类型')
      }

      await database.transaction('rw', database.categories, database.places, async () => {
        const affectedPlaces = await database.places.where('categoryId').equals(categoryId).toArray()

        for (const place of affectedPlaces) {
          // Do not touch updatedAt: a taxonomy cleanup is not a place edit and
          // must not jump the place to the top of the "recently updated" sort.
          await database.places.update(place.id, {
            categoryId: fallbackCategory.id,
          })
        }

        await database.categories.delete(categoryId)
      })

      return fallbackCategory.id
    },

    async createTag(draft: TaxonomyDraft): Promise<Tag> {
      const parsedDraft = await normalizeDraft(draft)
      await assertUniqueTagName(parsedDraft.name)
      const tag: Tag = {
        id: createId('tag'),
        name: parsedDraft.name,
        color: parsedDraft.color,
        usageCount: 0,
      }

      await database.tags.add(tag)
      return tag
    },

    async updateTag(tagId: TagId, draft: TaxonomyDraft): Promise<Tag> {
      const parsedDraft = await normalizeDraft(draft)
      const tag = await database.tags.get(tagId)

      if (!tag) {
        throw new Error(`标签不存在：${tagId}`)
      }

      await assertUniqueTagName(parsedDraft.name, tagId)

      const updatedTag = {
        ...tag,
        name: parsedDraft.name,
        color: parsedDraft.color,
      }

      await database.tags.put(updatedTag)
      return updatedTag
    },

    async deleteTag(tagId: TagId): Promise<void> {
      await database.transaction('rw', database.tags, database.places, async () => {
        const affectedPlaces = await database.places.where('tagIds').equals(tagId).toArray()

        for (const place of affectedPlaces) {
          await database.places.update(place.id, {
            tagIds: place.tagIds.filter((id) => id !== tagId),
          })
        }

        await database.tags.delete(tagId)
      })
    },
  }
}

export const taxonomyService = createTaxonomyService()

function assertUniqueName(
  records: TaxonomyRecord[],
  name: string,
  excludingId: string | undefined,
  label: string,
): void {
  const normalizedName = name.toLocaleLowerCase('zh-CN')
  const duplicatedRecord = records.find(
    (record) =>
      record.id !== excludingId && record.name.toLocaleLowerCase('zh-CN') === normalizedName,
  )

  if (duplicatedRecord) {
    throw new Error(`${label}名称已存在：${name}`)
  }
}
