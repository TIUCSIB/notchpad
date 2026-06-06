![Notchpad Banner](.github/banner.png)

<div align="center">

# Notchpad

**一款刚海风格的桌面便签应用**

Electron + Vue 3 + TipTap

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-39-47848f.svg)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3.5-42b883.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)

</div>

---

> 紧贴屏幕顶部的智能便签，随时随地记下你的想法。

---

## ✨ 功能亮点

### 🌧️ 灵动刚海交互

应用启动后自动收起为屏幕顶部中央的小药丸（顶部齐平、底部圆润的刚海造型），悬浮或点击即可展开完整编辑区域。收回时带有弹性弹簧动画，流畅自然。

支持两种唤醒方式：
- 悬浮唤醒：鼠标经过药丸时自动展开
- 点击唤醒：点击药丸展开，带 Jelly 弹跳动效

### 📝 富文本编辑器

基于 [TipTap](https://tiptap.dev/) 构建，提供专业的富文本编辑体验：

| 功能 | 描述 |
| --- | --- |
| 文本格式 | 加粗、斜体、删除线、行内代码 |
| 结构化 | 引用块、有序/无序列表、任务列表 |
| 链接 | 插入链接，左键/右键直接在系统浏览器打开 |
| 图片 | 截图粘贴，自动压缩至 1920px 宽度 |
| 字体 | 字号、颜色、高亮、字体样式 |
| 其他 | 分割线、实时字数统计 |

### 📄 多页面管理

最多支持 **10 个页面**，顶部胶囊状导航栏切换：
- 拖拽排序，动画平滑无抖动
- 双击圆点编辑页面标题
- 悬浮圆点显示标题 Tooltip
- 支持置顶/取消置顶

### 🔅 多显示器支持

窗口可在多个显示器之间切换，选择自动持久化。单显示器时快捷键静宛忽略。

### 🔑 全局快捷键

`Ctrl+Alt+Z` 直接呼出窗口并展开编辑区域，随时随地记下想法。

### 💾 数据持久化

使用 SQLite（sql.js）本地存储，数据保存在 `userData/memo.db`。支持自定义存储位置，可在设置中将数据库迁移到其他目录。

### 🔵 系统托盘

关闭窗口后应用驻留系统托盘，双击托盘图标即可恢复，右键菜单提供显示窗口和退出选项。

### ⚙️ 设置中心

- **主题**：深色 / 浅色 / 跟随系统
- **强调色**：7 种预设颜色
- **默认字号**：12px - 32px
- **唤醒方式**：悬浮展开 / 点击展开
- **开机自启**：一键开关
- **存储位置**：自定义数据库存储目录
- **数据导入/导出**：JSON 和 Markdown 格式备份与恢复

### 🎜️ 自动保存

编辑内容后自动保存，底部显示“保存中”/“已保存”状态指示器。也可使用 Ctrl+S 手动保存。

### 🖼️ 图片压缩

粘贴图片时自动压缩：最大宽度 1920px，JPEG 质量 0.8，避免数据库膨胀。

---

## 🔢 快捷键速查

| 快捷键 | 功能 | 快捷键 | 功能 |
| --- | --- | --- | --- |
| `Ctrl+N` | 新建页面 | `Ctrl+Z` | 撤销 |
| `Ctrl+D` | 删除页面 | `Ctrl+Y` | 重做 |
| `Ctrl+S` | 保存 | `Ctrl+W` | 最小化 |
| `Ctrl+Tab` | 下一页 | `Ctrl+Shift+Tab` | 上一页 |
| `Ctrl+1~9` | 跳转页面 | `Ctrl+Shift+M` | 切换显示器 |
| `Ctrl+Alt+Z` | 呼出窗口 | | |

---

## 📦 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | Electron 39 + Vue 3.5 |
| 构建 | electron-vite + Vite 7 |
| 编辑器 | TipTap 3 (StarterKit + 扩展) |
| 动画 | motion-v（弹性物理动画） |
| 图标 | Lucide Vue Next |
| 数据库 | sql.js (SQLite WASM) |
| 语言 | TypeScript |
| 包管理 | pnpm |

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/TIUCSIB/notchpad.git
cd notchpad

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建 Windows 安装包
pnpm build:win

# 构建 macOS
pnpm build:mac

# 构建 Linux
pnpm build:linux
```

---

## 📂 项目结构

```
src/
├── main/
│   ├── index.ts                  # Electron 入口
│   ├── db.ts                     # SQLite 数据库操作
│   ├── ipc.ts                    # IPC 处理器注册
│   └── notch.ts                  # 刚海轮询与模式切换
├── preload/
│   ├── index.ts                  # 预加载脚本
│   └── index.d.ts                # API 类型声明
└── renderer/
    └── src/
        ├── App.vue               # 主组件
        ├── App.css               # 主组件样式
        ├── main.ts               # 渲染进程入口
        ├── editor.css            # TipTap 编辑器样式
        ├── types.ts              # 共享类型定义
        ├── components/
        │   ├── TopToolbar.vue    # 顶部工具栏
        │   ├── BottomBar.vue     # 底部工具栏
        │   ├── LinkDialog.vue    # 链接弹窗
        │   └── Settings.vue      # 设置面板
        ├── composables/
        │   ├── useNotch.ts       # 刚海动画状态
        │   ├── usePages.ts       # 页面 CRUD
        │   ├── useSave.ts        # 自动保存
        │   ├── useSettings.ts    # 设置加载
        │   ├── useEditorSetup.ts # TipTap 初始化
        │   ├── useDragReorder.ts # 拖拽排序
        │   └── useFontPopups.ts  # 字体弹窗
        ├── extensions/
        │   └── fontSize.ts       # FontSize 自定义 Mark
        ├── utils/
        │   └── dataConverter.ts  # HTML→Markdown 转换
        └── directives/
            └── jelly.ts          # Jelly 弹跳动画指令
```

---

## 🌗 License

MIT