# GPUI 版设置面板(M4)— 实施计划

## Context

notchpad-gpui 的最后一块大件是设置面板。Tauri 参照版 Settings.vue(783 行)的五 Tab 为:**通用 / 数据 / 快捷键 / 彩蛋 / 关于**(药丸设置在"彩蛋",回收站在"数据")。设置面板在 Tauri 版中就渲染于主窗口内(遮罩 + 320px 面板叠加,遮罩底部圆角与展开窗口一致),因此 GPUI 版同样在主窗口内叠层实现——**不碰 notch.rs、不开新窗口**,避开 `find_own_window` 误判与全部窗口样式坑。

现状要点:`AppSettings`(ui.rs:139-170)是启动快照、无回写路径;⚙ 挂点在 ui.rs:840 空壳;收起轮询在 main.rs:242;数据 Tab 后端已有回收站三函数/附件清理/`db_path`,缺迁移与导出导入。

## 设计决策

1. **承载**:主窗口 `NotchView` 内叠 absolute 设置层(遮罩全窗 + 320px 面板居中,top 20px,max 高 364-56=308,内容 `overflow_y_scroll`)。点面板外关闭(窗口级 `on_mouse_down` + 面板 bounds 坐标判断,实施时若 `.occlude()` 可行则用之);无 ESC。
2. **状态**:新 Global `SettingsUi { open, tab, saved_toast: Option<Instant>, open_dropdown: Option<Id>, trash_pages: Vec<…>, trash_expanded, inputs: 各 InputState 实体 }`,放新文件 `src/settings_ui.rs`(预计 1200+ 行,避免 ui.rs 再膨胀)。
3. **收起豁免**:`NotchGlobal` 或 `SettingsUi.open` 为 true 时,main.rs:242 的"鼠标移出即收起"跳过(对齐 Tauri `setCollapsePause`);关闭设置仅靠点击遮罩。
4. **回写链路**:`AppSettings::set(key, value, &store)` = `set_setting_kv` 落库 + 更新 map + 重解析派生字段 → 调用方 `cx.refresh_windows()`。新增派生字段:`accent: u32`(accentColor hex 解析,非法回退 `#4ade80`)、`font_size: f32`。
5. **即时生效**(refresh 后自动):theme/wakeMode/maxPages/pillSources/pillCustomText 已有消费点;**accentColor 需把 Palette 的 accent 系字段动态化**——新增 `current_palette(cx) -> Palette` 辅助(在 `palette(light)` 基础上用设置覆盖 accent 及其派生色),替换 ui.rs 现有 5-8 处 `palette()` 调用点。
6. **控件全部自绘**(不用未验证的 gpui-component Switch/Select/Popover,保持 1:1 视觉):按钮组(theme-btn,active 填 accent)、18px 色点组、36×20 开关滑块、下拉(点击展开 absolute 选项列表,参照 TitleEdit 浮层手法,`SettingsUi.open_dropdown` 记录,点选/点外关闭)、文本输入用已验证的 `InputState/Input`、面板内 1.2s 自绘 toast("已保存")。
7. **范围裁定**(未收到答复,按推荐默认):数据 Tab 全量(含 rfd 对话框);检查更新为占位按钮(toast"功能开发中");`theme=system` 选项保留但暂按深色渲染;在线一言/天气仅落库不消费(网络功能后续);defaultFontSize 落库,若 EditorState 无字号 API 则标注限制不强行自绘。

## 实施步骤(4 个 commit)

**C1 — 骨架 + 通用/快捷键/关于 Tab**
- `src/settings_ui.rs` 新建:`SettingsUi` Global、`render_settings()`(遮罩/面板/Tab 栏/行布局 `setting_row`/自绘 toast)、五个 Tab 骨架。
- 通用 Tab 6 项:theme(3 按钮组)、accentColor(7 色点)、defaultFontSize 下拉(12/14/16/18/20/24/28/32px)、maxPages 下拉(3/5/10/15/20/30)、autoStart 开关、wakeMode(2 按钮组)。快捷键 Tab 静态 12 条。关于 Tab:版本 `env!("CARGO_PKG_VERSION")`、检查更新占位、重置按钮(清空 settings 表 + 重置 AppSettings + 禁自启 + toast)。
- `AppSettings::set` + 新派生字段;⚙ 挂点接通(打开时刷新回收站缓存);main.rs 轮询豁免。

**C2 — 彩蛋 Tab**
- pillSources 多选按钮组(clock/quote/weather/custom,Set 逻辑:先删 off,全空存 `off`)+ 三级条件联动:pillCustomText 输入、quoteSource 按钮组、quoteInterval/quoteCategories 下拉、weatherApiKey/Host/City 输入、weatherInterval 下拉。

**C3 — 数据 Tab + autoStart**
- 回收站:展开/收起按钮(`最近 24 小时 (N)`)、180px 滚动列表(标题 `「前8字」`/`空白页` + `{deleted_at} · 40字摘录`)、恢复按钮 + toast;附件清理(统计 `N 个文件 / X KB|MB` + 清理按钮);存储位置只读展示 + `更改`(rfd 目录选择 → relocate)。
- 导出 JSON/Markdown、导入 JSON(rfd 文件对话框;导入逻辑抄 Tauri dataConverter.ts:上限截断 + toast 统计 + 重载页面列表);操作前先 flushSave(dirty 落库)。
- `store.rs`:`relocate_db`(抄 Tauri db.rs:关连接→搬文件→写 `db-config.json`→重开→搬附件目录)、`reset_settings`;`Cargo.toml` 加 `rfd` 与 windows `Win32_System_Registry` feature;`src/autostart.rs` 新建(HKCU `...\CurrentVersion\Run` 键,set_setting autoStart 时同步)。

**C4 — 图标 + 收尾**
- `assets/icons/` 补 ~15 个 lucide svg(monitor/palette/type/files/power/mouse-pointer-click/folder-open/download/upload/eraser/refresh-cw/text-cursor-input/keyboard/info/rotate-ccw),path 从 lucide 官方(MIT)拷贝;清理警告,视觉微调对齐。

## 关键文件

- 改:`src/ui.rs`(AppSettings 扩展、⚙ 挂点、palette 动态化、渲染接 settings_ui)、`src/main.rs`(轮询豁免)、`src/store.rs`、`Cargo.toml`
- 新:`src/settings_ui.rs`、`src/autostart.rs`、`assets/icons/*.svg`
- 复用:`set_setting_kv`/`get_settings`(store.rs:166,173,358)、`list_deleted_pages`/`restore_deleted_page`/`purge_expired_deleted`(store.rs:231-281)、`clean_attachments_impl`/`dir_stats`(attachments.rs:154-207)、`db_path`(store.rs:378)、Input 浮层模式(ui.rs:601-634)、toast/absolute 叠层模式(ui.rs:941-1008)

## 验证

1. `cargo build` 无警告;`cargo run` 手测:⚙ 打开/遮罩关闭、五 Tab 切换、打开设置时鼠标移出窗口不收起、改 theme/accent 即时变色、下拉/开关/输入逐项改后查 `settings` 表(或重启验证持久化)、与 Tauri 版同库互读。
2. 回收站:删页→列表出现→恢复;附件清理、重置回默认、开机自启注册表键检查(`reg query HKCU\...\Run`)。
3. `flow-test.ps1` 回归:药丸/展开/收起/穿透不受影响。
4. 已知限制随交付说明:检查更新占位、system 主题暂按深色、在线一言/天气仅落库、Editor 字号视 API 支持情况。