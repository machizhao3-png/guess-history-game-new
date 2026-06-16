# 猜历史人物

多人共享的历史人物问答游戏。AI 每局选择一位历史人物，所有玩家围绕同一个人物提问。AI 只能用“是 / 不是 / 不确定 / 无关 / 猜对了”回答玩家问题。

AI 会优先根据明确史实回答“是”或“不是”。只有问题模糊、无法明确判断、史实存在争议或无法确认时，才回答“不确定”；与人物判断无关的问题回答“无关”，直接猜中姓名则回答“猜对了”。

## 本地运行

需要 Node.js 20.9 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。

未填写环境变量时，页面会自动进入演示模式，可体验入场、时间线和猜中流程。演示模式不会连接 Supabase，也不会调用真实 AI API。

## 环境变量

复制 `.env.example` 到 `.env.local` 后填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
HISTORICAL_RESEARCH_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`、`ANTHROPIC_API_KEY` 和 `HISTORICAL_RESEARCH_API_KEY` 只应配置在服务端环境变量中，不要写进前端代码或提交到 Git。项目的 `.gitignore` 会忽略 `.env.local`。

## Supabase 配置

1. 新建 Supabase 项目。
2. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
3. 将 Project URL 填入 `NEXT_PUBLIC_SUPABASE_URL`。
4. 将 anon public key 填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
5. 将 service role key 填入 `SUPABASE_SERVICE_ROLE_KEY`。
6. 重启开发服务器。

`round_secrets` 表不开放公开读取；人物姓名只在游戏结束后写入公开的 `rounds.revealed_name`。

Realtime 已在 `supabase/schema.sql` 中把 `games`、`rounds`、`questions` 和 `guessed_people` 加入 publication。若本地页面没有实时更新，先确认 SQL 已完整执行。

## Anthropic 配置

1. 将 Anthropic API Key 填入 `ANTHROPIC_API_KEY`。
2. `ANTHROPIC_MODEL` 默认使用 `claude-sonnet-4-6`，可按需要替换。
3. 未配置 `ANTHROPIC_API_KEY` 时，后端仍可运行，但回答会使用本地 rule/mock fallback。

Research Agent 当前只保留接口位置，不会执行真实网络搜索；`HISTORICAL_RESEARCH_API_KEY` 目前可以留空。

## Vercel 部署

1. 将仓库导入 Vercel，Framework Preset 选择 Next.js。
2. Build Command 使用默认 `npm run build`。
3. 在 Vercel Project Settings → Environment Variables 中配置：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL`
   - `HISTORICAL_RESEARCH_API_KEY`（可留空）
4. 先在 Preview 环境验证首页、问答页、提交问题、猜中弹窗和 Realtime 同步，再发布 Production。

不要在 Vercel 或 GitHub 中提交 `.env.local`。service role key 和 Anthropic key 只放在 Vercel 环境变量里。

## 命令

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run start
```
