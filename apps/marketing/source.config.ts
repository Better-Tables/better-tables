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
// or empty dates; when it is absent, the docs page hides its last-updated
// badge and the sitemap omits the field for docs entries.
export default defineConfig({
  mdxOptions: {
    // default Fumadocs MDX presets (rehype code, GFM, etc.)
  },
});
