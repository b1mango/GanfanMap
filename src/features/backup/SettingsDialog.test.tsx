import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as Tooltip from '@radix-ui/react-tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

const backupMocks = vi.hoisted(() => ({
  downloadBackup: vi.fn(),
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
}))

vi.mock('./backupService', () => ({
  downloadBackup: backupMocks.downloadBackup,
  exportBackup: backupMocks.exportBackup,
  importBackup: backupMocks.importBackup,
}))

import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog backup interactions', () => {
  beforeEach(() => {
    backupMocks.exportBackup.mockReset()
    backupMocks.importBackup.mockReset()
    backupMocks.downloadBackup.mockReset()
  })

  it('asks for confirmation before importing a backup', async () => {
    const user = userEvent.setup()
    renderWithTooltip(<SettingsDialog />)

    await user.click(screen.getByRole('button', { name: '打开设置' }))
    await user.upload(
      screen.getByLabelText('导入备份'),
      new File(['{}'], 'backup.json', { type: 'application/json' }),
    )

    expect(await screen.findByRole('dialog', { name: '导入备份并替换全部数据' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(backupMocks.importBackup).not.toHaveBeenCalled()
  })

  it('disables backup actions while importing', async () => {
    let resolveImport!: () => void
    backupMocks.importBackup.mockReturnValue(
      new Promise<{ skippedPhotos: number }>((resolve) => {
        resolveImport = () => resolve({ skippedPhotos: 0 })
      }),
    )

    const user = userEvent.setup()
    renderWithTooltip(<SettingsDialog />)

    await user.click(screen.getByRole('button', { name: '打开设置' }))
    await user.upload(
      screen.getByLabelText('导入备份'),
      new File(['{}'], 'backup.json', { type: 'application/json' }),
    )

    await user.click(await screen.findByRole('button', { name: '替换全部本地数据' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '导出备份' })).toBeDisabled())
    expect(screen.getByText('导入中')).toBeInTheDocument()

    resolveImport()
    expect(await screen.findByRole('status')).toHaveTextContent('备份已导入，本地数据已全部替换。')
  })
})

function renderWithTooltip(element: ReactElement) {
  return render(<Tooltip.Provider>{element}</Tooltip.Provider>)
}
