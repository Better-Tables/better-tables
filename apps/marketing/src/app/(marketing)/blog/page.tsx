import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import { getBlogPosts } from '@/lib/blog';
import { constructMetadata, formatDate } from '@/lib/utils';

export const metadata = constructMetadata({
  title: 'Blog',
  description: 'Release notes, design notes, and progress on Better Tables.',
});

export default async function Blog() {
  const allPosts = await getBlogPosts();
  const articles = allPosts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return (
    <div className="shell pt-14 pb-20 md:pt-20">
      <div className="max-w-2xl">
        <p className="row-eyebrow">
          <b>{String(articles.length).padStart(2, '0')}</b>
          entries
        </p>
        <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-tight tracking-tight md:text-[3rem]">
          Blog
        </h1>
        <p className="mt-4 text-[15.5px] leading-relaxed text-muted-foreground">
          Release notes, design notes, and progress.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-lg border bg-card">
        {articles.map((post, i) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className={[
              'group grid gap-x-6 gap-y-1 px-5 py-5 transition-colors hover:bg-ledger-wash md:grid-cols-[10rem_1fr_2.5rem] md:items-baseline md:px-7',
              i > 0 ? 'border-t' : '',
            ].join(' ')}
          >
            <time
              dateTime={post.publishedAt}
              className="tnum font-mono text-[11.5px] tracking-wide text-muted-foreground"
            >
              {formatDate(post.publishedAt)}
            </time>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-display text-[17px] font-semibold tracking-tight">
                {post.title}
              </span>
              <span className="max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
                {post.summary}
              </span>
            </span>
            <span className="hidden self-center justify-self-end text-muted-foreground transition-colors group-hover:text-ledger md:block">
              <ArrowRightIcon className="size-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
