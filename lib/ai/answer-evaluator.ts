import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import {
  researchHistoricalFact,
  shouldUseResearchAgent,
} from "@/lib/ai/research-agent";
import {
  evaluateRuleBased,
  normalizeQuestion,
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
  source: "rule" | "anthropic" | "research" | "mock";
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

function evaluateWithMock(
  content: string,
  secret: RoundSecret,
): AnswerType {
  const ruleAnswer = evaluateRuleBased(content, secret);
  if (ruleAnswer) return ruleAnswer;

  const normalized = normalizeQuestion(content);
  if (
    /(男性|男的吗|男人|秦代|秦朝|汉代|汉朝|三国|晋代|晋朝|隋代|隋朝|唐代|唐朝|元代|元朝|明代|明朝|清代|清朝|皇帝|武将|将军|思想家|官员|参与战争|参加战争|参战|打仗)/.test(
      normalized,
    )
  ) {
    return "不是";
  }
  if (/(女性|女的吗|女人)/.test(normalized)) return "是";
  if (/(宋代|宋朝|文学|诗词|词人|诗人|有作品|代表作)/.test(normalized)) {
    return "是";
  }
  return "不确定";
}

function buildPrompt(content: string, secret: RoundSecret) {
  return `你是“猜历史人物”多人游戏的严格裁判。

当前游戏每轮选择的都是一位真实存在的中国古代历史人物。你知道秘密人物是谁，必须基于该人物的基本史实进行判断。

秘密人物：
- 标准姓名：${secret.character_name}
- 可接受别名：${secret.character_aliases.join("、") || "无"}
- 参考摘要：${secret.character_summary || "无"}

玩家问题：${content}

判断规则：
1. 玩家明确猜出标准姓名或别名时，回答“猜对了”。
2. 优先回答“是”或“不是”。如果问题可以通过人物的基本史实判断，必须作出二元判断，不要因为问题简短或参考摘要没有直接写出答案就回答“不确定”。
3. “是否现代、是否古代、是否中国人、是否外国人、是否历史人物、是否真实存在、是否神话人物”等游戏设定与基本事实问题，必须明确回答“是”或“不是”。
4. 对性别、朝代、身份类型（如皇帝、诗人、将军、思想家、官员）、代表作品、战争经历等常见属性，必须尽可能依据人物生平明确回答。
5. 只有问题表达模糊、史料存在争议，或问题确实无法对应到人物事实时，才回答“不确定”。
6. 问题与识别人物无关时，回答“无关”。
7. 不要解释答案，只返回规定答案。`;
}

export async function evaluateAnswer(
  content: string,
  secret: RoundSecret,
): Promise<AnswerEvaluation> {
  const ruleAnswer = evaluateRuleBased(content, secret);
  if (ruleAnswer) return { answer: ruleAnswer, source: "rule" };

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

    const answer = parseAnswer(textFromMessage(message.content));
    if (
      answer === "不确定" ||
      shouldUseResearchAgent(content, secret)
    ) {
      const assistedAnswer = await researchHistoricalFact(content, secret);
      if (assistedAnswer) {
        return { answer: assistedAnswer, source: "research" };
      }
    }

    return {
      answer,
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
