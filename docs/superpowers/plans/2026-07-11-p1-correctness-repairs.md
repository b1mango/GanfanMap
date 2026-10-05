# P1 Correctness Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复照片保存、POI 坐标、地图选择链路、空备份初始化和测试顺序依赖，恢复本地档案主流程的正确性。

**Architecture:** 保持现有 React、Dexie、MapAdapter 和 service 边界，不在止血阶段做大拆分。异步媒体处理移到事务外，POI 坐标进入 React 状态，地图选择按来源分流，首次初始化使用必需的 `settings/app` 记录作为持久哨兵，而不是用业务数据表是否为空来判断。

**Tech Stack:** React 19、TypeScript、Dexie 4、Zod、Vitest、Testing Library、fake-indexeddb、Vite。

---

### Task 1: Keep image processing outside Dexie transactions

**Files:**
- Modify: `src/features/places/placeService.ts`
- Test: `src/features/places/placeService.test.ts`

- [ ] **Step 1: Write the failing photo transaction test**

Add a test that supplies one image file, mocks image decoding and `canvas.toBlob`, calls `addVisitDraft`, and asserts that the visit and photo are both persisted with matching IDs.

```ts
expect(savedVisit.photoIds).toEqual([expect.stringMatching(/^photo_/u)])
expect(await db.photos.get(savedVisit.photoIds[0]!)).toMatchObject({
  placeId: 'p1',
  visitId: savedVisit.id,
})
```

- [ ] **Step 2: Verify RED**

Run: `node node_modules/vitest/vitest.mjs run src/features/places/placeService.test.ts --maxWorkers=1`

Expected: the new test fails with `TransactionInactiveError` on the current implementation.

- [ ] **Step 3: Implement the minimal transaction repair**

Compress all files and assign visit/photo IDs before opening the Dexie transaction. Inside the transaction, only write prepared photos, add the visit, read visits for the place, and update the derived average price.

- [ ] **Step 4: Verify GREEN**

Run the same focused test command and expect all `placeService` tests to pass.

### Task 2: Persist POI coordinates in React state

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.search.test.tsx`

- [ ] **Step 1: Write the failing POI coordinate test**

Mock a POI far from the Shanghai fallback, select it in the create dialog, save, and assert the draft passed to `savePlaceDraft` contains the candidate coordinates.

```ts
expect(savePlaceDraft).toHaveBeenCalledWith(
  expect.objectContaining({ lng: 121.327, lat: 31.200 }),
)
```

- [ ] **Step 2: Verify RED**

Run: `node node_modules/vitest/vitest.mjs run src/App.search.test.tsx --maxWorkers=1`

Expected: the captured draft still contains the Shanghai fallback coordinates.

- [ ] **Step 3: Implement controlled location state**

Store `{ lng, lat }` in `PlaceEditorDialog` state, reset it on open, update it when applying a POI candidate, and build the submitted draft from that state. Remove imperative writes to hidden coordinate inputs.

- [ ] **Step 4: Verify GREEN**

Run the focused search test and expect it to pass.

### Task 3: Restore marker card and focus behavior

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`
- Test: `src/features/map/amapAdapter.test.ts`

- [ ] **Step 1: Write failing selection behavior tests**

Assert marker-origin selection opens `MapPlaceCard` without opening the full details panel. Assert selected place changes call `focusPlace` after the adapter is mounted.

- [ ] **Step 2: Verify RED**

Run the two focused test files and confirm the card/focus assertions fail.

- [ ] **Step 3: Implement source-specific selection**

Marker clicks set `mapPlaceCardPlaceId` and leave `detailsOpen` false. List/details selections continue to open the full panel. Add a `MapCanvas` effect that calls `focusPlace(selectedPlaceId)` after marker selection changes.

- [ ] **Step 4: Verify GREEN**

Run the focused App and adapter tests and expect them to pass.

### Task 4: Preserve intentionally empty archives

**Files:**
- Modify: `src/shared/db/seed.ts`
- Test: `src/features/backup/backup.test.ts`

- [ ] **Step 1: Write the failing empty-backup restart test**

Import a valid empty payload, call `ensureSeedData(db)`, and assert that categories, places, and visits remain empty.

- [ ] **Step 2: Verify RED**

Run: `node node_modules/vitest/vitest.mjs run src/features/backup/backup.test.ts --maxWorkers=1`

Expected: the database contains sample data after `ensureSeedData`.

- [ ] **Step 3: Use the settings record as the persistent initialization sentinel**

If `settings/app` already exists, return without seeding even when categories are empty. If it is absent, write default settings and seed sample rows in one transaction; preserve the existing behavior that a partial database with categories but missing settings only receives default settings, not duplicate samples.

- [ ] **Step 4: Verify GREEN and legacy compatibility**

Run backup and seed-focused tests. Legacy v1 backups must parse and must not receive sample rows after import.

### Task 5: Remove test order dependence

**Files:**
- Modify: `src/App.interactions.test.tsx`
- Modify: `package.json`

- [ ] **Step 1: Preserve the existing shuffle failure evidence**

Run: `node node_modules/vitest/vitest.mjs run --sequence.shuffle --sequence.seed=20260711 --maxWorkers=1`

Expected before repair: `1 failed | 60 passed` at the synchronous `雾社火锅` lookup.

- [ ] **Step 2: Wait for asynchronously seeded UI state**

Use `findByRole` for the seeded place and add a deterministic `test:shuffle` script with the fixed seed.

- [ ] **Step 3: Verify GREEN**

Run both default and shuffled suites and expect `61/61` or the updated total to pass.

### Task 6: Documentation and final verification

**Files:**
- Modify: `项目设计.md`
- Modify: `项目进度清单.md`

- [ ] **Step 1: Record repaired behavior and regression coverage**

Document the transaction boundary, controlled POI location, marker selection semantics, initialization sentinel, and shuffle gate.

- [ ] **Step 2: Run full verification**

Run: `pnpm.cmd check`

Run: `pnpm.cmd test`

Run: `pnpm.cmd test:shuffle`

Run: `pnpm.cmd build`

Expected: every command exits 0.

- [ ] **Step 3: Run browser regression**

At desktop and `390x844`, verify POI coordinate save, marker card then full details, filter flow, clean console, and no horizontal overflow.
