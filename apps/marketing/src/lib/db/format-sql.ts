import type { CapturedQuery } from './sql-capture';

// One alternation, one pass: compound join forms sit in the same branch as
// plain `join`, so "left join" is consumed atomically and never re-split.
const CLAUSE_PATTERN =
  /\s+((?:(?:left|right|inner|full|cross)\s+)?(?:outer\s+)?join|from|where|group\s+by|having|order\s+by|limit|offset)\s+/gi;

function renderParam(param: unknown): string {
  if (param === null || param === undefined) return 'NULL';
  if (typeof param === 'number' || typeof param === 'bigint') return String(param);
  if (typeof param === 'boolean') return param ? '1' : '0';
  if (param instanceof Date) return String(param.getTime());
  return `'${String(param).replaceAll("'", "''")}'`;
}

/**
 * Inline bound values for display.
 * - SQLite / `?` placeholders: sequential, left-to-right
 * - Postgres / `$1` placeholders: 1-based indexes into `params`
 */
function substituteParams(sql: string, params: unknown[]): string {
  let paramIndex = 0;
  let inStringLiteral = false;
  let result = '';

  for (let index = 0; index < sql.length; index++) {
    const character = sql[index];

    if (character === "'") {
      result += character;

      if (inStringLiteral && sql[index + 1] === "'") {
        result += sql[++index];
      } else {
        inStringLiteral = !inStringLiteral;
      }

      continue;
    }

    if (!inStringLiteral && character === '?') {
      result += renderParam(params[paramIndex++]);
      continue;
    }

    // Postgres: `$1`, `$2`, … (and `$10` before a trailing digit is consumed fully)
    if (!inStringLiteral && character === '$') {
      let end = index + 1;
      while (end < sql.length && sql[end]! >= '0' && sql[end]! <= '9') {
        end++;
      }
      if (end > index + 1) {
        const ordinal = Number(sql.slice(index + 1, end));
        result += renderParam(params[ordinal - 1]);
        index = end - 1;
        continue;
      }
    }

    result += character;
  }

  return result;
}

/** Wrap a long `select a, b, c, …` line at `width`, indenting continuations. */
function wrapSelectList(line: string, width = 76): string {
  if (!/^select\s/i.test(line) || line.length <= width) return line;
  const prefix = 'select ';
  const columns = line.slice(prefix.length).split(/,\s*/);
  const lines: string[] = [];
  let current = '';
  for (const column of columns) {
    const candidate = current ? `${current}, ${column}` : column;
    if (current && prefix.length + candidate.length > width) {
      lines.push(`${current},`);
      current = column;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return (
    prefix + lines.map((l, i) => (i === 0 ? l : `${' '.repeat(prefix.length)}${l}`)).join('\n')
  );
}

/**
 * Format a captured drizzle statement for display: break major clauses onto
 * their own lines, wrap long select lists, then substitute `?` / `$N`
 * placeholders with their bound values. Display-only — never fed back to a
 * database.
 */
export function formatSqlForDisplay({ query, params }: CapturedQuery): string {
  // Placeholders are still unbound at this point, so no user-provided value
  // can smuggle a keyword into the clause split.
  let sql = query
    .trim()
    .replace(CLAUSE_PATTERN, (_m, kw: string) => `\n${kw.toLowerCase().replace(/\s+/g, ' ')} `);

  sql = sql
    .split('\n')
    .map((line) => wrapSelectList(line))
    .join('\n');

  // Substitute only placeholders outside single-quoted SQL literals.
  sql = substituteParams(sql, params);

  return sql;
}

/** Pick the row-fetching SELECT (the longest statement) from a capture. */
export function splitCapturedQueries(queries: CapturedQuery[]): {
  main: CapturedQuery | null;
  rest: CapturedQuery[];
} {
  if (queries.length === 0) return { main: null, rest: [] };
  const main = queries.reduce((a, b) => (b.query.length > a.query.length ? b : a));
  return { main, rest: queries.filter((q) => q !== main) };
}
