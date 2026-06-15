export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return Response.json({ data }, init);
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status },
    );
  }

  console.error("Unhandled API error", error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: "服务器暂时无法完成请求。",
      },
    },
    { status: 500 },
  );
}

export async function readJsonObject(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ApiError(400, "invalid_json", "请求体必须是 JSON 对象。");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_json", "请求体不是有效的 JSON。");
  }
}
