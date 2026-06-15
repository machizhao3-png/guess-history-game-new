import type { AnswerType } from "@/lib/database.types";
import type { HistoricalPerson } from "@/lib/ai/rule-evaluator";

const RESEARCH_QUESTION_PATTERN =
  /(哪年|何年|年份|年代|出生|去世|作品|著作|诗词|事件|战争|战役|官职|身份|争议|是否曾|有没有|参与|发明|创作|建立|推翻)/;

export function shouldUseResearchAgent(
  question: string,
  person: HistoricalPerson,
) {
  return Boolean(
    question.trim() &&
      person.character_name &&
      RESEARCH_QUESTION_PATTERN.test(question),
  );
}

export async function researchHistoricalFact(
  question: string,
  person: HistoricalPerson,
): Promise<AnswerType | null> {
  if (!process.env.HISTORICAL_RESEARCH_API_KEY) return null;

  // TODO: Use a configured search provider to collect evidence, then ask a
  // constrained evaluator for one of the five valid answers. The game rules
  // remain authoritative; research only assists an uncertain AI judgment.
  if (!question.trim() || !person.character_name) return null;
  return null;
}
