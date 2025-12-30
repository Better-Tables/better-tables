import { DatabaseIcon, FilterIcon, LinkIcon, TableIcon, TypeIcon, ZapIcon } from 'lucide-react';
import { Icons } from '@/components/icons';

export const BLUR_FADE_DELAY = 0.15;

export const siteConfig = {
  name: 'Better Tables',
  description:
    'Type-safe, database-agnostic table library for React with advanced filtering, sorting, and virtual scrolling.',
  cta: 'Get Started',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  keywords: [
    'Better Tables',
    'React Tables',
    'Type-safe Tables',
    'Database Adapters',
    'Drizzle ORM',
    'Table Filtering',
    'Virtual Scrolling',
  ],
  links: {
    email: 'support@better-tables.com',
    twitter: 'https://twitter.com/bettertables',
    discord: 'https://discord.gg/bettertables',
    github: 'https://github.com/Better-Tables/better-tables',
    instagram: 'https://instagram.com/bettertables',
  },
  hero: {
    title: 'Better Tables',
    description:
      'The React table library you wished existed. Define your columns once, and get powerful filtering, sorting, pagination, and virtualization—all with end-to-end type safety across your database queries and UI components.',
    cta: 'Get Started',
    ctaDescription: 'Stop writing boilerplate. Start shipping features.',
  },
  features: [
    {
      name: 'Automatic Relationship Filtering',
      description:
        'Filter across joined tables without writing JOIN queries. The adapter automatically detects relationships, builds queries, and maintains type safety.',
      icon: <DatabaseIcon className="h-6 w-6" />,
    },
    {
      name: 'Advanced Filtering System',
      description:
        'Six filter types with 20+ operators. Filters persist in the URL, making every view shareable.',
      icon: <FilterIcon className="h-6 w-6" />,
    },
    {
      name: 'Database Adapters',
      description:
        'Connect to any backend with a consistent API. Currently supports Drizzle ORM with more adapters coming.',
      icon: <TableIcon className="h-6 w-6" />,
    },
    {
      name: 'Virtual Scrolling',
      description:
        'Render millions of rows efficiently with built-in virtualization for large datasets.',
      icon: <ZapIcon className="h-6 w-6" />,
    },
    {
      name: 'URL State Persistence',
      description:
        'Every filter, sort, and pagination state syncs to the URL. Users can bookmark and share filtered views.',
      icon: <LinkIcon className="h-6 w-6" />,
    },
    {
      name: 'Type-Safe End-to-End',
      description:
        'Full TypeScript inference from your database schema to your UI components. Catch errors at compile time, not runtime.',
      icon: <TypeIcon className="h-6 w-6" />,
    },
  ],
  pricing: [
    {
      name: 'Open Source',
      price: { monthly: 'Free', yearly: 'Free' },
      frequency: { monthly: 'forever', yearly: 'forever' },
      description: 'Perfect for individuals and small projects.',
      features: [
        'All core features included',
        'Automatic relationship filtering',
        'Advanced filtering system',
        'Community support',
        'MIT License',
        'Full source code access',
      ],
      cta: 'Get Started',
      popular: true,
    },
    {
      name: 'Pro',
      price: { monthly: 'Coming Soon', yearly: 'Coming Soon' },
      frequency: { monthly: '', yearly: '' },
      description: 'Ideal for professionals and growing businesses.',
      features: [
        'Everything in Open Source',
        'Priority support',
        'Premium adapters',
        'Advanced features',
        'Commercial license',
        'SLA guarantee',
      ],
      cta: 'Contact Us',
    },
    {
      name: 'Enterprise',
      price: { monthly: 'Custom', yearly: 'Custom' },
      frequency: { monthly: '', yearly: '' },
      description: 'Tailored solutions for large organizations.',
      features: [
        'Everything in Pro',
        'Dedicated support',
        'Custom development',
        'On-premises deployment',
        'Training & onboarding',
        'Custom SLA',
      ],
      cta: 'Contact Sales',
    },
  ],
  footer: {
    socialLinks: [
      {
        icon: <Icons.github className="h-5 w-5" />,
        url: '#',
      },
      {
        icon: <Icons.twitter className="h-5 w-5" />,
        url: '#',
      },
    ],
    links: [
      { text: 'Pricing', url: '#' },
      { text: 'Contact', url: '#' },
    ],
    bottomText: 'All rights reserved.',
    brandText: 'BETTER TABLES',
  },

  testimonials: [
    {
      id: 1,
      text: 'Better Tables has eliminated all the boilerplate we used to write for table filtering. The automatic relationship handling is pure magic.',
      name: 'Alice Johnson',
      company: 'DataFlow Inc',
      image:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8cG9ydHJhaXR8ZW58MHx8MHx8fDA%3D',
    },
    {
      id: 2,
      text: "We've cut our table implementation time by 70%. The type safety from database to UI caught bugs we would have missed in production.",
      name: 'Bob Brown',
      company: 'TechStart',
      image:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 3,
      text: "Filtering across relationships without writing JOINs? That's the feature I didn't know I needed. It's saved us weeks of development time.",
      name: 'Charlie Davis',
      company: 'CloudScale',
      image:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 4,
      text: "The URL state persistence means our users can bookmark and share filtered views. It's a game-changer for our analytics dashboard.",
      name: 'Diana Evans',
      company: 'Analytics Pro',
      image:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mjh8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 5,
      text: 'Virtual scrolling handles our million-row datasets smoothly. The performance is incredible, and the API is so simple.',
      name: 'Ethan Ford',
      company: 'BigData Solutions',
      image:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzJ8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 6,
      text: 'The Drizzle adapter integration is seamless. We defined our schema once, and filters just work across all relationships automatically.',
      name: 'Fiona Grant',
      company: 'DevOps Co',
      image:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDB8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 7,
      text: 'No more prop drilling or scattered useState hooks. Better Tables handles all the state management, and the code is so much cleaner.',
      name: 'George Harris',
      company: 'CodeCraft',
      image:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDR8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 8,
      text: "The declarative column API is brilliant. Define once, get filtering, sorting, and pagination automatically. It's exactly what we needed.",
      name: 'Hannah Irving',
      company: 'StartupHub',
      image:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTJ8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 9,
      text: "Type safety from database to UI means we catch errors at compile time. It's prevented so many runtime bugs in our production app.",
      name: 'Ian Johnson',
      company: 'TypeSafe Systems',
      image:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NTZ8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 10,
      text: 'The documentation is excellent, and the demo app shows everything in action. We were up and running in minutes.',
      name: 'Julia Kim',
      company: 'QuickStart Dev',
      image:
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NjR8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 11,
      text: 'Better Tables is the React table library I wished existed. It handles all the complexity so we can focus on building features.',
      name: 'Kevin Lee',
      company: 'FeatureFirst',
      image:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NzB8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 12,
      text: "The advanced filtering system with 20+ operators covers all our use cases. We haven't needed to write a single custom filter.",
      name: 'Laura Martinez',
      company: 'FilterPro',
      image:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NzZ8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 13,
      text: 'Zero boilerplate, maximum features. Better Tables delivers on its promise. Our codebase is cleaner and more maintainable.',
      name: 'Michael Chen',
      company: 'CleanCode Labs',
      image:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8ODJ8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 14,
      text: 'The performance with virtual scrolling is outstanding. We can render millions of rows without any lag or memory issues.',
      name: 'Natalie Wong',
      company: 'Performance Co',
      image:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8ODh8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
    {
      id: 15,
      text: 'Better Tables has become essential to our stack. The automatic relationship filtering alone saves us hours every week.',
      name: 'Oliver Smith',
      company: 'TimeSaver Dev',
      image:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OTR8fHBvcnRyYWl0fGVufDB8fDB8fHww',
    },
  ],
};

export type SiteConfig = typeof siteConfig;
