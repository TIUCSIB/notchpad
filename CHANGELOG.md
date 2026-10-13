# Changelog

## v1.4.7 (2026-10-13)

### Features

- **和风天气支持自定义 API Host**:2024 年后注册的和风账号使用控制台分配的专属 Host(形如 `xxx.re.qweatherapi.com`),公共域名对新 Key 无效;设置 → 彩蛋里可填入,留空走公共域名

### Fixes

- **展开态底部不再被截**:底部工具栏此前贴死窗口底边,窗口圆角(20px)裁掉了它的两角;现在底部留出安全边距,底栏完整浮在圆角之上
- **底部阴影减淡**:收起药丸投影减半(只留贴边定厚度),展开态全窗面板去掉投影 —— 浅色主题下不再有"圆角暗边挡内容"的观感
- **设置遮罩圆角对齐**:遮罩底部圆角由 12px 改为与窗口一致的 20px

## v1.4.6 (2026-10-13)

### Changes

- **药丸走马灯改为横向滑动**:切换内容时新文字从右滑入、旧文字向左滑出(原为淡入淡出);文字加粗提高可读性
- **一言分类改为下拉单选**:与"一言更新"同款下拉,含"默认(全部)"选项(不带分类参数),不再排满一屏按钮
- **彩蛋页 label 全部统一**:和风 Key 行去掉独有图标,与其他行同字号同基线

## v1.4.5 (2026-10-13)

### Fixes

- **药丸显示内容不可见**:文字元素此前放在 `.panel` 容器内,而收起态 CSS 把整个 `.panel` 设为 `opacity: 0`,导致时钟/一言/天气/自定义文字永远不显示;已将文字移出该容器,收起态正常可见
- 彩蛋页布局:一言"分类/城市/天气更新"等小标签字号与其他行统一(13px),分类按钮尺寸与标准控件对齐,右对齐排列不再拥挤错位

## v1.4.4 (2026-10-13)

### Fixes

- **下拉选项延伸出窗口时不再误收起**:设置/搜索/链接等弹层打开期间暂停“光标离开即收起”判定(原生 select 的下拉菜单可能超出窗口边界,光标移到选项上会被误判为离开)
- **设置 Tab 栏固定顶部**:内容滚动时 Tab 栏 sticky 不跟随
- **彩蛋 Tab 与关于页**:移除彩蛋页顶部多余分割线;关于页新增“当前版本”行(显示版本号)
- **药丸显示补上“天气”按钮**:此前药丸显示列表漏了天气选项,导致和风天气配置隐藏

## v1.4.3 (2026-10-13)

### Features

- **一言接入 hitokoto 在线 API**:支持按分类筛选(动画/漫画/游戏/文学/原创/诗词/哲学等,可多选),更新频率可选每 5 分钟/30 分钟/3 小时/每天/每次收起/仅启用时,也可切回**本地语录**(每日常换,永不联网)
- **天气显示(和风天气)**:填入和风开发者 Key 与城市名,药丸轮播当前气温与天气;更新频率可选 30 分钟/1 小时/3 小时/每天/仅启用时
- 网络失败自动静默回落:一言拉取失败保留当前内容(初始为本地语录),不影响其他轮播项

### 说明

- 应用内检查更新:v1.4.2 起可用

## v1.4.2 (2026-10-13)

### Features

- **回收站**:设置页新增"回收站"入口,展示最近 24 小时内删除的页面(标题摘要 + 删除时间),一键恢复;错过 5 秒撤销 toast 也不再需要碰数据库

### Fixes

- **撤销恢复后页面内容显示错位**:删非末页后自动选中下一页,撤销恢复的页面常落回同一索引,`selectPage` 的同索引守卫跳过加载,编辑器停留在下一页内容上,后续自动保存还会把该内容写进恢复页的行;现在撤销时先重置索引强制重载,删除前先 flush 自动保存
- **收起刘海时撤销 toast 残留**:鼠标离开窗口触发收起后,toast 还挂在 5 秒倒计时里;现在收起时立即隐藏
- 软删除暂存从 10 分钟延长到 24 小时,与回收站窗口一致

## v1.4.1 (2026-10-13)

### Features

