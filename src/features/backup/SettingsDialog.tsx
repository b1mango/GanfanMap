import { useState, type ChangeEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Slider from '@radix-ui/react-slider'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, RotateCcw, Settings, Upload, X } from 'lucide-react'
import { defaultScoreWeights } from '../../entities/place/rating'
import type { ScoreWeights } from '../../entities/place/types'
import { SCORE_DIMENSIONS } from '../../shared/constants'
import { db } from '../../shared/db/database'
import { downloadBackup, exportBackup, importBackup } from './backupService'
import { getErrorMessage } from '../../shared/errors'
import { IconTooltip } from '../../shared/IconTooltip'
import { useConfirmDialog } from '../../shared/useConfirmDialog'
import { isValidScoreWeights, updateScoreWeights } from './settingsService'

type BackupStatus = {
  tone: 'success' | 'error'
  message: string
}

export function SettingsDialog({ onImported }: { onImported?: () => void }) {
  return (
    <Dialog.Root>
      <IconTooltip label="设置">
        <Dialog.Trigger asChild>
          <button className="icon-button settings-button" type="button" aria-label="打开设置">
            <Settings aria-hidden="true" size={18} />
          </button>
        </Dialog.Trigger>
      </IconTooltip>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content settings-dialog" aria-describedby={undefined}>
          <Dialog.Title>设置</Dialog.Title>
          <section className="settings-section" aria-label="评分权重设置">
            <div>
              <span>评分权重</span>
              <p>拖动滑杆调整四维权重，保存后按新权重重算所有店铺总分。</p>
            </div>
            <ScoreWeightsControls />
          </section>
          <section className="settings-section" aria-label="备份设置">
            <div>
              <span>本地备份</span>
              <p>导出 JSON 备份，或从已有备份恢复店铺档案。</p>
            </div>
            <BackupControls onImported={onImported} />
          </section>
          <Dialog.Close asChild>
            <button className="icon-button dialog-close" type="button" aria-label="关闭设置弹窗">
              <X aria-hidden="true" size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ScoreWeightsControls() {
  const settings = useLiveQuery(() => db.settings.get('app'), [])
  const [draft, setDraft] = useState<ScoreWeights>(defaultScoreWeights)
  const [lastSettings, setLastSettings] = useState(settings)
  const [status, setStatus] = useState<BackupStatus | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  // Adopt stored weights whenever settings change (first load, save, backup
  // import) — adjusting state during render instead of in an effect.
  if (settings !== lastSettings) {
    setLastSettings(settings)
    if (settings?.scoreWeights) {
      setDraft(settings.scoreWeights)
    }
  }

  const total = SCORE_DIMENSIONS.reduce((sum, [key]) => sum + draft[key], 0)
  const isValid = isValidScoreWeights(draft)

  async function handleSave(): Promise<void> {
    if (isSaving || !isValid) {
      return
    }

    setIsSaving(true)
    setStatus(undefined)
    try {
      await updateScoreWeights(draft)
      setStatus({ tone: 'success', message: '评分权重已保存，所有店铺总分已重算。' })
    } catch (error) {
      setStatus({ tone: 'error', message: getErrorMessage(error, '保存失败，请稍后重试。') })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="weights-controls">
      {SCORE_DIMENSIONS.map(([key, label]) => (
        <div className="weights-row" key={key}>
          <span className="weights-label">{label}</span>
          <Slider.Root
            className="range-root weights-slider"
            min={0}
            max={100}
            step={5}
            value={[draft[key]]}
            onValueChange={(nextValue) => {
              const value = nextValue[0]
              if (value !== undefined) {
                setDraft((current) => ({ ...current, [key]: value }))
              }
            }}
          >
            <Slider.Track className="range-track">
              <Slider.Range className="range-fill" />
            </Slider.Track>
            <Slider.Thumb className="range-thumb" aria-label={`${label}权重`} />
          </Slider.Root>
          <span className="weights-value">
            {draft[key]}
            {total > 0 ? ` · ${Math.round((draft[key] / total) * 100)}%` : ''}
          </span>
        </div>
      ))}
      {total === 0 ? (
        <p className="form-note form-error" role="alert">
          至少一项权重要大于 0。
        </p>
      ) : null}
      <div className="dialog-actions weights-actions">
        <button
          className="ghost-button"
          type="button"
          disabled={isSaving}
          onClick={() => setDraft(defaultScoreWeights)}
        >
          <RotateCcw aria-hidden="true" size={16} />
          恢复默认
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={isSaving || !isValid}
          onClick={() => void handleSave()}
        >
          {isSaving ? '保存中' : '保存权重'}
        </button>
      </div>
      {status ? (
        <p className={`backup-status ${status.tone}`} role="status" aria-live="polite">
          {status.message}
        </p>
      ) : null}
    </div>
  )
}
function BackupControls({ onImported }: { onImported?: () => void }) {
  const [status, setStatus] = useState<BackupStatus | undefined>(undefined)
  const [busyAction, setBusyAction] = useState<'export' | 'import' | undefined>(undefined)
  const { confirm, dialog } = useConfirmDialog()
  const isBusy = Boolean(busyAction)

  async function handleExport(): Promise<void> {
    if (isBusy) {
      return
    }

    setBusyAction('export')
    try {
      const payload = await exportBackup()
      downloadBackup(payload)
      const approxBytes = payload.photos.reduce(
        (sum, photo) => sum + (photo.dataUrl?.length ?? 0),
        0,
      )
      setStatus({
        tone: 'success',
        message:
          approxBytes > 15 * 1024 * 1024
            ? `备份已导出，照片数据约 ${(approxBytes / 1024 / 1024).toFixed(1)} MB。体积较大，建议定期清理不再需要的照片。`
            : '备份已导出。',
      })
    } catch {
      setStatus({ tone: 'error', message: '导出失败，请稍后重试。' })
    } finally {
      setBusyAction(undefined)
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) {
      return
    }

    if (isBusy) {
      input.value = ''
      return
    }

    const confirmed = await confirm({
      title: '导入备份并替换全部数据',
      description:
        '导入会清空当前浏览器中的全部店铺、消费记录、照片、类型和标签，再写入备份文件内容。此操作不可撤销。',
      confirmLabel: '替换全部本地数据',
      danger: true,
    })

    if (!confirmed) {
      input.value = ''
      return
    }

    setBusyAction('import')
    try {
      const text = await file.text()
      const summary = await importBackup(JSON.parse(text) as unknown)
      onImported?.()
      setStatus({
        tone: 'success',
        message:
          summary.skippedPhotos > 0
            ? `备份已导入，本地数据已全部替换；${summary.skippedPhotos} 张照片缺少图像数据，已跳过。`
            : '备份已导入，本地数据已全部替换。',
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        // JSON parse errors carry English engine text; keep the generic hint for those.
        message:
          error instanceof SyntaxError
            ? '导入失败，请检查备份文件格式。'
            : getErrorMessage(error, '导入失败，请检查备份文件格式。'),
      })
    } finally {
      input.value = ''
      setBusyAction(undefined)
    }
  }

  return (
    <div className="backup-controls-stack">
      <div className="backup-controls">
        <button className="ghost-button" type="button" disabled={isBusy} onClick={() => void handleExport()}>
          <Download aria-hidden="true" size={18} />
          {busyAction === 'export' ? '导出中' : '导出备份'}
        </button>
        <label className={isBusy ? 'ghost-button import-button disabled' : 'ghost-button import-button'} aria-disabled={isBusy}>
          <Upload aria-hidden="true" size={18} />
          {busyAction === 'import' ? '导入中' : '导入备份'}
          <input type="file" accept="application/json" disabled={isBusy} onChange={(event) => void handleImport(event)} />
        </label>
      </div>
      {status ? (
        <p className={`backup-status ${status.tone}`} role="status" aria-live="polite">
          {status.message}
        </p>
      ) : null}
      {dialog}
    </div>
  )
}

