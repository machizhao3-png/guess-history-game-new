import { ApiError } from "@/lib/api/errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

export function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

export function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
) {
  const result = optionalString(value);
  if (!result) {
    throw new ApiError(400, "invalid_input", `${field}不能为空。`);
  }
  if (result.length > maxLength) {
    throw new ApiError(
      400,
      "invalid_input",
      `${field}不能超过 ${maxLength} 个字符。`,
    );
  }
  return result;
}

export function uuid(value: unknown, field: string) {
  const result = requiredString(value, field, 36);
  if (!UUID_PATTERN.test(result)) {
    throw new ApiError(400, "invalid_input", `${field}格式不正确。`);
  }
  return result;
}

export function slug(value: unknown, fallback = "main") {
  const result = optionalString(value) ?? fallback;
  if (!SLUG_PATTERN.test(result)) {
    throw new ApiError(400, "invalid_input", "游戏标识格式不正确。");
  }
  return result;
}

export function limit(value: string | null, fallback = 20, maximum = 50) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ApiError(
      400,
      "invalid_input",
      `limit 必须是 1 到 ${maximum} 之间的整数。`,
    );
  }
  return parsed;
}
