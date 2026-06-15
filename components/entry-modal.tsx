"use client";

import { useState } from "react";
import { PLAYER_EMOJIS } from "@/lib/constants";
import { savePlayer } from "@/lib/storage";
import type { PlayerIdentity } from "@/lib/types";

interface EntryModalProps {
  onEnter: (player: PlayerIdentity) => void;
}

export function EntryModal({ onEnter }: EntryModalProps) {
  const [emoji, setEmoji] = useState<string>(PLAYER_EMOJIS[0]);
  const [nickname, setNickname] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const player = { emoji, nickname: nickname.trim() };
    if (!player.nickname) return;
    savePlayer(player);
    onEnter(player);
  }

  return (
    <div className="modal-backdrop">
      <form className="modal-card entry-card" onSubmit={submit}>
        <span className="eyebrow">欢迎加入</span>
        <h2>先选一个小身份</h2>
        <p>你的昵称和头像会显示在每一次提问旁边。</p>
        <div className="emoji-grid" aria-label="选择头像">
          {PLAYER_EMOJIS.map((item) => (
            <button
              className={item === emoji ? "emoji-option selected" : "emoji-option"}
              key={item}
              onClick={() => setEmoji(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <label className="field-label" htmlFor="nickname">
          你的昵称
        </label>
        <input
          autoFocus
          id="nickname"
          maxLength={16}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="例如：史书边角料"
          value={nickname}
        />
        <button className="primary-button" disabled={!nickname.trim()} type="submit">
          进入游戏
        </button>
      </form>
    </div>
  );
}
