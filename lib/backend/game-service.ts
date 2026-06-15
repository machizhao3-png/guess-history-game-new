import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type {
  AnswerType,
  Database,
  TableRow,
} from "@/lib/database.types";

type AdminClient = SupabaseClient<Database>;

const MOCK_CHARACTER = {
  name: "李清照",
  aliases: ["李清照", "易安居士", "李易安"],
  summary: "宋代女性词人，婉约词派代表人物。",
};

function databaseError(
  operation: string,
  error: { code?: string; message?: string } | null,
) {
  return new ApiError(
    500,
    "database_error",
    `${operation}失败。`,
    error?.code ? { databaseCode: error.code } : undefined,
  );
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s，。！？、,.!?；;：“”"'《》【】()[\]{}]/g, "");
}

function mockAnswer(
  content: string,
  secret: Pick<
    TableRow<"round_secrets">,
    "character_name" | "character_aliases"
  >,
): AnswerType {
  const normalized = normalizeText(content);
  const names = [secret.character_name, ...secret.character_aliases].map(
    normalizeText,
  );

  if (names.some((name) => normalized.includes(name))) return "猜对了";
  if (/(吃什么|天气|股票|足球|电影)/.test(normalized)) return "无关";
  if (/(男性|男的吗|男人)/.test(normalized)) return "不是";
  if (/(女性|女的吗|女人)/.test(normalized)) return "是";
  if (/(唐代|唐朝|皇帝|武将)/.test(normalized)) return "不是";
  if (/(中国|宋代|宋朝|文学|诗词|词人)/.test(normalized)) return "是";
  return "不确定";
}

export async function getCurrentGameState(
  supabase: AdminClient,
  gameSlug = "main",
) {
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("slug", gameSlug)
    .maybeSingle();

  if (gameError) throw databaseError("读取游戏", gameError);
  if (!game) return null;

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("*")
    .eq("game_id", game.id)
    .in("status", ["creating", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundError) throw databaseError("读取当前轮次", roundError);
  if (!round) return { game, round: null, questions: [] };

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("round_id", round.id)
    .order("order_num");

  if (questionsError) throw databaseError("读取问题记录", questionsError);
  return { game, round, questions: questions ?? [] };
}

export async function startMockRound(
  supabase: AdminClient,
  gameSlug = "main",
) {
  const { data, error } = await supabase.rpc("start_round", {
    p_game_slug: gameSlug,
    p_character_name: MOCK_CHARACTER.name,
    p_character_aliases: MOCK_CHARACTER.aliases,
    p_character_summary: MOCK_CHARACTER.summary,
  });

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    throw new ApiError(
      status,
      status === 409 ? "round_conflict" : "database_error",
      status === 409 ? "已有轮次正在创建，请稍后重试。" : "创建游戏轮次失败。",
      { databaseCode: error.code },
    );
  }
  return data;
}

export async function listCompletedRounds(
  supabase: AdminClient,
  resultLimit: number,
) {
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(resultLimit);

  if (error) throw databaseError("读取历史轮次", error);
  return data ?? [];
}

export async function getRound(
  supabase: AdminClient,
  roundId: string,
) {
  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", roundId)
    .maybeSingle();

  if (roundError) throw databaseError("读取轮次", roundError);
  if (!round) throw new ApiError(404, "round_not_found", "没有找到该轮游戏。");

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("round_id", roundId)
    .order("order_num");

  if (questionsError) throw databaseError("读取问题记录", questionsError);
  return { round, questions: questions ?? [] };
}

export async function listQuestions(
  supabase: AdminClient,
  roundId: string,
) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("round_id", roundId)
    .order("order_num");

  if (error) throw databaseError("读取问题记录", error);
  return data ?? [];
}

interface SubmitQuestionInput {
  roundId: string;
  clientId: string;
  clientRequestId: string;
  nickname: string;
  emoji: string;
  content: string;
}

export async function submitMockQuestion(
  supabase: AdminClient,
  input: SubmitQuestionInput,
) {
  const { data: secret, error: secretError } = await supabase
    .from("round_secrets")
    .select("character_name, character_aliases")
    .eq("round_id", input.roundId)
    .maybeSingle();

  if (secretError) throw databaseError("读取轮次信息", secretError);
  if (!secret) {
    throw new ApiError(404, "round_not_found", "没有找到该轮游戏。");
  }

  const answer = mockAnswer(input.content, secret);
  const { data, error } = await supabase.rpc("record_answered_question", {
    p_round_id: input.roundId,
    p_client_id: input.clientId,
    p_client_request_id: input.clientRequestId,
    p_nickname: input.nickname,
    p_emoji: input.emoji,
    p_content: input.content,
    p_answer: answer,
  });

  if (error) {
    if (error.message.includes("round_not_found")) {
      throw new ApiError(404, "round_not_found", "没有找到该轮游戏。");
    }
    if (error.message.includes("round_not_active")) {
      throw new ApiError(409, "round_not_active", "该轮游戏已经结束。");
    }
    if (error.code === "23505") {
      throw new ApiError(409, "question_conflict", "问题提交发生冲突，请重试。");
    }
    throw databaseError("保存问题", error);
  }

  return { question: data, completed: answer === "猜对了" };
}

export async function listGuessedPeople(
  supabase: AdminClient,
  resultLimit: number,
) {
  const { data, error } = await supabase
    .from("guessed_people")
    .select("*")
    .order("last_guessed_at", { ascending: false })
    .limit(resultLimit);

  if (error) throw databaseError("读取已猜人物", error);
  return data ?? [];
}
