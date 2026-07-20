import { describe, expect, it } from 'bun:test';
import { formatSqlForDisplay, splitCapturedQueries } from './format-sql';

describe('formatSqlForDisplay', () => {
  it('substitutes positional placeholders with bound values', () => {
    expect(
      formatSqlForDisplay({
        query: 'select * from users where id = ? and active = ?',
        params: [42, true],
      })
    ).toBe('select *\nfrom users\nwhere id = 42 and active = 1');
  });

  it('does not substitute question marks inside quoted string literals', () => {
    expect(
      formatSqlForDisplay({
        query: "select '?' as prompt, ? as value",
        params: ['bound value'],
      })
    ).toBe("select '?' as prompt, 'bound value' as value");
  });

  it('handles doubled quote escapes within quoted string literals', () => {
    expect(
      formatSqlForDisplay({
        query: "select 'it''s ?' as prompt, ? as value",
        params: ['bound value'],
      })
    ).toBe("select 'it''s ?' as prompt, 'bound value' as value");
  });

  it('substitutes Postgres $N placeholders with bound values', () => {
    expect(
      formatSqlForDisplay({
        query:
          'select "users"."name" from "users" "users" where "users"."role" = $1 limit $2',
        params: ['admin', 10],
      })
    ).toBe(
      'select "users"."name"\nfrom "users" "users"\nwhere "users"."role" = \'admin\'\nlimit 10'
    );
  });

  it('does not substitute $N inside quoted string literals', () => {
    expect(
      formatSqlForDisplay({
        query: "select '$1' as prompt, $1 as value",
        params: ['bound'],
      })
    ).toBe("select '$1' as prompt, 'bound' as value");
  });

  it('handles multi-digit Postgres placeholders ($10 before $1)', () => {
    const params = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(
      formatSqlForDisplay({
        query: 'select $10, $1',
        params,
      })
    ).toBe('select 10, 1');
  });
});

describe('splitCapturedQueries', () => {
  it('selects the longest captured query as the main statement', () => {
    const short = { query: 'begin', params: [] };
    const main = { query: 'select id, name from users where active = ?', params: [true] };
    const medium = { query: 'commit', params: [] };

    expect(splitCapturedQueries([short, main, medium])).toEqual({
      main,
      rest: [short, medium],
    });
  });
});
