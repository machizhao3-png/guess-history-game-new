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

function isBasicIdentityQuestion(question: string, attribute: RegExp) {
  return new RegExp(
    `^(?:他|她|ta|这个人)?(?:是|属于)?${attribute.source}(?:的)?(?:吗|么)?$`,
    "u",
  ).test(question);
}

export function evaluateRuleBased(
  question: string,
  person: HistoricalPerson,
): AnswerType | null {
  const normalized = normalizeQuestion(question);
  const names = [person.character_name, ...person.character_aliases]
    .map(normalizeQuestion)
    .filter(Boolean);

  if (
    names.some(
      (name) =>
        normalized === name ||
        normalized === `是${name}吗` ||
        normalized === `是不是${name}` ||
        normalized === `我猜${name}` ||
        normalized === `答案是${name}`,
    )
  ) {
    return "猜对了";
  }

  const surnameQuestion = normalized.match(
    /^(?:他|她|ta|这个人)?(?:是)?姓([\p{Script=Han}])(?:吗|么)?$/u,
  );
  if (surnameQuestion) {
    return person.character_name.startsWith(surnameQuestion[1])
      ? "是"
      : "不是";
  }

  if (isBasicIdentityQuestion(normalized, /(?:现代人?|近现代人?|当代人?)/)) {
    return "不是";
  }
  if (isBasicIdentityQuestion(normalized, /(?:古代人?|古人)/)) return "是";
  if (isBasicIdentityQuestion(normalized, /外国人?/)) return "不是";
  if (isBasicIdentityQuestion(normalized, /中国人?/)) return "是";
  if (isBasicIdentityQuestion(normalized, /历史人物/)) return "是";

  return null;
}
