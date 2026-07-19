import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost } from '@/lib/blog';
import { siteConfig } from '@/lib/config';
import { formatDate } from '@/lib/utils';

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const params = await props.params;
  const post = await getPost(params.slug);
  if (!post) return undefined;
  const { title, publishedAt: publishedTime, summary: description, image } = post.metadata;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime,
      url: `${siteConfig.url}/blog/${post.slug}`,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const post = await getPost(params.slug);
  if (!post) {
    notFound();
  }

  return (
    <div className="shell pt-10 pb-20">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.metadata.title,
            datePublished: post.metadata.publishedAt,
            dateModified: post.metadata.publishedAt,
            description: post.metadata.summary,
            image: post.metadata.image,
            url: `${siteConfig.url}/blog/${post.slug}`,
            author: {
              '@type': 'Person',
              name: post.metadata.author,
            },
          }),
        }}
      />

      <div className="mx-auto w-full max-w-[44rem]">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          blog
        </Link>

        <header className="mt-8 mb-10">
          <div className="flex items-center gap-3 font-mono text-[11.5px] tracking-wide text-muted-foreground">
            <time dateTime={post.metadata.publishedAt} className="tnum">
              {formatDate(post.metadata.publishedAt)}
            </time>
            <span aria-hidden>·</span>
            <span>{post.metadata.author}</span>
          </div>
          <h1 className="mt-4 font-display text-[2rem] font-semibold leading-tight tracking-tight text-balance md:text-[2.5rem]">
            {post.metadata.title}
          </h1>
        </header>

        <article
          className="prose prose-neutral max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-ledger prose-a:decoration-ledger/40 prose-strong:font-semibold prose-code:before:content-none prose-code:after:content-none"
          dangerouslySetInnerHTML={{ __html: post.source }}
        />
      </div>
    </div>
  );
}
