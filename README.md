# 干饭地图指北

一个本地优先的私人探店网页地图。第一版只做 Web，使用 React、Vite、TypeScript、Dexie、Zod、Zustand、Radix UI、lucide-react 和 GSAP。

## 运行

```bash
pnpm install
pnpm dev
```

如需启用高德搜索选点，复制 `.env.example` 为 `.env.local` 后填入：

```text
VITE_AMAP_KEY=
VITE_AMAP_SECURITY_JS_CODE=
```

当前开发服务默认可用：

```text
http://127.0.0.1:5174
```

## 当前能力

- 店铺本地记录：已探店 / 想去、主类型、多标签、地址、坐标、人均、笔记。
- 评分模型：口味、环境、服务、性价比 1-10 分，加权得到综合分。
- 消费记录：日期、菜品/内容、金额、备注、照片压缩后保存到 IndexedDB。
- 筛选排序：状态、主类型、标签、综合分、人均、排序。
- 地图体验：无高德 Key 时提示配置；配置 Key 后使用高德 JS API 2.0 真实底图、真实 marker 和 POI 搜索选点。
- 数据安全：IndexedDB 本地保存，支持 JSON 备份导入导出。

## 验证

```bash
pnpm lint
pnpm test
pnpm build
```

## 边界

- 首版不做登录、云同步、公开分享页和实时营业状态。
- 首版以桌面管理体验为主，手机端保证基础浏览、筛选和详情可用。
- 高德真实地图需要配置 `VITE_AMAP_KEY` 并重启开发服务后加载；未配置时会提示配置 Key。
