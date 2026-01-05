/**
 * Database Seed Script for Marketing App
 *
 * Seeds the PostgreSQL database with realistic test data using drizzle-seed.
 * Run with: bun run db:seed
 *
 * Note: Console output is intentional for CLI progress reporting.
 */
import { reset, seed } from 'drizzle-seed';
import { db } from './db';
import * as schema from './schema';

/**
 * Predefined categories with meaningful data
 */
const categoriesData = [
  {
    name: 'Technology',
    color: '#3B82F6',
    description: 'Posts about technology, programming, and software development',
  },
  {
    name: 'Design',
    color: '#EC4899',
    description: 'UI/UX design, visual design, and design systems',
  },
  {
    name: 'Business',
    color: '#10B981',
    description: 'Business strategy, startups, and entrepreneurship',
  },
  { name: 'DevOps', color: '#8B5CF6', description: 'Infrastructure, deployment, and operations' },
  {
    name: 'Data Science',
    color: '#F59E0B',
    description: 'Data analysis, machine learning, and AI',
  },
  {
    name: 'Security',
    color: '#EF4444',
    description: 'Cybersecurity, privacy, and secure coding practices',
  },
  {
    name: 'Mobile',
    color: '#06B6D4',
    description: 'Mobile app development and mobile-first design',
  },
  { name: 'Tutorial', color: '#6366F1', description: 'Step-by-step guides and how-to articles' },
];

/**
 * Seeds the database with test data
 * Total: ~5000 users, ~2000 posts, ~8000 comments
 */
