import { ApiError } from "@/lib/api/errors";
import { createAdmin } from "@/lib/supabase/server";

export function requireAdminClient() {
  const supabase = createAdmin();
  if (!supabase) {
    throw new ApiError(
      503,
      "service_not_configured",
      "Supabase 服务尚未配置。",
    );
  }
  return supabase;
}
