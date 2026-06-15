"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EntryModal } from "@/components/entry-modal";
import {
  getRoundHistory,
  startRound,
} from "@/lib/client/game-api";
import { clearPlayer, getPlayer } from "@/lib/storage";
import type { PlayerIdentity, Round } from "@/lib/types";

const DEMO_HISTORY: Round[] = [
  {
    id: "demo-1",
    game_id: "demo",
    round_number: 2,
    revealed_name: "苏轼",
    status: "completed",
    total_questions: 12,
    next_order_num: 13,
    winner_player_id: null,
    winner_nickname: "青简",
    winner_emoji: "🐼",
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    game_id: "demo",
    round_number: 1,
    revealed_name: "居里夫人",
    status: "completed",
    total_questions: 9,
    next_order_num: 10,
    winner_player_id: null,
    winner_nickname: "阿年",
    winner_emoji: "🦊",
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function HomeScreen() {
  const [player, setPlayer] = useState<PlayerIdentity | null | undefined>();
  const [history, setHistory] = useState<Round[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function initialize() {
      setPlayer(getPlayer());
      try {
        const data = await getRoundHistory();
        setHistory(data.rounds);
      } catch {
        setIsDemo(true);
        setHistory(DEMO_HISTORY);
      }
    }
    initialize();
  }, []);

  async function startGame() {
    if (isDemo) {
      window.location.href = "/game";
      return;
    }
    setIsStarting(true);
    setError("");
    try {
      await startRound();
      window.location.href = "/game";
    } catch {
      setIsDemo(true);
      window.location.href = "/game";
    }
  }

  function resetIdentity() {
    clearPlayer();
    setPlayer(null);
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span>猜</span> 历史人物
        </Link>
        {player && (
          <button className="player-chip" onClick={resetIdentity} type="button">
            {player.emoji} {player.nickname}
          </button>
        )}
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">一起用问题逼近答案</span>
          <h1>
            TA 是谁？
            <br />
            问历史一个问题。
          </h1>
          <p>
            AI 已经选好一位历史人物。所有玩家共享同一局，只能得到“是、不是、不确定、无关”四种线索。
          </p>
          <div className="hero-actions">
            {!isDemo ? (
              <>
                <Link className="primary-button" href="/game">
                  进入当前游戏
                </Link>
                <button
                  className="secondary-button"
                  disabled={isStarting}
                  onClick={startGame}
                  type="button"
                >
                  {isStarting ? "正在选人..." : "开始新一局"}
                </button>
              </>
            ) : (
              <Link className="primary-button" href="/game">
                体验演示局
              </Link>
            )}
          </div>
          {error && <p className="error-text">{error}</p>}
          {isDemo && (
            <p className="config-note">当前为演示模式，配置 Supabase 后会自动使用后端数据。</p>
          )}
        </div>

        <Link className="mystery-card" href="/game" aria-label="进入游戏">
          <div className="card-orbit orbit-one" />
          <div className="card-orbit orbit-two" />
          <span className="question-mark">?</span>
          <div className="card-caption">
            <span>当前人物</span>
            <strong>等待你的提问</strong>
          </div>
        </Link>
      </section>

      <section className="history-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">已经揭晓</span>
            <h2>最近猜中的人物</h2>
          </div>
          <span className="history-count">{history.length} 位人物</span>
        </div>
        <div className="history-grid">
          {history.map((round, index) => (
            <article className="history-card" key={round.id}>
              <span className="history-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{round.revealed_name}</h3>
                <p>{round.total_questions} 个问题后揭晓</p>
              </div>
              <span className="arrow">↗</span>
            </article>
          ))}
          {history.length === 0 && (
            <div className="empty-state">第一位被猜中的人物会出现在这里。</div>
          )}
        </div>
      </section>

      {player === null && <EntryModal onEnter={setPlayer} />}
    </main>
  );
}
