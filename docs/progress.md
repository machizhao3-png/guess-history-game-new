# 项目开发进度

## 项目信息

**项目名称**：猜历史人物  
**技术栈**：Next.js 16 + Supabase + Claude API + Vercel  
**最后更新**：2026-06-15

---

## 已完成工作

### 1. 项目初始化
- ✅ 使用 `create-next-app` 创建 Next.js 16 项目
- ✅ 配置 TypeScript 严格模式
- ✅ 集成 Tailwind CSS v4
- ✅ 配置 ESLint 9（flat config 格式）
- ✅ Git 仓库初始化

### 2. 项目文档
- ✅ 创建 `CLAUDE.md` - 项目开发指南
- ✅ 创建 `AGENTS.md` - Next.js 16 注意事项
- ✅ 创建完整的实现计划文档（`.claude/plans/hazy-stirring-cascade.md`）

### 3. 技术调研
- ✅ 研读 Next.js 16 官方文档（App Router、Server Components、API Routes）
- ✅ 确认 Next.js 16 关键变更：
  - `params` 现在是 Promise（必须 await）
  - Turbopack 成为默认打包工具
  - middleware.ts 改名为 proxy.ts
  - 最低要求 Node.js 20.9+

### 4. MVP 实现
- ✅ 安装 Supabase SSR、Supabase JS 与 Anthropic SDK
- ✅ 完成数据库 schema、RLS 与 Realtime 配置
- ✅ 将秘密人物隔离到仅服务端可读的 `round_secrets` 表
- ✅ 完成玩家本地身份（emoji + 昵称）
- ✅ 完成游戏大厅、历史人物列表与演示模式
- ✅ 完成问答时间线、提问栏、实时订阅与猜中结果弹窗
- ✅ 完成 `/api/new-game` 与 `/api/ask`
- ✅ ESLint、TypeScript 与生产构建通过

---

## 当前开发计划

### 架构设计

**前端**：
- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS v4（浅黄色主题）
- 响应式设计（移动端优先）

**后端**：
- Supabase PostgreSQL（数据存储）
- Supabase Realtime（实时同步）
- Claude API（AI 裁判）

**部署**：
- Vercel（前端托管）
- Supabase Cloud（数据库）

### 数据库设计

**games 表**：
- `id` (uuid)
- `slug` (text) - 游戏房间标识
- `status` (text) - active/archived
- `created_at` (timestamp)

**rounds 表**：
- `id` (uuid)
- `game_id` (uuid, foreign key)
- `revealed_name` (text) - 结束后才公开的人物姓名
- `status` (text) - creating/active/completed/failed
- `total_questions` (int)
- `created_at` (timestamp)

**round_secrets 表**（仅服务端访问）：
- `round_id` (uuid, foreign key)
- `character_name` (text) - AI 选择的秘密人物

**questions 表**：
- `id` (uuid)
- `round_id` (uuid, foreign key)
- `content` (text) - 提问内容
- `answer` (text) - 是/不是/不确定/无关/猜对了
- `asked_by_nickname` (text)
- `asked_by_emoji` (text)
- `order_num` (int) - 问题序号
- `created_at` (timestamp)

### 页面结构

**页面**：
1. `/` - 主页（游戏大厅）
2. `/game` - 问答页（实时问答）

**弹窗**：
1. 入场弹窗（首次访问：选择 emoji + 昵称）
2. 历史问答弹窗（查看已猜出人物的问答记录）
3. 猜对结果弹窗（显示胜利信息）

### API 路由

1. `POST /api/new-game` - 创建新游戏（AI 随机选人物）
2. `POST /api/ask` - 提交问题（AI 判定 + 写入数据库）

### 核心功能

1. **用户身份**：emoji + 昵称（localStorage，无需登录）
2. **实时同步**：所有玩家看到相同的游戏状态和问答列表
3. **AI 裁判**：仅回复 5 种答案（是/不是/不确定/无关/猜对了）
   - 对可由人物生平明确判断的问题，优先回复“是”或“不是”
   - 仅在问题模糊、史实有争议或无法确认时回复“不确定”
   - 当前不接入网络搜索，后续可增加 web-assisted evaluation
4. **竞态控制**：用户提问后等待 AI 回复完成才显示问答条目
5. **人物去重**：AI 选择新人物时避开历史已猜出的人物

---

## 下一步待办事项

### Phase 1: 环境配置
- [x] 安装依赖：`@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`
- [ ] 创建 Supabase 项目
- [ ] 在 Supabase SQL Editor 中执行数据库 schema
- [ ] 配置 `.env.local` 文件（Supabase URL/Key + Anthropic API Key）

### Phase 2: 基础设施
- [x] 创建 `lib/types.ts`（TypeScript 接口定义）
- [x] 创建 `lib/supabase/client.ts`（浏览器端客户端）
- [x] 创建 `lib/supabase/server.ts`（服务端客户端）
- [x] 创建 `lib/constants.ts`（emoji 列表 + AI prompt）
- [x] 创建 `lib/storage.ts`（localStorage 工具函数）

### Phase 3: API 路由
- [x] 实现 `app/api/new-game/route.ts`
- [x] 实现 `app/api/ask/route.ts`

### Phase 4: 组件开发
- [x] EntryModal - 入场弹窗
- [ ] GameCard - 主页"?"卡片
- [ ] PlayerStats - 顶部统计栏
- [ ] GuessedList - 已猜出人物列表
- [ ] HistoryModal - 历史问答弹窗
- [ ] Timeline - 问答时间线容器
- [ ] TimelineItem - 单条问答条目
- [ ] InputBar - 问题输入栏
- [x] ResultModal - 猜对结果弹窗

### Phase 5: 页面开发
- [x] 重构 `app/page.tsx`（主页）
- [x] 创建 `app/game/page.tsx`（问答页）
- [x] 实现 Supabase Realtime 订阅逻辑
- [x] 优化 `app/globals.css`（浅黄色主题）

### Phase 6: 测试与优化
- [ ] 多浏览器标签页测试实时同步
- [ ] 移动端响应式测试
- [ ] 竞态条件测试
- [ ] 性能优化（Server Components 分离）

### Phase 7: 部署
- [ ] 配置 Vercel 环境变量
- [ ] 部署到 Vercel
- [ ] 验证生产环境功能

---

## 技术注意事项

1. **Next.js 16**：所有 `params` 必须 `await` 才能访问
2. **Supabase Realtime**：需在 SQL 中执行 `ALTER PUBLICATION` 启用实时订阅
3. **AI Prompt**：必须严格限制 AI 只回复 5 种答案之一，并避免滥用“不确定”
4. **竞态控制**：使用 `order_num` 字段保证问答顺序，而非 `created_at`
5. **移动端优先**：所有组件从移动端布局开始设计

---

## 参考文档

- 实现计划：`.claude/plans/hazy-stirring-cascade.md`
- Next.js 16 文档：`node_modules/next/dist/docs/`
- PRD 文档：已完整解析并纳入计划
