"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EntryModal } from "@/components/entry-modal";
import {
  getCurrentGame,
  getRound,
  startRound,
  submitQuestion,
} from "@/lib/client/game-api";
import { getClientId, getPlayer } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import type {
  PlayerIdentity,
  QuestionRecord,
  Round,
} from "@/lib/types";

const DEMO_GAME: Round = {
  id: "demo-active",
  game_id: "demo",
  round_number: 3,
  revealed_name: null,
  status: "active",
  total_questions: 4,
  next_order_num: 5,
  winner_player_id: null,
  winner_nickname: null,
  winner_emoji: null,
  created_at: new Date().toISOString(),
  started_at: new Date().toISOString(),
  completed_at: null,
  updated_at: new Date().toISOString(),
};

const DEMO_QUESTIONS: QuestionRecord[] = [
  {
    id: "q1",
    round_id: DEMO_GAME.id,
    player_id: null,
    client_request_id: "demo-q1",
    content: "这个人生活在中国吗？",
    status: "answered",
    answer: "是",
    asked_by_nickname: "青简",
    asked_by_emoji: "🐼",
    order_num: 1,
    error_code: null,
    created_at: new Date().toISOString(),
    answered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "q2",
    round_id: DEMO_GAME.id,
    player_id: null,
    client_request_id: "demo-q2",
    content: "TA 是男性吗？",
    status: "answered",
    answer: "不是",
    asked_by_nickname: "阿年",
    asked_by_emoji: "🦊",
    order_num: 2,
    error_code: null,
    created_at: new Date().toISOString(),
    answered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "q3",
    round_id: DEMO_GAME.id,
    player_id: null,
    client_request_id: "demo-q3",
    content: "TA 以文学作品闻名吗？",
    status: "answered",
    answer: "是",
    asked_by_nickname: "墨点",
    asked_by_emoji: "🐸",
    order_num: 3,
    error_code: null,
    created_at: new Date().toISOString(),
    answered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "q4",
    round_id: DEMO_GAME.id,
    player_id: null,
    client_request_id: "demo-q4",
    content: "TA 生活在唐代吗？",
    status: "answered",
    answer: "不是",
    asked_by_nickname: "小满",
    asked_by_emoji: "🐯",
    order_num: 4,
    error_code: null,
    created_at: new Date().toISOString(),
    answered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function GameScreen() {
  const [player, setPlayer] = useState<PlayerIdentity | null | undefined>();
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<Round | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function initialize() {
      setPlayer(getPlayer());
      try {
        let state = await getCurrentGame();
        if (!state?.round) {
          await startRound();
          state = await getCurrentGame();
        }
        if (!state?.round) throw new Error("missing round");
        setGameId(state.game.id);
        setGame(state.round);
        setQuestions(state.questions);
      } catch {
        setIsDemo(true);
        setGame(DEMO_GAME);
        setQuestions(DEMO_QUESTIONS);
      }
    }
    initialize();
  }, []);

  useEffect(() => {
    if (isDemo || !gameId) return;

    const supabase = createClient();
    if (!supabase) return;

    let active = true;
    function syncRound(nextRound: Round) {
      if (nextRound.status === "failed") return;

      if (nextRound.id === game?.id && nextRound.status !== "completed") {
        setGame(nextRound);
        return;
      }

      if (
        nextRound.status !== "active" &&
        nextRound.status !== "completed"
      ) {
        return;
      }

      void getRound(nextRound.id)
        .then((state) => {
          if (!active) return;
          setGame(state.round);
          setQuestions(state.questions);
        })
        .catch(() => {
          if (active && nextRound.id === game?.id) setGame(nextRound);
        });
    }

    const channel = supabase
      .channel(`game-${gameId}-rounds`)
      .on<Round>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rounds",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => syncRound(payload.new),
      )
      .on<Round>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rounds",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => syncRound(payload.new),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [game?.id, gameId, isDemo]);

  useEffect(() => {
    if (isDemo || !game?.id || game.status === "completed") return;

    const supabase = createClient();
    if (!supabase) return;

    function mergeQuestion(nextQuestion: QuestionRecord) {
      setQuestions((current) =>
        [
          ...current.filter((item) => item.id !== nextQuestion.id),
          nextQuestion,
        ].sort((a, b) => a.order_num - b.order_num),
      );
    }

    const channel = supabase
      .channel(`round-${game.id}-questions`)
      .on<QuestionRecord>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "questions",
          filter: `round_id=eq.${game.id}`,
        },
        (payload) => mergeQuestion(payload.new),
      )
      .on<QuestionRecord>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "questions",
          filter: `round_id=eq.${game.id}`,
        },
        (payload) => mergeQuestion(payload.new),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [game?.id, game?.status, isDemo]);

  const yesCount = useMemo(
    () => questions.filter((item) => item.answer === "是").length,
    [questions],
  );

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || !player || !game) return;
    setLoading(true);
    setError("");

    if (isDemo) {
      const demoAnswer = question.includes("李清照") ? "猜对了" : "不确定";
      setQuestions((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          round_id: game.id,
          player_id: null,
          client_request_id: crypto.randomUUID(),
          content: question.trim(),
          status: "answered",
          answer: demoAnswer,
          asked_by_nickname: player.nickname,
          asked_by_emoji: player.emoji,
          order_num: current.length + 1,
          error_code: null,
          created_at: new Date().toISOString(),
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      if (demoAnswer === "猜对了") {
        setGame({
          ...game,
          status: "completed",
          revealed_name: "李清照",
          completed_at: new Date().toISOString(),
        });
      }
      setQuestion("");
      setLoading(false);
      return;
    }

    try {
      const result = await submitQuestion({
        roundId: game.id,
        clientId: getClientId(),
        clientRequestId: crypto.randomUUID(),
        player,
        content: question.trim(),
      });
      setQuestions((current) =>
        [...current.filter((item) => item.id !== result.question.id), result.question].sort(
          (a, b) => a.order_num - b.order_num,
        ),
      );
      if (result.completed) {
        const completed = await getRound(game.id);
        setGame(completed.round);
        setQuestions(completed.questions);
      }
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "这个问题暂时没有送达");
    }
    setLoading(false);
  }

  return (
    <main className="game-shell">
      <header className="game-topbar">
        <Link className="brand" href="/">
          <span>猜</span> 历史人物
        </Link>
        <div className="game-stats">
          <span><strong>{questions.length}</strong> 问题</span>
          <span><strong>{yesCount}</strong> 条是</span>
          {player && <span>{player.emoji} {player.nickname}</span>}
        </div>
      </header>

      <section className="game-intro">
        <div>
          <span className="eyebrow">本局时间线</span>
          <h1>从线索中认出 TA</h1>
        </div>
        <div className="mini-mystery">?</div>
      </section>

      {!game ? (
        <div className="empty-state game-empty">
          当前还没有进行中的游戏。<Link href="/">返回大厅开始一局</Link>
        </div>
      ) : (
        <>
          <section className="timeline">
            {questions.map((item) => (
              <article className="timeline-item" key={item.id}>
                <div className="timeline-index">{item.order_num}</div>
                <div className="timeline-body">
                  <div className="question-meta">
                    <span>{item.asked_by_emoji} {item.asked_by_nickname}</span>
                    <span>第 {item.order_num} 问</span>
                  </div>
                  <div className="question-row">
                    <p>{item.content}</p>
                    <span className={`answer answer-${item.answer ?? "不确定"}`}>
                      {item.answer ?? "不确定"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <form className="ask-bar" onSubmit={ask}>
            <div>
              <label htmlFor="question">问一个能缩小范围的问题</label>
              <input
                disabled={loading || game.status === "completed"}
                id="question"
                maxLength={120}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="例如：TA 生活在宋代吗？"
                value={question}
              />
            </div>
            <button className="primary-button" disabled={loading || !question.trim()} type="submit">
              {loading ? "AI 判断中..." : "提交问题"}
            </button>
          </form>
          {error && <p className="error-text ask-error">{error}</p>}
          {isDemo && <p className="config-note centered">演示答案规则：输入“李清照”即可猜中。</p>}
        </>
      )}

      {player === null && <EntryModal onEnter={setPlayer} />}
      {game?.status === "completed" && game.revealed_name && (
        <div className="modal-backdrop">
          <div className="modal-card result-card">
            <span className="eyebrow">猜对了</span>
            <div className="result-icon">✓</div>
            <h2>{game.revealed_name}</h2>
            <p>大家用了 {questions.length} 个问题找到了答案。</p>
            <Link className="primary-button" href="/">
              返回大厅
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
