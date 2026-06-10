# Work Hours App

一个基于 Tauri + React 的工时管理桌面应用。

## 功能特性

- 📊 工时记录管理
- 📥 导入工时数据（支持解析 lake 格式）
- 📤 导出工时数据（Excel 格式）
- ⚙️ 应用设置配置
- 📋 工作记录列表展示

## 技术栈

- **框架**: Tauri 2.0 + React 18
- **语言**: TypeScript
- **构建工具**: Vite 4
- **样式**: Tailwind CSS 3
- **状态管理**: Zustand
- **Excel 处理**: xlsx

## 快速开始

### 前置要求

- Node.js >= 18
- Rust >= 1.75（用于 Tauri）
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

### 构建生产版本

```bash
npm run tauri build
```

### 预览网页版本

```bash
npm run dev
```

## 项目结构

```
├── src/                    # 前端源代码
│   ├── components/         # React 组件
│   │   ├── ConfirmDialog.tsx
│   │   ├── ExportPanel.tsx
│   │   ├── ImportPanel.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── WorkRecordList.tsx
│   ├── store/              # Zustand 状态管理
│   │   └── useAppStore.ts
│   ├── utils/              # 工具函数
│   │   ├── allocation.ts
│   │   └── lakeParser.ts
│   ├── App.tsx             # 主应用组件
│   ├── main.tsx            # 入口文件
│   └── index.css           # 全局样式
├── src-tauri/              # Tauri 后端代码
│   ├── src/
│   ├── icons/
│   └── tauri.conf.json
├── public/                 # 静态资源
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 命令说明

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建前端代码 |
| `npm run preview` | 预览构建结果 |
| `npm run tauri dev` | 启动 Tauri 开发模式 |
| `npm run tauri build` | 构建桌面应用安装包 |

## License

MIT