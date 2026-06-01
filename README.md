![Notchpad Banner](.github/banner.png)

<div align="center">

# Notchpad

**一款刘海风格的桌面笔记应用**

Electron + Vue 3 + TipTap · 紧贴屏幕顶部 · 弹性动画 · 深色/浅色主题

</div>

---

## 特性

### 灵动刘海交互

应用启动后自动收起为屏幕顶部中央的**小药丸**，悬浮或点击即可展开完整编辑区域。收回时带有弹性弹簧动画和高斯模糊过渡，流畅自然。

### 富文本编辑器

基于 [TipTap](https://tiptap.dev/) 构建，支持：

- 加粗、斜体、删除线、行内代码
- 引用块、有序/无序列表、任务列表
- 链接插入（右键直接在系统浏览器打开）
- 截图粘贴（`Ctrl+V` 直接插入图片）
- 分割线
- 字体大小、字体颜色、文字高亮、字体样式

### 多页面管理

最多支持 **10 个页面**，顶部胶囊式导航栏切换，支持拖拽排序，动画平滑无抖动。

### 置顶/星标页面

长按页面标签弹出置顶菜单，置顶页始终排在最前面，标签上显示星标图标。置顶状态持久化存储。

### 全局快捷键

`Ctrl+Alt+Z` 直接呼出窗口并展开编辑区域。

### 数据持久化

使用 SQLite（sql.js）本地存储，数据保存在 `userData/memo.db`。

### 系统托盘

关闭窗口后应用驻留系统托盘，双击托盘图标即可恢复，右键菜单提供显示/退出选项。

### 设置中心

- **主题**：深色 / 浅色 / 跟随系统
- **强调色**：7 种预设颜色
- **默认字号**：12px - 32px
- **唤醒方式**：悬浮展开 / 点击展开（带 Jelly 弹跳动效）
- **开机自启**：一键开关
- **数据导入/导出**：JSON 和 Markdown 格式备份与恢复

### 键盘快捷键

| 快捷键      | 功能     |
| ----------- | -------- |
| `Ctrl+N`    | 新建页面 |
| `Ctrl+S`    | 保存     |
| `Ctrl+Z`    | 撤销     |
| `Ctrl+Y`    | 重做     |
| `Ctrl+W`    | 最小化   |
| `Ctrl+Alt+Z` | 呼出窗口 |

### 自动保存

编辑内容后自动保存，底部显示"保存中"/"已保存"状态指示器，无需手动操作。

---

## 技术栈

| 类别   | 技术                         |
| ------ | ---------------------------- |
| 框架   | Electron 39 + Vue 3.5        |
| 构建   | electron-vite + Vite 7       |
| 编辑器 | TipTap 3 (StarterKit + 扩展) |
| 动画   | motion-v（弹簧物理动画）     |
| 图标   | Lucide Vue Next              |
| 数据库 | sql.js (SQLite WASM)         |
| 语言   | TypeScript                   |
| 包管理 | pnpm                         |

---

## 快速开始

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

## 项目结构

经过模块化重构，所有文件控制在 330 行以内，逻辑与样式分离：

```
src/
├── main/
│   ├── index.ts                  # Electron 入口（窗口、托盘、快捷键）
│   ├── db.ts                     # SQLite 数据库操作
│   ├── ipc.ts                    # IPC 处理器注册
│   └── notch.ts                  # 刘海轮询与模式切换
├── preload/
│   ├── index.ts                  # 预加载脚本（IPC 桥接）
│   └── index.d.ts                # API 类型声明
└── renderer/
    └── src/
        ├── App.vue               # 主组件（刘海动画、编辑器布局）
        ├── App.css               # 主组件样式
        ├── main.ts               # 渲染进程入口
        ├── editor.css            # TipTap 编辑器样式
        ├── types.ts              # 共享类型定义
        ├── components/
        │   ├── TopToolbar.vue    # 顶部工具栏（页面导航、拖拽、置顶）
        │   ├── TopToolbar.css
        │   ├── BottomBar.vue     # 底部工具栏（格式化、字体控制）
        │   ├── BottomBar.css
        │   ├── LinkDialog.vue    # 链接插入弹窗
        │   ├── Settings.vue      # 设置面板
        │   └── Settings.css
        ├── composables/
        │   ├── useNotch.ts       # 刘海动画状态管理
        │   ├── usePages.ts       # 页面 CRUD、排序、置顶
        │   ├── useSave.ts        # 自动保存与状态指示
        │   ├── useSettings.ts    # 设置加载、主题、CSS 变量
        │   ├── useEditorSetup.ts # TipTap 初始化与格式化命令
        │   ├── useDragReorder.ts # 指针事件自定义拖拽排序
        │   └── useFontPopups.ts  # 字体弹窗开关逻辑
        ├── extensions/
        │   └── fontSize.ts       # TipTap FontSize 自定义 Mark
        ├── utils/
        │   └── dataConverter.ts  # HTML↔Markdown 转换 + 导入导出
        └── directives/
            └── jelly.ts          # Jelly 弹跳动画指令
```

---

## 窗口参数

| 参数     | 值                                 |
| -------- | ---------------------------------- |
| 默认尺寸 | 523 x 364 px                       |
| 药丸尺寸 | 64 x 8 px                          |
| 位置     | 屏幕顶部中央                       |
| 特性     | 无边框、透明背景、置顶、隐藏任务栏 |

---

## 路线图

以下功能计划后续实现：

- **拖拽排序动画优化** — 更丝滑的 motion-v 布局动画
- **Markdown 导出增强** — 支持更多格式细节
- **标签页图标** — 为每个页面添加自定义图标
- **剪贴板历史** — 保留最近复制的内容快速粘贴

---

## License

MIT
