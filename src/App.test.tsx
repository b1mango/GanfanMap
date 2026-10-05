import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { setTheme } from './shared/theme'

describe('App shell', () => {
  it('renders the editorial map workspace', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: '干饭地图指北' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增店铺' })).toBeInTheDocument()
    expect(screen.getByLabelText('搜索地图地点')).toBeInTheDocument()
  })

  it('does not render verbose map or storage status copy in the command layout', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: '干饭地图指北' })).toBeInTheDocument()
    expect(screen.queryByText('本地优先 · IndexedDB 自动保存')).not.toBeInTheDocument()
    expect(screen.queryByText(/已接入高德地图/)).not.toBeInTheDocument()
  })

  it('renders the add-place POI search state', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '新增店铺' }))

    expect(screen.getByLabelText('地点关键词')).toBeInTheDocument()
  })

  it('keeps backup actions inside settings instead of the main map toolbar', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('button', { name: '新增店铺' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开设置' })).toBeInTheDocument()
    expect(screen.queryByText('导出备份')).not.toBeInTheDocument()
    expect(screen.queryByText('导入备份')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '打开设置' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('导出备份')).toBeInTheDocument()
    expect(screen.getByText('导入备份')).toBeInTheDocument()
  })

  it('cycles light, plain and dark themes from the icon button', async () => {
    setTheme('light')
    const user = userEvent.setup()
    render(<App />)

    const themeButton = await screen.findByRole('button', { name: '切换主题（当前：暖纸）' })
    expect(themeButton).toHaveClass('theme-toggle')
    expect(screen.queryByRole('switch', { name: '主题模式' })).not.toBeInTheDocument()

    await user.click(themeButton)
    expect(document.documentElement).toHaveAttribute('data-theme', 'plain')
    expect(await screen.findByRole('button', { name: '切换主题（当前：素白）' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '切换主题（当前：素白）' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    await user.click(screen.getByRole('button', { name: '切换主题（当前：夜食）' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('shows first-run hints until dismissed', async () => {
    window.localStorage.removeItem('fan-map-onboarded')
    const user = userEvent.setup()
    render(<App />)

    const hint = await screen.findByRole('complementary', { name: '使用提示' })
    expect(within(hint).getByText(/右键地图任意位置/)).toBeInTheDocument()

    await user.click(within(hint).getByRole('button', { name: '关闭使用提示' }))

    expect(screen.queryByRole('complementary', { name: '使用提示' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem('fan-map-onboarded')).toBe('1')
  })

  it('shows a clear error when importing an invalid backup file', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '打开设置' }))
    const importInput = screen.getByLabelText('导入备份') as HTMLInputElement
    const invalidBackup = new File(['not json'], 'invalid-backup.json', {
      type: 'application/json',
    })

    await user.upload(importInput, invalidBackup)
    await user.click(await screen.findByRole('button', { name: '替换全部本地数据' }))

    expect(await screen.findByRole('status')).toHaveTextContent('导入失败，请检查备份文件格式。')
  })

  it('saves a manually entered place without throwing after submit', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '新增店铺' }))
    await user.type(screen.getByLabelText('店名'), '新增测试店')
    await user.type(screen.getByLabelText('地址'), '上海市测试路 1 号')
    await user.click(screen.getByRole('button', { name: '保存店铺' }))

    expect(await screen.findByRole('heading', { name: '新增测试店' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('edits a manually added place from the details panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '新增店铺' }))
    await user.type(screen.getByLabelText('店名'), '可编辑测试店')
    await user.type(screen.getByLabelText('地址'), '上海市编辑路 2 号')
    await user.click(screen.getByRole('button', { name: '保存店铺' }))

    expect(await screen.findByRole('heading', { name: '可编辑测试店' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '编辑店铺' }))
    const dialog = screen.getByRole('dialog')
    const nameInput = screen.getByLabelText('店名')
    await user.clear(nameInput)
    await user.type(nameInput, '已修改测试店')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    expect(await screen.findByRole('heading', { name: '已修改测试店' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(dialog).not.toBeInTheDocument()
  })

  it('edits an existing place directly from the overlay list', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '展开店铺列表' }))

    await user.click(screen.getByRole('button', { name: '编辑雾社火锅' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const nameInput = screen.getByLabelText('店名')
    await user.clear(nameInput)
    await user.type(nameInput, '雾社火锅新名')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    expect(await screen.findByRole('heading', { name: '雾社火锅新名' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps taxonomy organizers collapsed in the filter drawer until requested', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '打开筛选面板' }))

    expect(screen.queryByText('整理类型')).not.toBeInTheDocument()
    expect(screen.queryByText('整理标签')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '整理类型' }))
    expect(screen.getByText('整理类型')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '整理标签' }))
    expect(screen.getByText('整理标签')).toBeInTheDocument()
  })

  it('creates a category from the filter organizer and applies it as the active filter', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '打开筛选面板' }))
    await user.click(screen.getByRole('button', { name: '整理类型' }))

    await user.type(screen.getByLabelText('新增类型名称'), '面包店')
    await user.click(screen.getByRole('button', { name: '新增类型' }))

    const categoryButton = await screen.findByRole('button', { name: '面包店' })
    expect(categoryButton).toHaveClass('active')
    expect(screen.getByRole('button', { name: '清空筛选' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '清空筛选' }))
  })

  it('creates a tag from the filter organizer and applies it as the active filter', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '打开筛选面板' }))
    await user.click(screen.getByRole('button', { name: '整理标签' }))

    await user.type(screen.getByLabelText('新增标签名称'), '夜宵')
    await user.click(screen.getByRole('button', { name: '新增标签' }))

    const tagButton = await screen.findByRole('button', { name: '夜宵' })
    expect(tagButton).toHaveClass('active')
    expect(screen.getByRole('button', { name: '清空筛选' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '清空筛选' }))
  })



  it('selects a tag created inline in the place editor', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '\u65b0\u589e\u5e97\u94fa' }))
    await user.type(screen.getByPlaceholderText('\u65b0\u589e\u6807\u7b7e\u2026'), '\u4e34\u65f6\u53ef\u9009\u6807\u7b7e')
    await user.click(screen.getByRole('button', { name: '\u5feb\u901f\u65b0\u589e\u6807\u7b7e' }))

    const tagCheckbox = await screen.findByRole('checkbox', { name: '\u4e34\u65f6\u53ef\u9009\u6807\u7b7e' })
    expect(tagCheckbox).toBeChecked()
  })

  it('places the delete action in a dedicated place management section', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '\u65b0\u589e\u5e97\u94fa' }))
    await user.type(screen.getByLabelText('\u5e97\u540d'), '\u5220\u9664\u4f4d\u7f6c\u6d4b\u8bd5\u5e97')
    await user.type(screen.getByLabelText('\u5730\u5740'), '\u4e0a\u6d77\u5e02\u5220\u9664\u8def 9 \u53f7')
    await user.click(screen.getByRole('button', { name: '\u4fdd\u5b58\u5e97\u94fa' }))

    expect(await screen.findByRole('heading', { name: '\u5220\u9664\u4f4d\u7f6c\u6d4b\u8bd5\u5e97' })).toBeInTheDocument()
    const managementSection = await screen.findByRole('region', { name: '\u5e97\u94fa\u7ba1\u7406' })
    expect(within(managementSection).getByRole('button', { name: '\u5220\u9664\u5e97\u94fa' })).toBeInTheDocument()
  })

  it('creates a category from the place editor and selects it automatically', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '\u65b0\u589e\u5e97\u94fa' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '\u6574\u7406\u7c7b\u578b' }))
    await user.type(within(dialog).getByLabelText('\u65b0\u589e\u7c7b\u578b\u540d\u79f0'), '\u751c\u54c1\u5e97')
    await user.click(within(dialog).getByRole('button', { name: '\u65b0\u589e\u7c7b\u578b' }))

    expect(await within(dialog).findByRole('option', { name: '\u751c\u54c1\u5e97' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('\u4e3b\u7c7b\u578b')).toHaveDisplayValue('\u751c\u54c1\u5e97')
  })

  it('creates a tag from the place editor and selects it automatically', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '\u65b0\u589e\u5e97\u94fa' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '\u6574\u7406\u6807\u7b7e' }))
    await user.type(within(dialog).getByLabelText('\u65b0\u589e\u6807\u7b7e\u540d\u79f0'), '\u7ea6\u4f1a')
    await user.click(within(dialog).getByRole('button', { name: '\u65b0\u589e\u6807\u7b7e' }))

    const tagCheckbox = await within(dialog).findByRole('checkbox', { name: '\u7ea6\u4f1a' })
    expect(tagCheckbox).toBeChecked()
  })
  it('clears active filters from the filter drawer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '打开筛选面板' }))

    const resetButton = screen.getByRole('button', { name: '清空筛选' })
    const statusGroup = screen.getByRole('group', { name: '店铺状态' })

    expect(resetButton).toBeDisabled()

    await user.click(within(statusGroup).getByRole('button', { name: '已探店' }))
    expect(resetButton).toBeEnabled()

    await user.click(resetButton)

    expect(within(statusGroup).getByRole('button', { name: '全部' })).toHaveClass('active')
    expect(resetButton).toBeDisabled()
  })
})
