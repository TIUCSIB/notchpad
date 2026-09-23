# Changelog

## v1.0.6 (2026-09-23)

### Fixes

- **标题不再被正文保存流程清空**：`update-page` 原本会把传入的 title 一起写库，而自动保存传的是空串，导致双击圆点设好的标题在下次保存时消失。现在该通道只更新正文，标题走独立的 `update-page-title`（`ipc.ts` / `preload` / `useSave.ts` / `dataConverter.ts` 同步调整）
- 迁移数据库时不再静默覆盖目标目录已有的 `memo.db`，改为先加时间戳重命名备份（`db.ts`）
- 导入 JSON 备份后界面不再需要重启：改用 `_reload` 信号触发页面列表重载，且该信号不再混进应用设置（`App.vue` / `Settings.vue`）
- 导入备份按 `MAX_PAGES` 截断，`addPage` 直接复用返回值，省掉每轮多余的 `getPages` 往返（`dataConverter.ts`）
- `Ctrl+Alt+Z` 呼出窗口时不再顺带触发一次撤销：带 Alt 的组合不再进入本地快捷键处理（`App.vue`）
- `TopToolbar.vue` 的 `Page` 类型改为从 `types.ts` 导入，去掉第三份重复定义
- `preload/index.d.ts` 中 `addPage` 的返回类型修正为 `Page[] | null`（与实际实现一致）

### Changes

- **图片改为落盘存储**（`src/main/attachments.ts` 新增）：粘贴的图片写入数据库同级的 `attachments/` 目录，正文只保存 `notchpad://attachments/<文件名>` 引用，不再内联 base64。此前一张 5MB 截图会让单条记录膨胀到约 6.7MB，而 sql.js 每次落盘都是整库导出
  - 附件目录跟随数据库目录，`relocateDatabase` 会一并迁移附件
  - 相同内容按哈希命名，重复粘贴不会产生多份
  - 导出 JSON / Markdown 时自动把引用还原成内联 base64，备份保持自包含
  - 导入时自动把内联图片提取成附件文件
  - 启动后自动迁移历史数据中的内联图片，迁移前会留下 `memo.db.before-image-migration.bak` 备份
- 移除零引用的 `electron-updater`、`marked` 依赖，以及 electron-builder 中指向 `example.com` 的 publish 配置
- 删除残留的 `build.ps1`
- 移除 `window-all-closed` 监听（常驻托盘的应用不应随窗口关闭而退出）
- CSP 的 `img-src` 放行 `notchpad:`
- `useSave` 改为接收 getter 读取页面数据，`App.vue` 中为它手抄的 `pagesRef` / `currentIndexRef` 两份镜像 ref 及两个同步 `watch` 已移除
- `notch.ts` 的光标轮询改为按状态分频（收起 100ms / 展开 200ms），并用 `setTimeout` 递归取代固定间隔的 `setInterval`

### 验证状态

- ✅ `npm run typecheck`（tsc + vue-tsc）全部通过
- ✅ `npm run build` 通过：`out/main/index.js` 24.7 kB、`out/preload/index.js` 2.1 kB、`out/renderer` 资源 1.44 MB
- ✅ 实际运行验证（构建产物 + 独立临时 userData，未触碰真实数据）：
  - 窗口创建正常，`TOPMOST` / `LAYERED` / `TRANSPARENT`（鼠标穿透）均生效
  - 药丸正常渲染并压在浏览器窗口之上；0 页面时为绿色 `rgb(138,208,170)`，与 `notchColor` 逻辑一致
  - `PrintWindow` 抓取确认渲染内容完整，WebView 子窗口正常创建
- ⏳ 仍需人工验证（自动化不便覆盖）：`Ctrl+Alt+Z` 呼出、悬停展开/收起手感、图片粘贴、导出/导入

> 同机对照结论：Electron 版渲染完全正常。这反证了此前 Tauri spike 的黑屏出在 Tauri / windows-gnu 一侧，而非本机环境。

### 本机环境注意事项

- `pnpm install` 在本机沙箱下 link 阶段不完整（只有 scoped 包被链出，`vue` / `vite` / `typescript` 等非 scoped 包全部缺失），已改用 `npm install --ignore-scripts`（570 个包）完成
- Electron 二进制被 `--ignore-scripts` 跳过，需单独补：
  `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js`
- 直接以源码运行需清掉环境变量 `ELECTRON_RUN_AS_NODE`，并加 `--disable-gpu`（本机沙箱下 GPU 进程会崩溃）

## v1.1.0 (2026-06-02)

### Features
- 支持自定义数据库存储位置，可在设置中将数据迁移到其他目录
- 刘海药丸造型改为手机刘海风格（顶部齐平、底部圆润）
- Link Dialog 新增打开/关闭动画（AnimatePresence + 弹性动画）
- Link Dialog 遮罩和按钮颜色跟随强调色（--accent）
- 底部工具栏弹出菜单增加阴影层次感
- 链接支持左键点击直接跳转外部浏览器

### Fixes
- 内容区溢出时底部工具栏被挤出可视区域（min-height: 0 修复 flex 收缩）
- 弹出菜单（字体/颜色）被内容区右侧裁剪（overflow: visible 修复）
- Link Dialog 打开时刘海回收不会关闭弹窗
- 底部工具栏弹出菜单在刘海回收时未关闭
- 源码中多处中文乱码已修正（App.vue、useEditorSetup.ts、ipc.ts 等）
- 链接右键菜单无法识别 TipTap 渲染的子元素（closest('a') 修复）
