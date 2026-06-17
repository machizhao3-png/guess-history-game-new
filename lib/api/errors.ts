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

function logApiError(error: unknown) {
  if (error instanceof Error) {
    console.error("API error", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  console.error("API error", {
    name: typeof error,
    message: String(error),
    stack: undefined,
  });
}

export function apiError(error: unknown) {
  logApiError(error);

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

  return Response.json(
    {
      error: {
        code: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "服务器暂时无法完成请求。",
        details:
          error instanceof Error
            ? { name: error.name }
            : { name: typeof error },
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
