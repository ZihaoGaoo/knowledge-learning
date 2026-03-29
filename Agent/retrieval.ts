import { Pool } from "pg";

export type SearchResult = {
  id?: number | string;
  content: string;
  distance: number;
};

function escapeIdentifier(value: string, label: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return `"${value}"`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function extractQueryTerms(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const asciiTerms = normalized.match(/[a-z0-9][a-z0-9_-]*/gi) ?? [];
  const cjkTerms =
    normalized.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu
    ) ?? [];

  return Array.from(
    new Set(
      [normalized, ...asciiTerms, ...cjkTerms]
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  );
}

export class PostgresRetrieval {
  readonly enabled = !["", "false", "0"].includes(
    (process.env.PGVECTOR_ENABLED || "").trim().toLowerCase()
  );

  #pool = new Pool({
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || "postgres",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    connectionTimeoutMillis: Number(
      process.env.POSTGRES_CONNECT_TIMEOUT_MS || 5000
    ),
    query_timeout: Number(process.env.POSTGRES_QUERY_TIMEOUT_MS || 10000),
    statement_timeout: Number(
      process.env.POSTGRES_STATEMENT_TIMEOUT_MS || 10000
    ),
  });

  #table = escapeIdentifier(
    process.env.PGVECTOR_TABLE || "text_embeddings",
    "table name"
  );

  #contentColumn = escapeIdentifier(
    process.env.PGVECTOR_CONTENT_COLUMN || "content",
    "content column"
  );

  #topK = Number(process.env.PGVECTOR_TOP_K || 3);

  async search(query: string): Promise<SearchResult[]> {
    if (!this.enabled || !query.trim()) {
      return [];
    }

    const terms = extractQueryTerms(query);
    if (terms.length === 0) {
      return [];
    }

    const primaryPattern = `%${escapeLikePattern(terms[0])}%`;
    const fallbackPatterns = terms.map(
      (term) => `%${escapeLikePattern(term)}%`
    );

    const result = await this.#pool.query<{
      id?: number | string;
      content: string;
      distance: number | string;
    }>(
      `
        select
          id,
          ${this.#contentColumn} as content,
          case
            when lower(${this.#contentColumn}) like $1 escape '\\' then 0
            else 1
          end as distance
        from ${this.#table}
        where exists (
          select 1
          from unnest($2::text[]) as pattern
          where lower(${this.#contentColumn}) like pattern escape '\\'
        )
        order by
          distance asc,
          coalesce(
            nullif(position(lower($3) in lower(${this.#contentColumn})), 0),
            2147483647
          ) asc,
          char_length(${this.#contentColumn}) asc
        limit $4
      `,
      [primaryPattern, fallbackPatterns, terms[0], this.#topK]
    );

    return result.rows.map((row) => ({
      id: row.id,
      content: row.content,
      distance: Number(row.distance),
    }));
  }

  async buildContext(query: string) {
    const results = await this.search(query);
    if (results.length === 0) {
      return null;
    }

    return [
      "Use the following retrieved context when it is relevant:",
      "",
      ...results.map((item, index) => `[${index + 1}] ${item.content}`),
    ].join("\n");
  }
}
