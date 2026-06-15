import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import type { AnswerType, TableRow } from "@/lib/database.types";

const VALID_ANSWERS = [
  "是",
  "不是",
  "不确定",
  "无关",
  "猜对了",
] as const satisfies readonly AnswerType[];

type RoundSecret = Pick<
  TableRow<"round_secrets">,
  | "character_name"
  | "character_aliases"
  | "character_summary"
>;

export interface AnswerEvaluation {
  answer: AnswerType;
  source: "anthropic" | "mock";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s，。！？、,.!?；;：“”"'《》【】()[\]{}]/g, "");
}

function isValidAnswer(value: unknown): value is AnswerType {
  return (
    typeof value === "string" &&
    VALID_ANSWERS.includes(value as AnswerType)
  );
}

function textFromMessage(content: Message["content"]) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function parseAnswer(raw: string): AnswerType {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "answer" in parsed &&
      isValidAnswer((parsed as { answer?: unknown }).answer)
    ) {
      return (parsed as { answer: AnswerType }).answer;
    }
  } catch {
    // Older models may ignore structured output and return plain text.
  }

  const normalized = raw.trim().replace(/[“”"'。！!，,\s]/g, "");
  return isValidAnswer(normalized) ? normalized : "不确定";
}

function looksLikeDirectGuess(content: string, secret: RoundSecret) {
  const normalized = normalizeText(content);
  const names = [secret.character_name, ...secret.character_aliases]
    .map(normalizeText)
    .filter(Boolean);

  return names.some(
    (name) =>
      normalized === name ||
      normalized === `是${name}吗` ||
      normalized === `是不是${name}` ||
      normalized === `我猜${name}` ||
      normalized === `答案是${name}`,
  );
}

function evaluateWithMock(
  content: string,
  secret: RoundSecret,
): AnswerType {
  const normalized = normalizeText(content);

  if (looksLikeDirectGuess(content, secret)) return "猜对了";
  if (/(吃什么|天气|股票|足球|电影)/.test(normalized)) return "无关";
  if (/(男性|男的吗|男人)/.test(normalized)) return "不是";
  if (/(女性|女的吗|女人)/.test(normalized)) return "是";
  if (/(唐代|唐朝|皇帝|武将)/.test(normalized)) return "不是";
  if (/(中国|宋代|宋朝|文学|诗词|词人)/.test(normalized)) return "是";
  return "不确定";
}

function buildPrompt(content: string, secret: RoundSecret) {
  return `你是“猜历史人物”多人游戏的严格裁判。

秘密人物：
- 标准姓名：${secret.character_name}
- 可接受别名：${secret.character_aliases.join("、") || "无"}
- 参考摘要：${secret.character_summary || "无"}

玩家问题：${content}

判断规则：
1. 玩家明确猜出标准姓名或别名时，回答“猜对了”。
2. 根据可靠历史事实可以确定为真时，回答“是”。
3. 根据可靠历史事实可以确定为假时，回答“不是”。
4. 资料不足、表述含糊或存在争议时，回答“不确定”。
5. 问题与识别人物无关时，回答“无关”。
6. 不要解释答案。`;
}

export async function evaluateAnswer(
  content: string,
  secret: RoundSecret,
): Promise<AnswerEvaluation> {
  if (looksLikeDirectGuess(content, secret)) {
    return { answer: "猜对了", source: "mock" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { answer: evaluateWithMock(content, secret), source: "mock" };
  }

  try {
    const anthropic = new Anthropic({
      apiKey,
      maxRetries: 1,
      timeout: 12_000,
    });
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 40,
      temperature: 0,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              answer: { type: "string", enum: VALID_ANSWERS },
            },
            required: ["answer"],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: "user", content: buildPrompt(content, secret) }],
    });

    return {
      answer: parseAnswer(textFromMessage(message.content)),
      source: "anthropic",
    };
  } catch (error) {
    console.warn(
      "Anthropic answer evaluation failed; using local fallback.",
      error instanceof Error ? error.message : "unknown error",
    );
    return { answer: evaluateWithMock(content, secret), source: "mock" };
  }
}
