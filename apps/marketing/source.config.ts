import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// Omit fumadocs-mdx `lastModified()` — it shells out to git per page and
// needs a full (non-shallow) clone. Shallow CI/Vercel checkouts yield wrong
// or empty dates; sitemap/docs already fall back when `lastModified` is absent.
export default defineConfig({
  mdxOptions: {
    // default Fumadocs MDX presets (rehype code, GFM, etc.)
  },
});
