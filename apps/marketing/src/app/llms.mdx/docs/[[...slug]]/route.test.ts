import { beforeEach, describe, expect, it, mock } from 'bun:test';

const getPageMock = mock((_slug: string[] | undefined) => undefined as unknown);
const getPagesMock = mock(() => [] as Array<{ slugs: string[]; url: string }>);
const getLLMTextMock = mock(async () => '# title\n\nbody');
const getPageMarkdownUrlMock = mock((page: { slugs: string[] }) => ({
  segments: [...page.slugs, 'content.md'],
  url: page.slugs.length === 0 ? '/docs.mdx' : `/docs/${page.slugs.join('/')}.mdx`,
}));

mock.module('@/lib/source', () => ({
  source: {
    getPage: getPageMock,
    getPages: getPagesMock,
  },
  getLLMText: getLLMTextMock,
  getPageMarkdownUrl: getPageMarkdownUrlMock,
}));

const notFoundMock = mock(() => {
  throw new Error('NEXT_NOT_FOUND');
});

mock.module('next/navigation', () => ({
  notFound: notFoundMock,
}));

const { GET, generateStaticParams, resolvePageSlug } = await import('./route');

describe('resolvePageSlug', () => {
  it('strips a trailing content.md / content.mdx segment', () => {
    expect(resolvePageSlug(['filtering', 'content.md'])).toEqual(['filtering']);
    expect(resolvePageSlug(['adapters', 'http', 'content.mdx'])).toEqual(['adapters', 'http']);
  });

  it('leaves other slugs and empty values unchanged', () => {
    expect(resolvePageSlug(['filtering'])).toEqual(['filtering']);
    expect(resolvePageSlug(undefined)).toBeUndefined();
    expect(resolvePageSlug([])).toEqual([]);
  });
});

describe('GET /llms.mdx/docs/[[...slug]]', () => {
  beforeEach(() => {
    getPageMock.mockClear();
    getLLMTextMock.mockClear();
    notFoundMock.mockClear();
  });

  it('returns markdown for a known page', async () => {
    const page = { slugs: ['filtering'], url: '/docs/filtering', data: { title: 'Filtering' } };
    getPageMock.mockImplementationOnce(() => page);
    getLLMTextMock.mockResolvedValueOnce('# Filtering (/docs/filtering)\n\nbody');

    const res = await GET(new Request('http://localhost/llms.mdx/docs/filtering'), {
      params: Promise.resolve({ slug: ['filtering'] }),
    });

    expect(getPageMock).toHaveBeenCalledWith(['filtering']);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(await res.text()).toContain('# Filtering');
  });

  it('calls notFound for an unknown page', async () => {
    getPageMock.mockImplementationOnce(() => undefined);

    await expect(
      GET(new Request('http://localhost/llms.mdx/docs/missing'), {
        params: Promise.resolve({ slug: ['missing'] }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalled();
  });
});

describe('generateStaticParams', () => {
  it('maps each page to markdown SSG segments', () => {
    getPagesMock.mockImplementationOnce(() => [
      { slugs: [], url: '/docs' },
      { slugs: ['filtering'], url: '/docs/filtering' },
    ]);

    expect(generateStaticParams()).toEqual([
      { slug: ['content.md'] },
      { slug: ['filtering', 'content.md'] },
    ]);
  });
});
