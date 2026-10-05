# 地图指挥台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前三栏界面改为高德地图全屏的“地图指挥台”，并让顶部搜索真正调用高德地图 POI 搜索、可聚焦地图结果。

**Architecture:** React 仍只处理 UI 和交互状态；高德 SDK 能力继续封装在 `MapAdapter`。新增地图搜索状态保留在 `App.tsx` 内，后续拆分组件时再迁移到独立 feature。

**Tech Stack:** React、TypeScript、Vite、Dexie、Zustand、Radix Dialog、高德 JS API 2.0、Vitest、Testing Library。

---

### Task 1: 地图搜索能力

**Files:**
- Modify: `src/features/map/mapAdapter.ts`
- Modify: `src/features/map/amapAdapter.ts`
- Modify: `src/features/map/amapAdapter.test.ts`

- [ ] 扩展 `MapAdapter`，新增 `focusLocation(location, zoom?)` 与 `setSearchPreview(candidate)`。
- [ ] 测试：搜索候选可以生成预览 marker，并让地图中心移动到候选坐标。
- [ ] 实现：高德适配器维护一个 search preview marker，不写入 Dexie。

### Task 2: 全屏地图指挥台布局

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/index.css`

- [ ] 移除三栏常驻布局。
- [ ] 顶部正中加入地图搜索框和搜索按钮。
- [ ] 搜索提交调用 `createAmapAdapter(...).searchPoi()`，结果展示在搜索框下方。
- [ ] 点击搜索候选后让地图聚焦候选，并显示搜索预览 marker。
- [ ] 筛选改为左侧抽屉。
- [ ] 店铺详情改为右侧抽屉。
- [ ] 店铺列表改为底部结果条。
- [ ] 删除冗余文案：地图状态长句、本地优先保存提示。

### Task 3: 文档与验证

**Files:**
- Modify: `项目设计.md`
- Modify: `项目进度清单.md`
- Modify: `scripts/check-project-alignment.mjs`

- [ ] 同步记录地图指挥台实现状态。
- [ ] 运行 `pnpm check`。
- [ ] 运行 `pnpm test`。
- [ ] 运行 `pnpm build`。
- [ ] 用 in-app Browser 验证真实高德地图、顶部搜索、抽屉、移动端无横向溢出。