- **应用内自动更新**：设置页新增“检查更新”，发现新版本自动下载并一键重启升级（`tauri-plugin-updater`，更新包经 minisign 签名校验）
- **跨页搜索**：`Ctrl+F` 唤起全局搜索面板，所有页面按标题/正文匹配，展示摘录、↑↓ 切换、Enter 打开
- **删页可撤销**：删除页面后底部弹 5 秒撤销 toast；页面在数据库软删除暂存 10 分钟，期间可恢复（启动/删除时自动清过期暂存）
- **每日自动备份**：启动时把数据库备份到 `backups/` 目录，按日期命名，保留最近 7 份
- **页数上限可设置**（3~30 页，原先写死 10），导入备份的截断上限跟随该设置
- **图片点击放大预览**、**拖拽图片文件到编辑器直接插入**
- **附件清理体验**：清理前先 flush 自动保存（引用即最新），新增豁免窗口从 10 分钟缩短到 2 分钟；设置页展示附件目录占用（文件数/体积）；启动时自动静默清理一次孤儿附件

### Fixes

- **粘贴图片压缩策略**：GIF 原样存（不再丢动画）、带透明通道的 PNG 原样存（不再转 JPEG 黑底）、小于 256KB 的图不压缩，只对照片类大图缩放转 JPEG
- **Markdown 导出补全任务列表语法**（`- [ ]` / `- [x]`）

### 其他

- 前端引入 Vitest（`pnpm test`）,Markdown 转换与保存基线规则已有回归用例

## v1.4.0 (2026-10-12)

### Features

- **移除 Electron 版,全面转向 Tauri**:删除 `src/main` / `src/preload` / electron-vite / electron-builder / `build/` / `resources/` 及相关脚本与配置,`better-sqlite3` 依赖随之下架(后端已是 rusqlite);`pnpm dev` 现在就是 `tauri dev`,打包走 `pnpm tauri:build`。`window.api` 的全局类型声明随 preload 一并移除,迁入渲染层 `api/bridge.ts`
- **图片附件在 Tauri Windows 版全面修复**:此前粘贴/导入写入的 `notchpad://` 引用、CSP 允许的源、自定义协议的实际形式(`http://notchpad.localhost`)三方不一致,图片全碎且一次性迁移标志导致永不自愈。现在 `save_attachment` 由后端按平台返回完整 URL(`attachments.rs` 的 `attachment_url`),渲染层粘贴/导入统一使用;导出备份的正则兼容两种引用形式,自包含备份恢复有效;两份 CSP(`tauri.conf.json` + `index.html`)的 img-src 对齐
- **自动保存基线跨页共享导致可能丢字**:`useSave` 的 `lastSavedHtml` 是全局单例,新页面编辑出的 HTML 恰好等于上一页的基线时会误判"未变化"跳过保存,重启后内容回退;改为按页用自身已保存内容(`page.content`)作基线
- **迁移数据库失败不再"变砖"**:`relocate_inner` 原先先关库再拷贝,任一步失败后 `db` 留在 None,后续所有命令 panic;现在全程不关库(持有 db 锁期间无并发写入,拷贝是一致的),失败时原连接原封不动。所有 `lock().unwrap()` 换成 Mutex 中毒可恢复的写法(`db.rs` 的 `lock_db` / `lock_db_path`)
- **渲染层异常时 4s 兜底亮窗**(对齐 Electron 版行为):`renderer_ready` 迟迟不来就强制显示窗口,不再永远隐形
- **导入备份超出上限时如实提示**跳过的页数(`dataConverter.ts` / `Settings.vue`)

### Fixes

- 置顶页面 / 导出备份前先 flush 自动保存防抖:置顶会按数据库内容重置编辑器,导出读的是数据库,防抖窗口内未落库的编辑此前会被覆盖或漏出(`useSave.flushSave` 返回 promise,`usePages.togglePinPage` 先 await)
- 设置面板回传的设置按 `SETTINGS_DEFAULTS` 白名单过滤,`displayName` / `tauriUrlMigrated` 等后端内部键不再混入应用设置(`App.vue`)

## v1.3.2 (2026-10-11)

### Features

- **每个页面记住自己上次的滚动位置**:切走时记录、切回来恢复,长文切走再切回不用重新往下找;没访问过的页从顶部开始（`usePages.ts` / `App.vue`）。光标恢复暂不支持,切页后光标仍落在开头

