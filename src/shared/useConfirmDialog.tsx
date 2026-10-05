import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

type UseConfirmOptions = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export function useConfirmDialog() {
  const [state, setState] = useState<
    | (UseConfirmOptions & {
        open: true
        resolve: (confirmed: boolean) => void
      })
    | { open: false }
  >({ open: false })

  function confirm(options: UseConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      setState({
        open: true,
        resolve,
        ...options,
      })
    })
  }

  function handleOpenChange(open: boolean): void {
    if (!open && state.open) {
      state.resolve(false)
      setState({ open: false })
    }
  }

  function handleConfirm(): void {
    if (!state.open) {
      return
    }

    state.resolve(true)
    setState({ open: false })
  }

  const dialog: ReactNode = state.open ? (
    <ConfirmDialog
      open
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
    />
  ) : null

  return { confirm, dialog }
}
