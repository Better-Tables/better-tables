import { ClosingCta } from '@/components/home/closing-cta';
import { ExamplesIndex } from '@/components/home/examples-index';
import { FeaturesSpec } from '@/components/home/features-spec';
import { Hero } from '@/components/home/hero';
import { LiveDemo } from '@/components/home/live-demo';
import { Pipeline } from '@/components/home/pipeline';

interface HomeProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    filters?: string;
    sorting?: string;
  }>;
}

export default async function Home({ searchParams }: HomeProps) {
  return (
    <main>
      <Hero />
      <LiveDemo searchParams={searchParams} />
      <Pipeline />
      <ExamplesIndex />
      <FeaturesSpec />
      <ClosingCta />
    </main>
  );
}
