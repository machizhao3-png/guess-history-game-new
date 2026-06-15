import type {
  AnswerType,
  QuestionStatus,
  RoundStatus,
  TableRow,
} from "@/lib/database.types";

export const ANSWERS = ["是", "不是", "不确定", "无关", "猜对了"] as const satisfies
  readonly AnswerType[];

export type Answer = AnswerType;
export type GameStatus = Extract<RoundStatus, "active" | "completed">;

export interface PlayerIdentity {
  nickname: string;
  emoji: string;
}

export type GameRecord = TableRow<"games">;
export type Player = TableRow<"players">;
export type Round = TableRow<"rounds">;
export type QuestionRecord = TableRow<"questions">;
export type GuessedPerson = TableRow<"guessed_people">;

// Compatibility view used by the current demo. Phase 4 will switch the UI
// to Round and QuestionRecord directly without changing its visual structure.
export interface Game {
  id: string;
  revealed_name: string | null;
  status: GameStatus;
  total_questions: number;
  created_at: string;
  completed_at: string | null;
}

export interface Question {
  id: string;
  game_id: string;
  content: string;
  answer: Answer;
  asked_by_nickname: string;
  asked_by_emoji: string;
  order_num: number;
  created_at: string;
}

export interface GameWithQuestions extends Game {
  questions: Question[];
}

export interface CurrentRoundState {
  game: GameRecord;
  round: Round;
  questions: QuestionRecord[];
}

export type { QuestionStatus, RoundStatus };
