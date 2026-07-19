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
