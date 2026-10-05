import { useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ChartNoAxesColumn, X } from 'lucide-react'
import type { Category, Place, Visit } from '../../entities/place/types'
import { formatCurrency } from '../../shared/format'
import { IconTooltip } from '../../shared/IconTooltip'
import { computeStats } from './statistics'

export function StatsDialog({
  categories,
  places,
  visits,
}: {
  categories: Category[]
  places: Place[]
  visits: Visit[]
}) {
  const stats = useMemo(() => computeStats(places, visits, categories), [places, visits, categories])
  const maxCategoryCount = stats.categoryBreakdown[0]?.count ?? 0

  return (
    <Dialog.Root>
      <IconTooltip label="统计">
        <Dialog.Trigger asChild>
          <button className="icon-button stats-button" type="button" aria-label="打开统计面板">
            <ChartNoAxesColumn aria-hidden="true" size={18} />
          </button>
        </Dialog.Trigger>
      </IconTooltip>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content stats-dialog" aria-describedby={undefined}>
          <Dialog.Title>统计</Dialog.Title>

          <div className="stats-grid" aria-label="档案总览">
            <div className="stats-cell">
              <span>收录店铺</span>
              <strong>{stats.totalPlaces}</strong>
            </div>
            <div className="stats-cell">
              <span>已探店 / 想去</span>
              <strong>
                {stats.visitedPlaces} / {stats.wishlistPlaces}
              </strong>
            </div>
            <div className="stats-cell">
              <span>消费次数</span>
              <strong>{stats.totalVisits}</strong>
            </div>
            <div className="stats-cell">
              <span>累计消费</span>
              <strong>{formatCurrency(stats.totalSpending)}</strong>
            </div>
          </div>

          <section className="stats-section" aria-label="本月">
            <h3>{stats.monthLabel}</h3>
            <div className="stats-grid">
              <div className="stats-cell">
                <span>本月消费次数</span>
                <strong>{stats.monthVisits}</strong>
              </div>
              <div className="stats-cell">
                <span>本月消费金额</span>
                <strong>{formatCurrency(stats.monthSpending)}</strong>
              </div>
            </div>
          </section>

          <section className="stats-section" aria-label="类型分布">
            <h3>类型分布</h3>
            {stats.categoryBreakdown.length === 0 ? (
              <p className="quiet-note">还没有店铺。</p>
            ) : (
              <div className="stats-bars">
                {stats.categoryBreakdown.map((stat) => (
                  <div className="stats-bar-row" key={stat.categoryId}>
                    <span className="stats-bar-label">{stat.name}</span>
                    <span className="stats-bar">
                      <i
                        style={{
                          width: `${maxCategoryCount > 0 ? Math.round((stat.count / maxCategoryCount) * 100) : 0}%`,
                          background: stat.color,
                        }}
                      />
                    </span>
                    <span className="stats-bar-count">{stat.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="stats-section" aria-label="最常去">
            <h3>最常去</h3>
            {stats.topPlaces.length === 0 ? (
              <p className="quiet-note">还没有消费记录。</p>
            ) : (
              <div className="stats-top-list">
                {stats.topPlaces.map((topPlace, index) => (
                  <div className="stats-top-row" key={topPlace.placeId}>
                    <span className="stats-top-rank">{index + 1}</span>
                    <span className="stats-top-name">{topPlace.name}</span>
                    <span className="stats-top-meta">
                      {topPlace.visitCount} 次 · {formatCurrency(topPlace.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Dialog.Close asChild>
            <button className="icon-button dialog-close" type="button" aria-label="关闭统计弹窗">
              <X aria-hidden="true" size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
