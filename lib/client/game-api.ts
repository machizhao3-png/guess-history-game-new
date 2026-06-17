import type {
  GameRecord,
  QuestionRecord,
  Round,
} from "@/lib/types";
import type { PlayerIdentity } from "@/lib/types";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface ApiSuccessBody<T> {
  data: T;
}

export class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly code = "request_failed",
    public readonly status = 500,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

async function apiRequest<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ClientApiError("无法连接游戏服务。", "network_error", 0);
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessBody<T>
    | ApiErrorBody
    | null;

  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : undefined;
    throw new ClientApiError(
      error?.message ?? "游戏服务暂时不可用。",
      error?.code,
      response.status,
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ClientApiError("游戏服务返回了无效数据。", "invalid_response");
  }
  return payload.data;
}

export function getCurrentGame() {
  return apiRequest<{
    game: GameRecord;
    round: Round | null;
    questions: QuestionRecord[];
  } | null>("/api/games/current");
}

export function getRoundHistory(resultLimit = 12) {
  return apiRequest<{ rounds: Round[] }>(
    `/api/rounds/history?limit=${resultLimit}`,
  );
}

export function getRound(roundId: string) {
  return apiRequest<{ round: Round; questions: QuestionRecord[] }>(
    `/api/rounds/${roundId}`,
  );
}

export function startRound() {
  return apiRequest<{ round: Round }>("/api/rounds/current", {
    method: "POST",
    body: JSON.stringify({ slug: "main" }),
  });
}

interface SubmitQuestionInput {
  roundId: string;
  clientId: string;
  clientRequestId: string;
  player: PlayerIdentity;
  content: string;
}

export function submitQuestion(input: SubmitQuestionInput) {
  return apiRequest<{
    question: QuestionRecord;
    completed: boolean;
    evaluationSource: "rule" | "anthropic" | "research" | "mock";
  }>("/api/questions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