## v1.3.1 (2026-10-11)

### Fixes

- **切换页面后总是滚动到最后一行**:切页的 `focus()` 不带参数会把光标放到文档末尾,ProseMirror 随之滚动到光标处,把"切页回到顶部"顶掉。现在切页后光标定位到文档开头,滚动位置自然在顶部（`usePages.ts`）

## v1.3.0 (2026-10-11)

### Features

- **新增 Tauri 2 版本**：主进程用 Rust 重写——rusqlite 数据库、附件自定义协议、刘海光标轮询、托盘、全局快捷键、单实例、多显示器、开机自启全部移植；渲染层 Vue + Tiptap **100% 复用**,经 `window.api` 兼容桥零改动接入（`src-tauri/` / `src/renderer/src/api/bridge.ts`）。安装包 103MB → 3.4MB
- 数据目录与 Electron 版完全对齐（`%APPDATA%/notchpad`）,现有 memo.db 与 attachments 直接沿用,零迁移
- 构建工具链强制 `x86_64-pc-windows-msvc`（机器默认的 windows-gnu 曾导致 Tauri 渲染黑屏）,配置固化在 `src-tauri/rust-toolchain.toml`

### 实测说明

- 与 Electron 版共享同一渲染层,内存占用相当:空闲私有内存 ~185MB vs ~197MB,重负载后都会到 400-500MB——大头在 Web 渲染引擎本身（Tiptap + 透明窗口 + 动画）,换壳不减这部分;空闲状态经 90 秒采样验证完全稳定,无泄漏
- Electron 版代码保留在仓库仍可构建,作为回退选项

## v1.2.0 (2026-10-11)

### Fixes

- **刘海药丸的命中区域不再依赖主进程写死的 72×14 常量**：渲染层把药丸的目标尺寸（72/84 × 14/18,源自 `useNotch` 的 `panelAnimate`,悬浮放大、样式调整都会跟着变）经新增的 `update-pill-size` 通道上报（`App.vue` / `preload` / `ipc.ts` / `notch.ts`）。此前药丸悬浮放大到 84×18 时主进程的判定区域仍是 72×14,click 唤醒模式下光标落在外圈会把窗口重新设为鼠标穿透,药丸视觉上卡在放大态。注意上报的是**目标尺寸**而不是 ResizeObserver 实测——实测会采到收起动画的中间帧,把主进程命中区域撑成几百像素宽,表现为"鼠标离开很远面板都收不回去"（第一版实现踩过这个坑）；展开态不上报,主进程沿用上一次药丸尺寸
- **`TopToolbar.vue` 标题超长钳制从未生效**：`onTitleInput` 里把 `composing` ref 直接当布尔值用（恒为真），正常输入路径永远提前 return，超过 `TITLE_MAX_LENGTH` 不会被截断。改为 `composing.value`
- `update-page` / `update-page-title` / `reorder-pages` / `delete-page` 补上数据库未初始化时的空值防护，去掉 `getDb()!` 非空断言；`delete-page` 返回是否删除成功，渲染层据此同步本地列表（`ipc.ts` / `usePages.ts`）
- **修复 `pnpm-workspace.yaml` 的 `allowBuilds` 留着 pnpm 生成的占位文本**（`electron: set this to true or false` 被原样当配置值），导致白名单失效：全新安装后 electron 二进制不会被下载、esbuild 构建脚本被拦。现在 `electron` / `esbuild` 显式允许、`electron-winstaller` 显式忽略（`pnpm-workspace.yaml`）
- `togglePinPage` 里的 `setContent(content, false)` 是 Tiptap 2 的旧签名，改为 Tiptap 3 的 `{ emitUpdate: false }`（`usePages.ts`，此前被 `any` 类型掩盖）
- **撤销不再跨页、不再一步退两格**：切页的 `setContent` 事务原本会进撤销栈，在新页面按 `Ctrl+Z` 会把上一个页面的内容"撤"出来，自动保存随后将其写进当前页面造成数据错乱；现在切页时按 prosemirror-history 的 meta 约定整体替换为全新空栈（`usePages.ts`）。同时全局 `Ctrl+Z` / `Ctrl+Y` 与 Tiptap 内置键位此前会各执行一次（一步退两格），现在编辑器聚焦时交给 Tiptap、焦点在输入框时交给原生 undo，各自只执行一次（`App.vue`）
- **滚动位置不再跨页共享**：所有页面共用同一个滚动容器，切页只换内容不重置 `scrollTop`；现在切页即回到顶部（`App.vue`）

