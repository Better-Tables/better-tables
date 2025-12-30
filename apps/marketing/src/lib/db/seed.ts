import { seed } from 'drizzle-seed';
import type { getDatabase } from './index';
import { schema } from './schema';

type DatabaseType = Awaited<ReturnType<typeof getDatabase>>['db'];

export async function seedDatabase(db: DatabaseType) {
  // Use drizzle-seed to generate 5000 users with related profiles and posts
  // Type assertion needed because drizzle-seed has strict type requirements
  // that don't match the inferred type from drizzle() with spread schema
  // biome-ignore lint/suspicious/noExplicitAny: drizzle-seed type compatibility issue
  await seed(db as any, schema, {
    count: 5000,
    seed: 12345, // Deterministic seed for reproducible data
    // biome-ignore lint/suspicious/noExplicitAny: drizzle-seed function types
  }).refine((f: any) => ({
    users: {
      count: 5000,
      columns: {
        name: f.fullName(),
        email: f.email(),
        age: f.int({ minValue: 18, maxValue: 65, isUnique: false }),
        role: f.valuesFromArray({
          values: ['admin', 'editor', 'viewer', 'contributor'],
        }),
        status: f.valuesFromArray({
          values: ['active', 'inactive', 'pending', 'suspended'],
        }),
        createdAt: f.date({
          minDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          maxDate: new Date().toISOString(),
        }),
      },
      with: {
        profiles: [
          { weight: 0.7, count: 1 }, // 70% of users have 1 profile
          { weight: 0.3, count: 0 }, // 30% of users have no profile
        ],
        posts: [
          { weight: 0.3, count: [0, 1, 2] }, // 30% chance of 0-2 posts
          { weight: 0.4, count: [3, 4, 5] }, // 40% chance of 3-5 posts
          { weight: 0.2, count: [6, 7, 8] }, // 20% chance of 6-8 posts
          { weight: 0.1, count: [9, 10, 11, 12] }, // 10% chance of 9-12 posts
        ], // Total: 0.3 + 0.4 + 0.2 + 0.1 = 1.0 ✓
      },
    },
    profiles: {
      columns: {
        bio: f.loremIpsum({ minWords: 10, maxWords: 30 }),
        avatar: f.valuesFromArray({
          values: Array.from({ length: 100 }, (_, i) => `avatar${i + 1}.jpg`),
        }),
        website: f.valuesFromArray({
          values: Array.from({ length: 100 }, (_, i) => `https://example${i + 1}.dev`),
        }),
        location: f.valuesFromArray({
          values: [
            'New York',
            'San Francisco',
            'Los Angeles',
            'Chicago',
            'Boston',
            'Seattle',
            'Austin',
            'Denver',
            'Portland',
            'Miami',
            'Washington',
            'Phoenix',
            'Atlanta',
            'Dallas',
            'Houston',
            'Philadelphia',
            'San Diego',
            'Minneapolis',
            'Detroit',
            'Baltimore',
            'Nashville',
            'Charlotte',
            'Indianapolis',
            'Columbus',
          ],
        }),
        github: f.valuesFromArray({
          values: Array.from({ length: 1000 }, (_, i) => `user${i + 1}`),
        }),
      },
    },
    posts: {
      columns: {
        title: f.valuesFromArray({
          values: [
            'Getting Started with React',
            'TypeScript Best Practices',
            'Building Scalable Applications',
            'Database Design Patterns',
            'API Development Guide',
            'Testing Strategies',
            'Performance Optimization',
            'Security Best Practices',
            'Next.js Deep Dive',
            'State Management in 2024',
            'CSS Grid Mastery',
            'GraphQL vs REST',
            'Microservices Architecture',
            'Kubernetes Production Guide',
            'Docker Best Practices',
            'CI/CD Pipeline Setup',
            'Web Security Essentials',
            'React Native Performance',
            'Vue.js Advanced Patterns',
            'Node.js Optimization',
          ],
        }),
        content: f.loremIpsum({ minWords: 50, maxWords: 200 }),
        published: f.int({ minValue: 0, maxValue: 1 }),
        views: f.int({ minValue: 0, maxValue: 10000 }),
        likes: f.int({ minValue: 0, maxValue: 500 }),
        createdAt: f.date({
          minDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          maxDate: new Date().toISOString(),
        }),
      },
    },
  }));
}
