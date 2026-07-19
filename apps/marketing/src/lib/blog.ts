import fs from 'node:fs';
import path from 'node:path';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { siteConfig } from '@/lib/config';

export type Post = {
  title: string;
  publishedAt: string;
  summary: string;
  author: string;
  slug: string;
  image?: string;
};

function parseFrontmatter(fileContent: string) {
  const frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
  const match = frontmatterRegex.exec(fileContent);
  const frontMatterBlock = match?.[1];
  const content = fileContent.replace(frontmatterRegex, '').trim();
  if (!frontMatterBlock) {
    throw new Error('Missing frontmatter block');
  }
  const frontMatterLines = frontMatterBlock.trim().split('\n');
  const metadata: Partial<Post> = {};

  frontMatterLines.forEach((line) => {
    const [key, ...valueArr] = line.split(': ');
    let value = valueArr.join(': ').trim();
    value = value.replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
    metadata[key.trim() as keyof Post] = value;
  });

  return { data: metadata as Post, content };
}

function getMDXFiles(dir: string) {
  return fs.readdirSync(dir).filter((file) => path.extname(file) === '.mdx');
}

export async function markdownToHTML(markdown: string) {
  const p = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      // https://rehype-pretty.pages.dev/#usage — single theme; the vessel
      // (.prose pre) paints the site's code-island background.
      theme: 'everforest-dark',
      keepBackground: false,
    })
    .use(rehypeStringify)
    .process(markdown);

  return p.toString();
}

export async function getPost(slug: string) {
  // Reject anything that isn't a plain slug before touching the filesystem.
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    return null;
  }
  const filePath = path.join('content', `${slug}.mdx`);
  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
  const { content: rawContent, data: metadata } = parseFrontmatter(source);
  const content = await markdownToHTML(rawContent);
  const defaultImage = `${siteConfig.url}/og?title=${encodeURIComponent(metadata.title)}`;
  return {
    source: content,
    metadata: {
      ...metadata,
      image: metadata.image || defaultImage,
    },
    slug,
  };
}

async function getAllPosts(dir: string) {
  const mdxFiles = getMDXFiles(dir);
  const posts = await Promise.all(
    mdxFiles.map(async (file) => {
      const slug = path.basename(file, path.extname(file));
      const post = await getPost(slug);
      return post ? { ...post.metadata, slug, source: post.source } : null;
    })
  );
  return posts.filter((post): post is NonNullable<typeof post> => post !== null);
}

export async function getBlogPosts() {
  return getAllPosts(path.join(process.cwd(), 'content'));
}
