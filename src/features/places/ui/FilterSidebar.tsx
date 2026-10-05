import { useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { Filter, SlidersHorizontal } from 'lucide-react'
import { hasActiveFilters } from '../../../entities/place/filter'
import type { Category, Tag } from '../../../entities/place/types'
import { FILTER_STATUS_OPTIONS } from '../../../shared/constants'
import { useUiStore } from '../uiStore'
import { CategoryManager, TagManager } from './TaxonomyManager'

export function FilterSidebar({
  categories,
  filteredCount,
  placesCount,
  tags,
}: {
  categories: Category[]
  filteredCount: number
  placesCount: number
  tags: Tag[]
}) {
  const filters = useUiStore((state) => state.filters)
  const sortKey = useUiStore((state) => state.sortKey)
  const setStatus = useUiStore((state) => state.setStatus)
  const setCategory = useUiStore((state) => state.setCategory)
  const toggleTag = useUiStore((state) => state.toggleTag)
  const setScoreRange = useUiStore((state) => state.setScoreRange)
  const setPriceRange = useUiStore((state) => state.setPriceRange)
  const resetFilters = useUiStore((state) => state.resetFilters)
  const setSortKey = useUiStore((state) => state.setSortKey)
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const filtersActive = hasActiveFilters(filters)

  return (
    <aside className="sidebar">
      <div className="drawer-heading">
        <div>
          <p className="eyebrow">Filters</p>
          <h2>筛选店铺</h2>
        </div>
        <button
          className="reset-filters-button"
          type="button"
          disabled={!filtersActive}
          onClick={resetFilters}
        >
          清空筛选
        </button>
      </div>

      <section className="filter-section" aria-labelledby="status-filter">
        <div className="section-title">
          <Filter aria-hidden="true" size={16} />
          <h2 id="status-filter">筛选</h2>
        </div>
        <div className="segmented" role="group" aria-label="店铺状态">
          {FILTER_STATUS_OPTIONS.map(([value, label]) => (
            <button
              className={filters.status === value ? 'active' : ''}
              aria-pressed={filters.status === value}
              key={value}
              type="button"
              onClick={() => setStatus(value as typeof filters.status)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="filter-section" aria-labelledby="category-filter">
        <div className="taxonomy-section-header">
          <h2 id="category-filter">主类型</h2>
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
        <div className="chip-grid taxonomy-chip-grid">
          <button
            className={!filters.categoryId ? 'chip active' : 'chip'}
            aria-pressed={!filters.categoryId}
            type="button"
            onClick={() => setCategory(undefined)}
          >
            全部
          </button>
          {categories
            .filter((category) => !category.hidden)
            .map((category) => (
              <button
                className={filters.categoryId === category.id ? 'chip active' : 'chip'}
                aria-pressed={filters.categoryId === category.id}
                key={category.id}
                style={{ '--chip-color': category.color } as React.CSSProperties}
                type="button"
                onClick={() => setCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
        </div>
        {showCategoryManager ? (
          <CategoryManager
            activeCategoryId={filters.categoryId}
            categories={categories}
            title="整理类型"
            onCreatedCategory={(categoryId) => setCategory(categoryId)}
            onDeletedActiveCategory={() => setCategory(undefined)}
          />
        ) : null}
      </section>

      <section className="filter-section" aria-labelledby="tag-filter">
        <div className="taxonomy-section-header">
          <h2 id="tag-filter">标签</h2>
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
        <div className="chip-grid taxonomy-chip-grid">
          {tags.map((tag) => (
            <button
              className={filters.tagIds.includes(tag.id) ? 'chip active' : 'chip'}
              aria-pressed={filters.tagIds.includes(tag.id)}
              key={tag.id}
              style={{ '--chip-color': tag.color } as React.CSSProperties}
              type="button"
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
        {tags.length === 0 ? (
          <p className="quiet-note">还没有标签，可以在下方新增。</p>
        ) : null}
        {showTagManager ? (
          <TagManager
            activeTagIds={filters.tagIds}
            tags={tags}
            title="整理标签"
            onCreatedTag={(tagId) => {
              if (!filters.tagIds.includes(tagId)) {
                toggleTag(tagId)
              }
            }}
            onDeletedActiveTag={(tagId) => toggleTag(tagId)}
          />
        ) : null}
      </section>

      <RangeFilter
        label="综合分"
        max={10}
        min={1}
        step={0.5}
        value={filters.scoreRange}
        onChange={setScoreRange}
      />
      <RangeFilter
        label="人均"
        max={500}
        min={0}
        step={10}
        value={filters.priceRange}
        valuePrefix="¥"
        onChange={setPriceRange}
      />

      <label className="select-label">
        排序
        <select
          name="sort"
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
        >
          <option value="updated-desc">最近更新</option>
          <option value="score-desc">综合分最高</option>
          <option value="price-asc">人均从低到高</option>
          <option value="price-desc">人均从高到低</option>
        </select>
      </label>

      <div className="sidebar-summary">
        <span>{filteredCount}</span>
        <p>当前结果 / 共 {placesCount} 家店</p>
      </div>
    </aside>
  )
}

function RangeFilter({
  label,
  max,
  min,
  onChange,
  step,
  value,
  valuePrefix = '',
}: {
  label: string
  max: number
  min: number
  onChange: (value: [number, number]) => void
  step: number
  value: [number, number]
  valuePrefix?: string
}) {
  return (
    <section className="filter-section">
      <div className="range-heading">
        <h2>{label}</h2>
        <span>
          {valuePrefix}
          {value[0]} - {valuePrefix}
          {value[1]}
        </span>
      </div>
      <Slider.Root
        className="range-root"
        max={max}
        min={min}
        step={step}
        value={value}
        onValueChange={(nextValue) => {
          const [start, end] = nextValue
          if (start !== undefined && end !== undefined) {
            onChange([start, end])
          }
        }}
      >
        <Slider.Track className="range-track">
          <Slider.Range className="range-fill" />
        </Slider.Track>
        <Slider.Thumb className="range-thumb" aria-label={`${label} 最小值`} />
        <Slider.Thumb className="range-thumb" aria-label={`${label} 最大值`} />
      </Slider.Root>
    </section>
  )
}
