import { describe, expect, it, mock } from 'bun:test';

const readdirSync = mock(() => ['first.mdx', 'second.mdx']);
const readFileSync = mock((filePath: string) => {
  if (filePath.endsWith('first.mdx')) {
    return `---
title: "First post"
publishedAt: "2026-07-18"
summary: "The first summary"
author: "Author One"
---

This body must not be rendered for summaries.`;
  }

  if (filePath.endsWith('second.mdx')) {
    return `---
title: "Second post"
publishedAt: "2026-07-19"
summary: "The second summary"
author: "Author Two"
---

This body must not be rendered for summaries.`;
  }

  const error = new Error(`Unexpected path: ${filePath}`) as NodeJS.ErrnoException;
  error.code = 'ENOENT';
  throw error;
});

mock.module('node:fs', () => ({
  default: { readdirSync, readFileSync },
  readdirSync,
  readFileSync,
}));

const { getBlogPostSummaries, getPost } = await import('./blog');

describe('blog loading', () => {
  it('lists frontmatter summaries without rendering post bodies', () => {
    expect(getBlogPostSummaries()).toEqual([
      {
        title: 'First post',
        publishedAt: '2026-07-18',
        summary: 'The first summary',
        author: 'Author One',
        slug: 'first',
      },
      {
        title: 'Second post',
        publishedAt: '2026-07-19',
        summary: 'The second summary',
        author: 'Author Two',
        slug: 'second',
      },
    ]);
  });

  it('returns null only when a post file is missing', async () => {
    const missing = new Error('Missing post') as NodeJS.ErrnoException;
    missing.code = 'ENOENT';
    readFileSync.mockImplementationOnce(() => {
      throw missing;
    });

    await expect(getPost('missing')).resolves.toBeNull();
  });

  it('rethrows non-ENOENT filesystem failures', async () => {
    const denied = new Error('Permission denied') as NodeJS.ErrnoException;
    denied.code = 'EACCES';
    readFileSync.mockImplementationOnce(() => {
      throw denied;
    });

    await expect(getPost('first')).rejects.toBe(denied);
  });
});
