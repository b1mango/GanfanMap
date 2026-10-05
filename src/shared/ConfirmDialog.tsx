import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
  busy = false,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content confirm-dialog">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="ghost-button" type="button" disabled={busy}>
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              className={danger ? 'danger-button' : 'primary-button'}
              type="button"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {busy ? '处理中…' : confirmLabel}
            </button>
          </div>
          <Dialog.Close asChild>
            <button className="icon-button dialog-close" type="button" aria-label="关闭确认弹窗">
              <X aria-hidden="true" size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
