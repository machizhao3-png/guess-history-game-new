import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import {
  researchHistoricalFact,
  shouldUseResearchAgent,
} from "@/lib/ai/research-agent";
import {
  evaluateRuleBased,
  type HistoricalPerson,
} from "@/lib/ai/rule-evaluator";
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
> & HistoricalPerson;

export interface AnswerEvaluation {
  answer: AnswerType;
  source: "rule" | "anthropic" | "openrouter" | "research";
}

export class AiEvaluationError extends Error {
  constructor(
    public readonly code: "ai_not_configured" | "ai_request_failed",
    message: string,
  ) {
    super(message);
    this.name = "AiEvaluationError";
  }
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

function buildPrompt(content: string, secret: RoundSecret) {
  return `你是“猜历史人物”多人游戏的严格裁判。

当前游戏每轮选择的都是一位真实存在的中国古代历史人物。当前正确答案人物是 ${secret.character_name}。你知道这个人物是谁，必须基于历史常识和该人物的基本史实判断玩家问题。

秘密人物：
- 标准姓名：${secret.character_name}
- 可接受别名：${secret.character_aliases.join("、") || "无"}
- 参考摘要：${secret.character_summary || "无"}

玩家问题：${content}

判断规则：
1. 玩家明确猜出标准姓名或别名时，回答“猜对了”。
2. 对所有与人物有关的问题，优先根据 ${secret.character_name} 的历史常识判断。只要可以判断，就必须回答“是”或“不是”。
3. 不要因为问题简短、口语化，或参考摘要没有直接写出答案而回答“不确定”。
4. “不确定”只用于以下情况：问题表达模糊；问题与人物的关系无法判断；史料存在明显争议；你确实没有把握。
5. 对诗人、皇帝、官员、朝代、作品、战争经历、人物关系、改革家等问题，都应先依据历史常识判断，而不是默认回答“不确定”。
6. 问题与识别人物无关时，回答“无关”。
7. 不要解释答案，只返回规定答案。`;
}

async function evaluateWithOpenRouter(
  content: string,
  secret: RoundSecret,
): Promise<AnswerType> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AiEvaluationError("ai_not_configured", "OpenRouter API Key 未配置。");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "猜历史人物",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4",
      temperature: 0,
      max_tokens: 20,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "answer_evaluation",
          strict: true,
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
    }),
  });

  if (!response.ok) {
    throw new AiEvaluationError(
      "ai_request_failed",
      `OpenRouter 判断失败（${response.status}）。`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseAnswer(payload.choices?.[0]?.message?.content ?? "");
}

async function evaluateWithAnthropic(
  content: string,
  secret: RoundSecret,
): Promise<AnswerType> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiEvaluationError("ai_not_configured", "Anthropic API Key 未配置。");
  }

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

  return parseAnswer(textFromMessage(message.content));
}

export async function evaluateAnswer(
  content: string,
  secret: RoundSecret,
): Promise<AnswerEvaluation> {
  const ruleAnswer = evaluateRuleBased(content, secret);
  if (ruleAnswer) return { answer: ruleAnswer, source: "rule" };

  const provider = process.env.OPENROUTER_API_KEY ? "openrouter" : "anthropic";
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new AiEvaluationError(
      "ai_not_configured",
      "AI API Key 未配置，无法判断这个问题。",
    );
  }

  try {
    const answer =
      provider === "openrouter"
        ? await evaluateWithOpenRouter(content, secret)
        : await evaluateWithAnthropic(content, secret);
    if (
      answer === "不确定" &&
      shouldUseResearchAgent(content, secret)
    ) {
      const assistedAnswer = await researchHistoricalFact(content, secret);
      if (assistedAnswer) {
        return { answer: assistedAnswer, source: "research" };
      }
    }

    return {
      answer,
      source: provider,
    };
  } catch (error) {
    if (error instanceof AiEvaluationError) throw error;
    console.error(
      "AI answer evaluation failed.",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new AiEvaluationError(
      "ai_request_failed",
      "AI 判断失败，请稍后重试。",
    );
  }
}
