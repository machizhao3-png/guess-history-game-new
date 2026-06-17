import { ApiError } from "@/lib/api/errors";
import { createAdmin } from "@/lib/supabase/server";

const SERVER_ENV_KEYS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
] as const;

function envPresence() {
  return Object.fromEntries(
    SERVER_ENV_KEYS.map((key) => [key, Boolean(process.env[key])]),
  ) as Record<(typeof SERVER_ENV_KEYS)[number], boolean>;
}

export function requireAdminClient() {
  const missingRequired = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    throw new ApiError(
      503,
      "service_unavailable",
      `Missing required environment variable: ${missingRequired.join(", ")}`,
      {
        missingRequired,
        env: envPresence(),
      },
    );
  }

  const supabase = createAdmin();
  if (!supabase) {
    throw new ApiError(
      503,
      "service_unavailable",
      "Supabase admin client could not be initialized.",
      { env: envPresence() },
    );
  }
  return supabase;
}
