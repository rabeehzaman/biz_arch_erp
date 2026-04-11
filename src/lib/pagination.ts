import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface PaginationParams {
  limit: number;
  offset: number;
  search: string;
}

export function parsePagination(request: NextRequest): PaginationParams {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const search = searchParams.get("search")?.trim() || "";
  return { limit, offset, search };
}

const RESERVED_PARAMS = new Set(["limit", "offset", "search"]);

export function parseAdvancedSearch(request: NextRequest): Record<string, string> {
  const { searchParams } = new URL(request.url);
  const result: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (!RESERVED_PARAMS.has(key) && value) {
      result[key] = value;
    }
  });
  return result;
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  hasMore: boolean
) {
  return NextResponse.json({ data, total, hasMore });
}
