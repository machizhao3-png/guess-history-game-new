import type { AnswerType } from "@/lib/database.types";

export interface HistoricalPerson {
  character_name: string;
  character_aliases: string[];
  character_summary?: string | null;
}

export function normalizeQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s，。！？、,.!?；;：“”"'《》【】()[\]{}]/g, "");
}

export function evaluateRuleBased(
  question: string,
  person: HistoricalPerson,
): AnswerType | null {
  const normalized = normalizeQuestion(question);
  const names = [person.character_name, ...person.character_aliases]
    .map(normalizeQuestion)
    .filter(Boolean);

  if (names.some((name) => normalized.includes(name))) return "猜对了";
  if (/(吃什么|天气|股票|足球|电影)/.test(normalized)) return "无关";
  if (/(现代|近现代|当代)/.test(normalized)) return "不是";
  if (/(古代|古人)/.test(normalized)) return "是";
  if (/(外国|外国人)/.test(normalized)) return "不是";
  if (/(中国|中国人)/.test(normalized)) return "是";
  if (/(历史人物|真实存在|确有其人)/.test(normalized)) return "是";
  if (/(虚构人物|神话人物|传说人物)/.test(normalized)) return "不是";

  return null;
}
