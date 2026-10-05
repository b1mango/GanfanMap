import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  deletePlace: vi.fn(),
  savePlaceDraft: vi.fn(),
}))

vi.mock('./features/places/placeService', async () => {
  const actual = await vi.importActual<typeof import('./features/places/placeService')>(
    './features/places/placeService',
  )

  return {
    ...actual,
    deletePlace: serviceMocks.deletePlace,
    savePlaceDraft: serviceMocks.savePlaceDraft,
  }
})

import App from './App'

describe('App service failure interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    serviceMocks.deletePlace.mockReset()
    serviceMocks.savePlaceDraft.mockReset()
  })

  it('keeps the place editor open and shows service errors when saving fails', async () => {
    serviceMocks.savePlaceDraft.mockRejectedValueOnce(new Error('服务层错误'))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '新增店铺' }))
    await user.type(screen.getByLabelText('店名'), '失败测试店')
    await user.type(screen.getByLabelText('地址'), '上海市失败路 1 号')
    await user.click(screen.getByRole('button', { name: '保存店铺' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('服务层错误')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存店铺' })).toBeEnabled()
  })

  it('restores the delete action and shows an error when deleting a place fails', async () => {
    serviceMocks.deletePlace.mockRejectedValueOnce(new Error('删除失败'))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '展开店铺列表' }))
    await user.click(screen.getByRole('button', { name: '雾社火锅' }))
    await user.click(screen.getByRole('button', { name: '删除店铺' }))
    await user.click(await screen.findByRole('button', { name: '删除店铺' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('删除失败')
    await waitFor(() => expect(screen.getByRole('button', { name: '删除店铺' })).toBeEnabled())
  })

  it('keeps the map context menu open and shows service errors when map point saving fails', async () => {
    serviceMocks.savePlaceDraft.mockRejectedValueOnce(new Error('地图保存失败'))
    const user = userEvent.setup()
    const { container } = render(<App />)

    const mapCanvas = container.querySelector('.map-canvas') as HTMLElement
    const mapLayer = container.querySelector('.amap-map-layer') as HTMLElement
    // jsdom reports a zero rect; the document-level fallback needs real bounds.
    vi.spyOn(mapLayer, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
    fireEvent.contextMenu(mapCanvas, { clientX: 240, clientY: 260 })
    await user.click(await screen.findByRole('menuitem', { name: '标记为已探店' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('地图保存失败')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '标记为已探店' })).toBeEnabled()
  })
})
