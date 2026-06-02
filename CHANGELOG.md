# Changelog

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
