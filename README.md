# GanfanMap

<p align="center">
  <img src="public/brand-icon.svg" alt="GanfanMap" width="112" height="112" />
</p>

<p align="center">本地优先的私人探店地图</p>

<p align="center">
  <a href="https://github.com/b1mango/GanfanMap"><img src="https://img.shields.io/badge/status-development-2ea043" alt="development" /></a>
  <img src="https://img.shields.io/badge/platform-Web-1f6feb" alt="Web" />
  <a href="#license"><img src="https://img.shields.io/badge/license-pending-f5c542" alt="license pending" /></a>
</p>

## 功能

- 记录店铺状态、类型、标签、地址、坐标、人均和笔记
- 记录消费日期、菜品、金额、备注与照片
- 口味、环境、服务、性价比评分及综合分计算
- 按状态、类型、标签、综合分、人均筛选和排序
- 配置高德 Key 后使用真实地图、Marker 和 POI 搜索选点
- IndexedDB 本地保存全部数据，支持 JSON 备份导入导出

## 安装

需要 Node.js 与 pnpm。克隆仓库并安装依赖：

```bash
git clone https://github.com/b1mango/GanfanMap.git
cd GanfanMap
pnpm install --frozen-lockfile
pnpm dev
```

开发服务默认运行于 `http://127.0.0.1:5174`。启用高德地图和搜索时，复制 `.env.example` 为 `.env.local`，填写 `VITE_AMAP_KEY` 与 `VITE_AMAP_SECURITY_JS_CODE` 后重启开发服务。

## 开发

```bash
pnpm lint
pnpm test
pnpm build
```

## License

仓库当前未附 `LICENSE` 文件，许可证待确认。请在补充许可证文本后更新此处及徽章。
