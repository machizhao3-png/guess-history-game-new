import { requireAdminClient } from "@/lib/api/admin";
import { apiError, readJsonObject } from "@/lib/api/errors";
import { requiredString, uuid } from "@/lib/api/validation";
import { submitMockQuestion } from "@/lib/backend/game-service";

// Compatibility endpoint for the current demo. Phase 4 will switch the client
// to POST /api/questions with stable client and request identifiers.
export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const player =
      body.player && typeof body.player === "object" && !Array.isArray(body.player)
        ? (body.player as Record<string, unknown>)
        : {};

    const result = await submitMockQuestion(requireAdminClient(), {
      roundId: uuid(body.gameId, "轮次 ID"),
      clientId: crypto.randomUUID(),
      clientRequestId: crypto.randomUUID(),
      nickname: requiredString(player.nickname, "昵称", 16),
      emoji: requiredString(player.emoji, "头像", 16),
      content: requiredString(body.question, "问题", 120),
    });

    return Response.json({
      question: {
        ...result.question,
        game_id: result.question.round_id,
      },
      completed: result.completed,
    });
  } catch (error) {
    return apiError(error);
  }
}