async function seedDatabase(): Promise<void> {
  console.log('🗑️  Resetting database...');
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-seed has complex type requirements
  await reset(db as any, schema);
  console.log('✅ Database reset complete');

  // Seed categories first (fixed data)
  console.log('📁 Seeding categories...');
  await db.insert(schema.categories).values(categoriesData);
  console.log(`✅ Seeded ${categoriesData.length} categories`);

  // Seed users in batches (each batch has unique seed to avoid duplicate UUIDs)
  console.log('👥 Seeding users (1000000 total in batches)...');
  const userBatchSize = 500;
  const totalUsers = 1000000;
  const userBatches = Math.ceil(totalUsers / userBatchSize);

  for (let i = 0; i < userBatches; i++) {
    const batchCount = Math.min(userBatchSize, totalUsers - i * userBatchSize);
    const batchSeed = 100 + i; // Unique seed per batch
    console.log(
      `  📦 Batch ${i + 1}/${userBatches}: Seeding ${batchCount} users (seed: ${batchSeed})...`
    );

    // biome-ignore lint/suspicious/noExplicitAny: drizzle-seed has complex type requirements
    await seed(db as any, { users: schema.users }, { count: batchCount, seed: batchSeed }).refine(
      (funcs) => ({
        users: {
          columns: {
            id: funcs.uuid(),
            name: funcs.fullName(),
            email: funcs.email(),
            age: funcs.weightedRandom([
              { weight: 0.1, value: funcs.int({ minValue: 18, maxValue: 24 }) },
              { weight: 0.35, value: funcs.int({ minValue: 25, maxValue: 35 }) },
              { weight: 0.35, value: funcs.int({ minValue: 36, maxValue: 50 }) },
              { weight: 0.15, value: funcs.int({ minValue: 51, maxValue: 65 }) },
              { weight: 0.05, value: funcs.int({ minValue: 66, maxValue: 80 }) },
            ]),
            role: funcs.weightedRandom([
              { weight: 0.05, value: funcs.valuesFromArray({ values: ['admin'] }) },
              { weight: 0.15, value: funcs.valuesFromArray({ values: ['editor'] }) },
              { weight: 0.5, value: funcs.valuesFromArray({ values: ['viewer'] }) },
              { weight: 0.3, value: funcs.valuesFromArray({ values: ['contributor'] }) },
            ]),
            status: funcs.weightedRandom([
              { weight: 0.75, value: funcs.valuesFromArray({ values: ['active'] }) },
              { weight: 0.1, value: funcs.valuesFromArray({ values: ['inactive'] }) },
              { weight: 0.1, value: funcs.valuesFromArray({ values: ['pending'] }) },
              { weight: 0.05, value: funcs.valuesFromArray({ values: ['suspended'] }) },
            ]),
            createdAt: funcs.date({ minDate: '2022-01-01', maxDate: '2026-01-05' }),
          },
        },
      })
    );
  }
  console.log(`✅ Seeded ${totalUsers} users`);

  // Get all user IDs for foreign key references
  const allUsers = await db.select({ id: schema.users.id }).from(schema.users);
  const userIds = allUsers.map((u) => u.id);
  console.log(`📊 Retrieved ${userIds.length} user IDs`);

  // Seed profiles in batches (about 60% of users have profiles)
  console.log('📝 Seeding profiles...');
  const profileCount = Math.floor(userIds.length * 0.6);
  const profileUserIds = userIds.slice(0, profileCount);
  const profileBatchSize = 500;
  const profileBatches = Math.ceil(profileCount / profileBatchSize);

  for (let i = 0; i < profileBatches; i++) {
    const batchCount = Math.min(profileBatchSize, profileCount - i * profileBatchSize);
    const batchUserIds = profileUserIds.slice(
      i * profileBatchSize,
      i * profileBatchSize + batchCount
    );
    const batchSeed = 200 + i;
    console.log(
      `  📦 Batch ${i + 1}/${profileBatches}: Seeding ${batchCount} profiles (seed: ${batchSeed})...`
    );

    await seed(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle-seed has complex type requirements
      db as any,
      { profiles: schema.profiles },
      { count: batchCount, seed: batchSeed }
    ).refine((funcs) => ({
      profiles: {
        columns: {
          id: funcs.uuid(),
          userId: funcs.valuesFromArray({ values: batchUserIds, isUnique: true }),
          bio: funcs.loremIpsum({ sentencesCount: 2 }),
          avatar: funcs.valuesFromArray({
            values: Array.from(
              { length: 100 },
              (_, j) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${j}`
            ),
          }),
          website: funcs.weightedRandom([
            { weight: 0.5, value: funcs.valuesFromArray({ values: [undefined] }) },
            {
              weight: 0.5,
              value: funcs.valuesFromArray({
                values: [
                  'https://example.dev',
                  'https://portfolio.io',
                  'https://blog.tech',
                  'https://mysite.com',
                ],
              }),
            },
          ]),
          location: funcs.weightedRandom([
            { weight: 0.3, value: funcs.valuesFromArray({ values: [undefined] }) },
            { weight: 0.7, value: funcs.city() },
          ]),
          github: funcs.weightedRandom([
            { weight: 0.4, value: funcs.valuesFromArray({ values: [undefined] }) },
            {
              weight: 0.6,
              value: funcs.valuesFromArray({
                values: ['developer', 'coder', 'techie', 'hacker', 'builder', 'creator'],
              }),
            },
          ]),
        },
      },
    }));
  }
  console.log(`✅ Seeded ${profileCount} profiles`);

  // Seed posts in batches
  console.log('📰 Seeding posts (100000 total in batches)...');
  const postBatchSize = 400;
  const totalPosts = 100000;
  const postBatches = Math.ceil(totalPosts / postBatchSize);

  for (let i = 0; i < postBatches; i++) {
    const batchCount = Math.min(postBatchSize, totalPosts - i * postBatchSize);
    const batchSeed = 300 + i;
    console.log(
      `  📦 Batch ${i + 1}/${postBatches}: Seeding ${batchCount} posts (seed: ${batchSeed})...`
    );

    // biome-ignore lint/suspicious/noExplicitAny: drizzle-seed has complex type requirements
    await seed(db as any, { posts: schema.posts }, { count: batchCount, seed: batchSeed }).refine(
      (funcs) => ({
        posts: {
          columns: {
            id: funcs.uuid(),
            userId: funcs.valuesFromArray({ values: userIds }),
            title: funcs.loremIpsum({ sentencesCount: 1 }),
            content: funcs.loremIpsum({ sentencesCount: 8 }),
            published: funcs.weightedRandom([
              { weight: 0.85, value: funcs.valuesFromArray({ values: [true] }) },
              { weight: 0.15, value: funcs.valuesFromArray({ values: [false] }) },
            ]),
            views: funcs.weightedRandom([
              { weight: 0.4, value: funcs.int({ minValue: 0, maxValue: 500 }) },
              { weight: 0.3, value: funcs.int({ minValue: 500, maxValue: 2000 }) },
              { weight: 0.2, value: funcs.int({ minValue: 2000, maxValue: 5000 }) },
              { weight: 0.1, value: funcs.int({ minValue: 5000, maxValue: 50000 }) },
            ]),
            likes: funcs.weightedRandom([
              { weight: 0.5, value: funcs.int({ minValue: 0, maxValue: 50 }) },
              { weight: 0.3, value: funcs.int({ minValue: 50, maxValue: 200 }) },
              { weight: 0.15, value: funcs.int({ minValue: 200, maxValue: 500 }) },
              { weight: 0.05, value: funcs.int({ minValue: 500, maxValue: 2000 }) },
            ]),
            createdAt: funcs.date({ minDate: '2022-06-01', maxDate: '2026-01-05' }),
          },
        },
      })
    );
  }
  console.log(`✅ Seeded ${totalPosts} posts`);

  // Get all post IDs for comments and post categories
  const allPosts = await db.select({ id: schema.posts.id }).from(schema.posts);
  const postIds = allPosts.map((p) => p.id);
  console.log(`📊 Retrieved ${postIds.length} post IDs`);

  // Get all category IDs
  const allCategories = await db.select({ id: schema.categories.id }).from(schema.categories);
  const categoryIds = allCategories.map((c) => c.id);

  // Seed post categories (each post gets 1-3 categories)
  console.log('🏷️  Seeding post categories...');
  const postCategoryPairs: { postId: string; categoryId: string }[] = [];
  const usedPairs = new Set<string>();

  for (const postId of postIds) {
    const numCategories = Math.floor(Math.random() * 3) + 1;
    const shuffledCategories = [...categoryIds].sort(() => Math.random() - 0.5);

    for (let i = 0; i < numCategories && i < shuffledCategories.length; i++) {
      const categoryId = shuffledCategories[i];
      const pairKey = `${postId}-${categoryId}`;

      if (!usedPairs.has(pairKey)) {
        usedPairs.add(pairKey);
        postCategoryPairs.push({ postId, categoryId });
      }
    }
  }

  // Insert post categories in batches
  const pcBatchSize = 300;
  for (let i = 0; i < postCategoryPairs.length; i += pcBatchSize) {
    const batch = postCategoryPairs.slice(i, i + pcBatchSize);
    await db.insert(schema.postCategories).values(batch);
  }
  console.log(`✅ Seeded ${postCategoryPairs.length} post-category relationships`);

  // Seed comments in batches
  console.log('💬 Seeding comments (100000 total in batches)...');
  const commentBatchSize = 500;
  const totalComments = 100000;
  const commentBatches = Math.ceil(totalComments / commentBatchSize);

  for (let i = 0; i < commentBatches; i++) {
    const batchCount = Math.min(commentBatchSize, totalComments - i * commentBatchSize);
    const batchSeed = 400 + i;
    console.log(
      `  📦 Batch ${i + 1}/${commentBatches}: Seeding ${batchCount} comments (seed: ${batchSeed})...`
    );

    await seed(
      // biome-ignore lint/suspicious/noExplicitAny: drizzle-seed has complex type requirements
      db as any,
      { comments: schema.comments },
      { count: batchCount, seed: batchSeed }
    ).refine((funcs) => ({
      comments: {
        columns: {
          id: funcs.uuid(),
          postId: funcs.valuesFromArray({ values: postIds }),
          userId: funcs.valuesFromArray({ values: userIds }),
          content: funcs.loremIpsum({ sentencesCount: 2 }),
          createdAt: funcs.date({ minDate: '2022-06-01', maxDate: '2026-01-05' }),
        },
      },
    }));
  }
  console.log(`✅ Seeded ${totalComments} comments`);

  console.log('\n🎉 Database seeding complete!');
  console.log('📊 Summary:');
  console.log(`   - Users: ${totalUsers}`);
  console.log(`   - Profiles: ${profileCount}`);
  console.log(`   - Categories: ${categoriesData.length}`);
  console.log(`   - Posts: ${totalPosts}`);
  console.log(`   - Post Categories: ${postCategoryPairs.length}`);
  console.log(`   - Comments: ${totalComments}`);
}

seedDatabase()
  .then(() => {
    console.log('\n✅ Seed script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed script failed:', error);
    process.exit(1);
  });
