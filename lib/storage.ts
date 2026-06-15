"use client";

import type { PlayerIdentity } from "@/lib/types";

const PLAYER_KEY = "guess-history-player";
const CLIENT_KEY = "guess-history-client-id";

export function getPlayer(): PlayerIdentity | null {
  try {
    const raw = window.localStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    const player = JSON.parse(raw) as PlayerIdentity;
    return player.nickname && player.emoji ? player : null;
  } catch {
    return null;
  }
}

export function savePlayer(player: PlayerIdentity) {
  window.localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

export function clearPlayer() {
  window.localStorage.removeItem(PLAYER_KEY);
}

export function getClientId() {
  const stored = window.localStorage.getItem(CLIENT_KEY);
  if (stored) return stored;

  const clientId = window.crypto.randomUUID();
  window.localStorage.setItem(CLIENT_KEY, clientId);
  return clientId;
}
