import { notFound } from 'next/navigation';
import { getLLMText, getPageMarkdownUrl, source } from '@/lib/source';

export const revalidate = false;

export function resolvePageSlug(slug: string[] | undefined): string[] | undefined {
  if (!slug?.length) return slug;
  const last = slug[slug.length - 1];
  // Internal SSG paths end with content.md; rewrite targets omit that suffix.
  if (last === 'content.md' || last === 'content.mdx') {
    return slug.slice(0, -1);
  }
  return slug;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(resolvePageSlug(slug));
  if (!page) notFound();

  return new Response(await getLLMText(page), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: getPageMarkdownUrl(page).segments,
  }));
}
