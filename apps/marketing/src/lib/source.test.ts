import { describe, expect, it } from 'bun:test';
import { docsImageRoute } from '@/lib/docs';
import { getLLMText, getPageImage, getPageMarkdownUrl } from '@/lib/source';

function fakePage(slugs: string[], url = `/docs/${slugs.join('/')}`) {
  return {
    slugs,
    url,
    data: {
      title: 'Example',
      getText: async () => 'processed body',
    },
  } as unknown as Parameters<typeof getPageImage>[0];
}

describe('getPageImage', () => {
  it('appends image.png under the docs OG route', () => {
    expect(getPageImage(fakePage(['filtering']))).toEqual({
      segments: ['filtering', 'image.png'],
      url: `${docsImageRoute}/filtering/image.png`,
    });
  });
});

describe('getPageMarkdownUrl', () => {
  it('uses /docs.mdx for the docs index', () => {
    expect(getPageMarkdownUrl(fakePage([], '/docs'))).toEqual({
      segments: ['content.md'],
      url: '/docs.mdx',
    });
  });

  it('appends .mdx to nested page urls and content.md to SSG segments', () => {
    expect(getPageMarkdownUrl(fakePage(['adapters', 'http']))).toEqual({
      segments: ['adapters', 'http', 'content.md'],
      url: '/docs/adapters/http.mdx',
    });
  });
});

describe('getLLMText', () => {
  it('prefixes processed markdown with the page title and url', async () => {
    const text = await getLLMText(fakePage(['filtering'], '/docs/filtering'));
    expect(text).toBe('# Example (/docs/filtering)\n\nprocessed body');
  });
});
