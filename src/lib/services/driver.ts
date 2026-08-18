import { isPgDriver } from "@/lib/pg/client";

/**
 * Adapter selection in one place. Each store/service factory names its three
 * (or two) constructors; the mock/pg/supabase decision lives only here.
 *
 * - `mock` is optional: services with no in-memory adapter (they rely on a
 *   `setX()` test seam instead) omit it and always pick pg-vs-supabase, even
 *   under MOCK_SERVICES — matching their pre-existing behavior.
 * - `MOCK_SERVICES=true` selects `mock` only when a mock factory is provided.
 */
export function pickAdapter<T>(choices: {
  mock?: () => T;
  pg: () => T;
  supabase: () => T;
}): T {
  if (choices.mock && process.env.MOCK_SERVICES === "true") return choices.mock();
  return isPgDriver() ? choices.pg() : choices.supabase();
}
