# 猜历史人物

多人共享的历史人物问答游戏。AI 每局选择一位历史人物，所有玩家围绕同一个人物提问。AI 只能用“是 / 不是 / 不确定 / 无关 / 猜对了”回答玩家问题。

AI 会优先根据明确史实回答“是”或“不是”。只有问题模糊、无法明确判断、史实存在争议或无法确认时，才回答“不确定”；与人物判断无关的问题回答“无关”，直接猜中姓名则回答“猜对了”。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

未填写环境变量时，页面会自动进入演示模式，可体验入场、时间线和猜中流程。

## 云服务配置

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 将 Supabase URL、anon key、service role key 和 Anthropic API key 填入 `.env.local`。
3. 重启开发服务器。

`round_secrets` 表不开放公开读取；人物姓名只在游戏结束后写入公开的 `rounds.revealed_name`。

## 命令

```bash
npm run lint
npm run build
npm run start
```
