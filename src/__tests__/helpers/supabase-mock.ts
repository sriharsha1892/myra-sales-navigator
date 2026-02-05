import { vi } from "vitest";

/**
 * Chainable Supabase mock builder.
 *
 * Usage:
 *   const { mockFrom, configureTable } = createMockSupabaseClient();
 *   vi.mock("@/lib/supabase/server", () => ({
 *     createServerClient: () => ({ from: mockFrom }),
 *   }));
 *
 *   configureTable("exclusions", { data: [...], error: null });
 */

interface TableResponse {
  data: unknown;
  error: unknown;
  count?: number | null;
}

function buildChain(response: TableResponse) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "neq",
    "in",
    "gte",
    "lte",
    "gt",
    "lt",
    "not",
    "contains",
    "order",
    "limit",
    "range",
    "is",
    "match",
    "filter",
    "or",
  ];

  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  // Terminal methods
  chain.single = vi.fn().mockResolvedValue(response);
  chain.maybeSingle = vi.fn().mockResolvedValue(response);

  // Mutating methods that also chain
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);

  // Thenable: when the chain is awaited directly (no .single())
  (chain as Record<string, unknown>).then = (
    resolve: (v: unknown) => void,
    reject?: (e: unknown) => void
  ) => {
    if (response.error && reject) {
      return reject(response.error);
    }
    return resolve(response);
  };

  return chain;
}

export function createMockSupabaseClient() {
  const tableConfigs = new Map<string, TableResponse>();

  const mockFrom = vi.fn((table: string) => {
    const config = tableConfigs.get(table) ?? {
      data: null,
      error: null,
    };
    return buildChain(config);
  });

  function configureTable(
    table: string,
    response: Partial<TableResponse>
  ) {
    tableConfigs.set(table, {
      data: response.data ?? null,
      error: response.error ?? null,
      count: response.count ?? null,
    });
  }

  function reset() {
    tableConfigs.clear();
    mockFrom.mockClear();
  }

  return { mockFrom, configureTable, reset };
}
