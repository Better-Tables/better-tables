import { sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// biome-ignore lint/suspicious/noExplicitAny: Database type is complex and varies by driver
export async function seedDatabase(db: BetterSQLite3Database<any>) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;
  const threeMonths = 90 * oneDay;
  const sixMonths = 180 * oneDay;

  // Seed users with varied data (some with NULL ages for testing includeNull feature)
  await db.run(sql`INSERT INTO users (id, name, email, age, role, status, created_at) VALUES 
    (1, 'Alice Johnson', 'alice@example.com', 28, 'admin', 'active', ${now - sixMonths}),
    (2, 'Bob Smith', 'bob@example.com', 34, 'editor', 'active', ${now - sixMonths}),
    (3, 'Carol Williams', 'carol@example.com', 25, 'contributor', 'active', ${now - threeMonths}),
    (4, 'David Brown', 'david@example.com', 42, 'viewer', 'active', ${now - threeMonths}),
    (5, 'Emma Davis', 'emma@example.com', 31, 'editor', 'active', ${now - threeMonths}),
    (6, 'Frank Miller', 'frank@example.com', 29, 'contributor', 'inactive', ${now - oneMonth}),
    (7, 'Grace Wilson', 'grace@example.com', 36, 'admin', 'active', ${now - oneMonth}),
    (8, 'Henry Moore', 'henry@example.com', 27, 'viewer', 'pending', ${now - oneMonth}),
    (9, 'Iris Taylor', 'iris@example.com', 33, 'contributor', 'active', ${now - oneMonth}),
    (10, 'Jack Anderson', 'jack@example.com', 45, 'editor', 'active', ${now - oneWeek}),
    (11, 'Kate Thomas', 'kate@example.com', 26, 'contributor', 'active', ${now - oneWeek}),
    (12, 'Liam Jackson', 'liam@example.com', 38, 'viewer', 'suspended', ${now - oneWeek}),
    (13, 'Mia White', 'mia@example.com', 30, 'editor', 'active', ${now - oneWeek}),
    (14, 'Noah Harris', 'noah@example.com', 35, 'contributor', 'active', ${now - oneWeek}),
    (15, 'Olivia Martin', 'olivia@example.com', 24, 'viewer', 'active', ${now - oneDay * 3}),
    (16, 'Paul Thompson', 'paul@example.com', 40, 'admin', 'active', ${now - oneDay * 3}),
    (17, 'Quinn Garcia', 'quinn@example.com', 32, 'contributor', 'inactive', ${now - oneDay * 3}),
    (18, 'Rachel Martinez', 'rachel@example.com', 27, 'editor', 'active', ${now - oneDay * 2}),
    (19, 'Sam Robinson', 'sam@example.com', 29, 'contributor', 'active', ${now - oneDay * 2}),
    (20, 'Tina Clark', 'tina@example.com', 37, 'viewer', 'active', ${now - oneDay}),
    (21, 'Uma Rodriguez', 'uma@example.com', 31, 'contributor', 'active', ${now - oneDay}),
    (22, 'Victor Lewis', 'victor@example.com', 44, 'editor', 'active', ${now - oneDay}),
    (23, 'Wendy Lee', 'wendy@example.com', 26, 'viewer', 'pending', ${now}),
    (24, 'Xavier Walker', 'xavier@example.com', 33, 'contributor', 'active', ${now}),
    (25, 'Yara Hall', 'yara@example.com', 28, 'editor', 'active', ${now}),
    (26, 'Zoe Young', 'zoe@example.com', ${null}, 'viewer', 'active', ${now - oneWeek}),
    (27, 'Adam King', 'adam@example.com', ${null}, 'contributor', 'active', ${now - oneDay}),
    (28, 'Bella Wright', 'bella@example.com', ${null}, 'editor', 'pending', ${now})`);

  // Seed profiles (not all users have profiles)
  await db.run(sql`INSERT INTO profiles (id, user_id, bio, avatar, website, location, github) VALUES 
    (1, 1, 'Full-stack developer passionate about React and TypeScript. Building the future of web development.', 'avatar1.jpg', 'https://alice.dev', 'San Francisco, CA', 'alice'),
    (2, 2, 'Technical writer and content strategist. I love making complex topics simple and accessible.', 'avatar2.jpg', 'https://bobsmith.com', 'New York, NY', 'bobsmith'),
    (3, 3, 'UI/UX Designer creating beautiful user experiences. Design is not just what it looks like - it''s how it works.', 'avatar3.jpg', 'https://carolwilliams.design', 'Austin, TX', 'carolw'),
    (4, 5, 'Software architect with 10+ years of experience. Specializing in scalable cloud solutions.', 'avatar5.jpg', 'https://emmadavis.tech', 'Seattle, WA', 'emmadev'),
    (5, 7, 'Product manager and data enthusiast. Turning insights into impactful products.', 'avatar7.jpg', 'https://gracewilson.io', 'Boston, MA', 'gwilson'),
    (6, 9, 'Backend engineer focused on performance and reliability. Go and Rust advocate.', 'avatar9.jpg', 'https://iristaylor.dev', 'Denver, CO', 'iristaylor'),
    (7, 10, 'DevOps engineer and cloud architect. Kubernetes and infrastructure as code enthusiast.', 'avatar10.jpg', 'https://jackanderson.cloud', 'Portland, OR', 'janderson'),
    (8, 13, 'Frontend developer specializing in React and Vue. Creating delightful user interfaces.', 'avatar13.jpg', 'https://miawhite.dev', 'Los Angeles, CA', 'miawhite'),
    (9, 16, 'Engineering leader and open source contributor. Building teams and technology.', 'avatar16.jpg', 'https://paulthompson.io', 'Chicago, IL', 'pthompson'),
    (10, 18, 'Data scientist and ML engineer. Making sense of data to drive business decisions.', 'avatar18.jpg', 'https://rachelmartinez.ai', 'Miami, FL', 'rmartinez'),
    (11, 22, 'Security engineer and ethical hacker. Keeping the web safe one vulnerability at a time.', 'avatar22.jpg', 'https://victorlewis.security', 'Washington, DC', 'vlewis'),
    (12, 25, 'Mobile developer building cross-platform apps. React Native and Flutter expert.', 'avatar25.jpg', 'https://yarahall.app', 'Phoenix, AZ', 'yarahall')`);

  // Seed categories
  await db.run(sql`INSERT INTO categories (id, name, color, description) VALUES 
    (1, 'Technology', '#3B82F6', 'Posts about technology, programming, and software development'),
    (2, 'Design', '#EC4899', 'UI/UX design, visual design, and design systems'),
    (3, 'Business', '#10B981', 'Business strategy, startups, and entrepreneurship'),
    (4, 'DevOps', '#8B5CF6', 'Infrastructure, deployment, and operations'),
    (5, 'Data Science', '#F59E0B', 'Data analysis, machine learning, and AI'),
    (6, 'Security', '#EF4444', 'Cybersecurity, privacy, and secure coding practices'),
    (7, 'Mobile', '#06B6D4', 'Mobile app development and mobile-first design'),
    (8, 'Tutorial', '#6366F1', 'Step-by-step guides and how-to articles')`);

  // Seed posts with varied data
  await db.run(sql`INSERT INTO posts (id, user_id, title, content, published, views, likes, created_at) VALUES 
    (1, 1, 'Getting Started with React 19', 'React 19 introduces many exciting features including improved concurrent rendering and better TypeScript support. In this article, we''ll explore the new APIs and how to leverage them in your applications.', 1, 3245, 127, ${now - sixMonths}),
    (2, 1, 'TypeScript Best Practices', 'Here are some TypeScript patterns I use daily to write more maintainable and type-safe code. We''ll cover utility types, advanced generics, and common pitfalls to avoid.', 1, 2890, 98, ${now - threeMonths}),
    (3, 2, 'Writing Technical Documentation', 'Good documentation is key to project success. Learn how to write clear, concise, and useful technical docs that your team will actually read.', 1, 1567, 67, ${now - threeMonths}),
    (4, 3, 'Design Systems in 2024', 'Building scalable design systems for modern web applications. We''ll cover component libraries, design tokens, and how to maintain consistency across products.', 1, 4521, 189, ${now - threeMonths}),
    (5, 3, 'Color Theory for Developers', 'Understanding color in web design: accessibility, contrast ratios, and creating harmonious color palettes.', 1, 2103, 84, ${now - oneMonth}),
    (6, 5, 'Microservices Architecture', 'When to use microservices and when to stick with a monolith. Real-world lessons from building scalable systems.', 1, 3789, 156, ${now - oneMonth}),
    (7, 7, 'Product Metrics That Matter', 'Stop tracking vanity metrics. Here are the KPIs that actually indicate product-market fit and user engagement.', 1, 2945, 112, ${now - oneMonth}),
    (8, 9, 'Optimizing Go Applications', 'Performance optimization techniques for Go: profiling, memory management, and concurrent patterns.', 1, 1876, 73, ${now - oneWeek}),
    (9, 10, 'Kubernetes Production Best Practices', 'Lessons learned from running Kubernetes in production: monitoring, security, and cost optimization.', 1, 5234, 234, ${now - oneWeek}),
    (10, 10, 'CI/CD Pipeline Setup Guide', 'Building a robust CI/CD pipeline from scratch using GitHub Actions and Docker.', 1, 3421, 145, ${now - oneWeek}),
    (11, 13, 'Advanced React Patterns', 'Exploring compound components, render props, and custom hooks for building flexible React components.', 1, 2765, 108, ${now - oneWeek}),
    (12, 13, 'State Management in 2024', 'Comparing state management solutions: Redux, Zustand, Jotai, and React Context. Which one should you choose?', 1, 4123, 178, ${now - oneDay * 3}),
    (13, 16, 'Building High-Performance Teams', 'How to create a culture of ownership, continuous learning, and psychological safety in engineering teams.', 1, 2134, 87, ${now - oneDay * 3}),
    (14, 18, 'Machine Learning for Beginners', 'Introduction to ML concepts: supervised learning, neural networks, and practical applications.', 1, 3987, 167, ${now - oneDay * 2}),
    (15, 18, 'Data Visualization Best Practices', 'Creating compelling data visualizations that tell a story and drive insights.', 1, 2456, 94, ${now - oneDay * 2}),
    (16, 22, 'Web Security Essentials', 'Protecting your applications from common vulnerabilities: XSS, CSRF, SQL injection, and more.', 1, 4567, 198, ${now - oneDay}),
    (17, 22, 'Zero Trust Architecture', 'Implementing zero trust security principles in modern cloud environments.', 1, 3210, 134, ${now - oneDay}),
    (18, 25, 'React Native Performance', 'Optimizing React Native apps for smooth 60fps performance on both iOS and Android.', 1, 2890, 112, ${now - oneDay}),
    (19, 1, 'Next.js 15 Deep Dive', 'Exploring the new features in Next.js 15: partial prerendering, improved caching, and React 19 support.', 1, 1987, 76, ${now}),
    (20, 3, 'Figma to Code Workflow', 'Streamlining the design-to-development handoff process using modern tools and techniques.', 0, 156, 12, ${now})`);

  // Add more posts for variety
  await db.run(sql`INSERT INTO posts (id, user_id, title, content, published, views, likes, created_at) VALUES 
    (21, 5, 'GraphQL vs REST', 'Comparing API design approaches and when to use each in your projects.', 1, 2345, 89, ${now - oneMonth}),
    (22, 7, 'User Research Techniques', 'Conducting effective user interviews and usability testing sessions.', 1, 1234, 54, ${now - oneWeek}),
    (23, 9, 'Rust for Backend Development', 'Why Rust is gaining traction for backend services and how to get started.', 1, 1876, 67, ${now - oneWeek}),
    (24, 2, 'API Documentation Guide', 'Writing clear API documentation that developers will love using.', 1, 987, 43, ${now - oneDay * 4}),
    (25, 11, 'CSS Grid Mastery', 'Advanced CSS Grid techniques for complex layouts.', 1, 1456, 62, ${now - oneDay * 3})`);

  // Seed comments
  await db.run(sql`INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES 
    (1, 1, 2, 'Great article! Very comprehensive overview of React 19 features.', ${now - sixMonths + oneDay}),
    (2, 1, 3, 'The concurrent rendering improvements are game-changing.', ${now - sixMonths + oneDay * 2}),
    (3, 1, 5, 'Thanks for the detailed examples. Very helpful!', ${now - sixMonths + oneDay * 3}),
    (4, 2, 3, 'These TypeScript patterns are exactly what I needed.', ${now - threeMonths + oneDay}),
    (5, 2, 7, 'The utility types section is gold. Bookmarked!', ${now - threeMonths + oneDay * 2}),
    (6, 4, 1, 'Love the design system approach. We''re implementing something similar.', ${now - threeMonths + oneDay}),
    (7, 4, 2, 'The component library section is very thorough.', ${now - threeMonths + oneDay * 2}),
    (8, 4, 5, 'Great insights on maintaining consistency across products.', ${now - threeMonths + oneDay * 3}),
    (9, 6, 1, 'Excellent breakdown of microservices vs monolith trade-offs.', ${now - oneMonth + oneDay}),
    (10, 6, 10, 'The real-world examples really helped clarify the concepts.', ${now - oneMonth + oneDay * 2}),
    (11, 9, 1, 'This is the best Kubernetes production guide I''ve read.', ${now - oneWeek + oneDay}),
    (12, 9, 5, 'The monitoring section is particularly valuable.', ${now - oneWeek + oneDay}),
    (13, 9, 13, 'Saved us hours of troubleshooting. Thank you!', ${now - oneWeek + oneDay * 2}),
    (14, 12, 1, 'Excellent comparison of state management solutions.', ${now - oneDay * 3 + oneDay}),
    (15, 12, 5, 'Zustand looks very promising for our use case.', ${now - oneDay * 3 + oneDay}),
    (16, 14, 1, 'Great introduction to ML concepts. Very accessible.', ${now - oneDay * 2 + oneDay}),
    (17, 14, 3, 'The neural networks explanation is very clear.', ${now - oneDay * 2 + oneDay}),
    (18, 16, 1, 'Essential reading for every web developer.', ${now - oneDay + oneDay}),
    (19, 16, 5, 'The XSS prevention section is extremely important.', ${now - oneDay + oneDay}),
    (20, 16, 13, 'Implementing these security practices in our app now.', ${now - oneDay + oneDay})`);

  // Add more comments for other posts
  await db.run(sql`INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES 
    (21, 3, 5, 'Documentation is often overlooked but so important.', ${now - threeMonths + oneDay}),
    (22, 5, 1, 'The color accessibility tips are very practical.', ${now - oneMonth + oneDay}),
    (23, 7, 1, 'Finally, metrics that actually matter for product growth.', ${now - oneMonth + oneDay}),
    (24, 8, 1, 'These Go optimization techniques are very effective.', ${now - oneWeek + oneDay}),
    (25, 10, 5, 'The GitHub Actions examples are super helpful.', ${now - oneWeek + oneDay}),
    (26, 11, 2, 'Compound components are my favorite pattern.', ${now - oneWeek + oneDay}),
    (27, 13, 1, 'Building great teams is harder than building great code.', ${now - oneDay * 3 + oneDay}),
    (28, 15, 5, 'Data visualization is an art form.', ${now - oneDay * 2 + oneDay}),
    (29, 17, 1, 'Zero trust is the future of security.', ${now - oneDay + oneDay}),
    (30, 18, 3, '60fps is crucial for mobile app success.', ${now - oneDay + oneDay})`);

  // Seed post categories (many-to-many relationships)
  await db.run(sql`INSERT INTO post_categories (post_id, category_id) VALUES 
    (1, 1), (1, 8),
    (2, 1), (2, 8),
    (3, 1),
    (4, 2),
    (5, 2),
    (6, 1), (6, 4),
    (7, 3),
    (8, 1), (8, 4),
    (9, 4), (9, 8),
    (10, 4), (10, 8),
    (11, 1), (11, 8),
    (12, 1),
    (13, 3),
    (14, 5), (14, 8),
    (15, 5),
    (16, 6), (16, 8),
    (17, 6), (17, 4),
    (18, 7),
    (19, 1), (19, 8),
    (20, 2),
    (21, 1),
    (22, 2), (22, 3),
    (23, 1), (23, 4),
    (24, 1), (24, 8),
    (25, 2), (25, 8)`);
}
