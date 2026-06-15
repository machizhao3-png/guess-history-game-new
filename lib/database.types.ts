export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AnswerType = "是" | "不是" | "不确定" | "无关" | "猜对了";
export type GameStatus = "active" | "archived";
export type RoundStatus = "creating" | "active" | "completed" | "failed";
export type QuestionStatus = "pending" | "answered" | "failed";

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          slug: string;
          title: string;
          status: GameStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug?: string;
          title?: string;
          status?: GameStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          status?: GameStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          client_id: string;
          nickname: string;
          emoji: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          client_id: string;
          nickname: string;
          emoji: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          client_id?: string;
          nickname?: string;
          emoji?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      rounds: {
        Row: {
          id: string;
          game_id: string;
          round_number: number;
          status: RoundStatus;
          revealed_name: string | null;
          total_questions: number;
          next_order_num: number;
          winner_player_id: string | null;
          winner_nickname: string | null;
          winner_emoji: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          round_number: number;
          status?: RoundStatus;
          revealed_name?: string | null;
          total_questions?: number;
          next_order_num?: number;
          winner_player_id?: string | null;
          winner_nickname?: string | null;
          winner_emoji?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          round_number?: number;
          status?: RoundStatus;
          revealed_name?: string | null;
          total_questions?: number;
          next_order_num?: number;
          winner_player_id?: string | null;
          winner_nickname?: string | null;
          winner_emoji?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rounds_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rounds_winner_player_id_fkey";
            columns: ["winner_player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      round_secrets: {
        Row: {
          round_id: string;
          character_name: string;
          character_aliases: string[];
          character_summary: string | null;
          created_at: string;
        };
        Insert: {
          round_id: string;
          character_name: string;
          character_aliases?: string[];
          character_summary?: string | null;
          created_at?: string;
        };
        Update: {
          round_id?: string;
          character_name?: string;
          character_aliases?: string[];
          character_summary?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "round_secrets_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: true;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          id: string;
          round_id: string;
          player_id: string | null;
          client_request_id: string;
          content: string;
          status: QuestionStatus;
          answer: AnswerType | null;
          asked_by_nickname: string;
          asked_by_emoji: string;
          order_num: number;
          error_code: string | null;
          created_at: string;
          answered_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          round_id: string;
          player_id?: string | null;
          client_request_id: string;
          content: string;
          status?: QuestionStatus;
          answer?: AnswerType | null;
          asked_by_nickname: string;
          asked_by_emoji: string;
          order_num: number;
          error_code?: string | null;
          created_at?: string;
          answered_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          player_id?: string | null;
          client_request_id?: string;
          content?: string;
          status?: QuestionStatus;
          answer?: AnswerType | null;
          asked_by_nickname?: string;
          asked_by_emoji?: string;
          order_num?: number;
          error_code?: string | null;
          created_at?: string;
          answered_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      guessed_people: {
        Row: {
          id: string;
          normalized_name: string;
          display_name: string;
          aliases: string[];
          first_round_id: string | null;
          latest_round_id: string | null;
          times_guessed: number;
          first_guessed_at: string;
          last_guessed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          normalized_name: string;
          display_name: string;
          aliases?: string[];
          first_round_id?: string | null;
          latest_round_id?: string | null;
          times_guessed?: number;
          first_guessed_at?: string;
          last_guessed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          normalized_name?: string;
          display_name?: string;
          aliases?: string[];
          first_round_id?: string | null;
          latest_round_id?: string | null;
          times_guessed?: number;
          first_guessed_at?: string;
          last_guessed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guessed_people_first_round_id_fkey";
            columns: ["first_round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guessed_people_latest_round_id_fkey";
            columns: ["latest_round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      answer_type: AnswerType;
      game_status: GameStatus;
      question_status: QuestionStatus;
      round_status: RoundStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type TableName = keyof Database["public"]["Tables"];
export type TableRow<T extends TableName> =
  Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends TableName> =
  Database["public"]["Tables"][T]["Insert"];
export type TableUpdate<T extends TableName> =
  Database["public"]["Tables"][T]["Update"];