### Changes

- **冷启动亮窗改为事件驱动 + 首展开预热**：窗口以 opacity 0 显示，渲染层画完第一帧经新增的 `renderer-ready` 通道上报后才亮出，替代写死的 100ms 等待——机器快不白等、机器慢不白闪，渲染层异常时 2s 兜底强制显示；托盘恢复等热路径（渲染层早已画好）不再走隐形等待，直接亮出（`notch.ts` / `ipc.ts` / `preload` / `App.vue`）。亮窗前渲染层还会趁看不见用零时长动画把"展开→收起"完整彩排一遍（`useNotch.warmUpFirstExpand`），全尺寸布局、首次绘制、GPU 瓦片与动画管线都在隐形期备好——"第一次悬浮展开顿一下、后续都顺"的冷启动开销由此消除
- **展开/收起动画的 blur 质感保留**：曾因"首次悬浮展开顿一下"移除过（GPU 模糊 shader 首次编译的一次性卡顿），后由启动预热在隐形期消化该成本,按用户反馈恢复质感（`App.css`）
- **收起判定边距从 40px 收紧到 10px**：光标离开窗口边缘 10px 即收回面板,不再出现"明明已经离开很远却迟迟不收"（`notch.ts`;只留极小滞回防边缘抖动,收回后仍需触碰药丸才会展开,不存在边缘抖动引发的收展循环）
- **存储层从 sql.js 迁移到 better-sqlite3**（`db.ts` 重写）：同步原生 SQLite,每条写入即时落盘,移除"整库驻内存 + 500ms 防抖全量导出重写文件"的模型,`saveDatabase` / `saveDatabaseImmediate` 随之删除,调用方不再关心刷盘。文件格式不变,现有 `memo.db` 直接打开,无需数据迁移。`pnpm-workspace.yaml` 放行其构建脚本,`electron-builder.yml` 白名单换为 better-sqlite3(+`bindings` / `file-uri-to-path`)并新增 `asarUnpack`;移除 sql.js 依赖。编辑器侧 600ms 的自动保存防抖不变（合并的只是 IPC,不再合并磁盘写）
- 编辑器 ref 从 `any` 改为 `Editor | undefined` 正式类型，`useSave` / `usePages` / `useNotch` 签名同步收紧；`App.vue` 的 `tempEditor` 改用 `shallowRef`（`Editor` 会被 deep ref 的 `UnwrapRef` 炸出巨型类型，Tiptap 官方也推荐 shallow）
- `jelly.ts` 的监听器挂载从 `(el as any).__jellyListeners` 改为模块级 `WeakMap`，去掉三处 `any`
- `eslint.config.mjs` 给 `no-unused-vars` 加 `^_` 忽略规则，与代码里 `_e` / `_y` 的既有命名意图一致
- 新增 `.gitattributes`（`* text=auto eol=lf` + 常见二进制类型），落实 AGENTS.md 的 LF 约定；工作区按 prettier 规范做了一次全量格式对齐（`eslint --fix`，纯格式无逻辑变化），`pnpm lint` 从 12 error / 3174 warning 清零
- README 修正错别字：「刚海」→「刘海」、「静宛忽略」→「将被忽略」
- `package.json` 用 Prettier 统一格式（此前是异常的大缩进）

### 验证状态

- ✅ `pnpm typecheck`（tsc + vue-tsc）通过
- ✅ `pnpm lint` 通过：0 error / 0 warning
- ✅ `pnpm build` 通过（含 typecheck + electron-vite 三端构建）
- ✅ dev 实测：better-sqlite3 在 Electron 39 下正常加载,现有 memo.db（约 30MB）直接打开无损坏告警,页面正常读写
- ⏳ 仍需人工验证：悬浮 / 点击唤醒的手感（命中区域现在按实测尺寸判定，边角行为可能有细微变化）、IME 输入法下编辑标题的行为、设置里的数据迁移 / 导入导出（better-sqlite3 后首次覆盖)

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
