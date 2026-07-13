'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Section } from '@/components/section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

function PricingTier({
  tier,
  billingCycle,
}: {
  tier: (typeof siteConfig.pricing)[0];
  billingCycle: 'monthly' | 'yearly';
}) {
  return (
    <div
      className={cn(
        'outline-focus transition-transform-background relative z-10 box-border grid h-full w-full overflow-hidden text-foreground motion-reduce:transition-none lg:border-r border-t last:border-r-0',
        tier.popular ? 'bg-primary/5' : 'text-foreground'
      )}
    >
      <div className="flex flex-col h-full">
        <CardHeader className="border-b p-4 grid grid-rows-2 h-fit">
          <CardTitle className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{tier.name}</span>
            {tier.popular && (
              <Badge
                variant="secondary"
                className="bg-primary text-primary-foreground hover:bg-secondary-foreground"
              >
                Most Popular
              </Badge>
            )}
          </CardTitle>
          <div className="pt-2 text-3xl font-bold">
            <motion.div
              key={tier.price[billingCycle]}
              initial={{
                opacity: 0,
                x: billingCycle === 'yearly' ? -10 : 10,
                filter: 'blur(5px)',
              }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1],
              }}
            >
              {tier.price[billingCycle]}
              <span className="text-sm font-medium text-muted-foreground">
                / {tier.frequency[billingCycle]}
              </span>
            </motion.div>
          </div>
          <p className="text-[15px] font-medium text-muted-foreground">{tier.description}</p>
        </CardHeader>

        <CardContent className="flex-grow p-4 pt-5">
          <ul className="space-y-2">
            {tier.features.map((feature, featureIndex) => (
              <li key={featureIndex} className="flex items-center">
                <Check className="mr-2 size-4 text-green-500" />
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <Button
          size="lg"
          className={cn(
            'w-full rounded-none shadow-none',
            tier.popular
              ? 'bg-primary text-primary-foreground hover:bg-secondary-foreground'
              : 'bg-muted text-foreground hover:bg-muted/80'
          )}
        >
          {tier.cta}
        </Button>
      </div>
    </div>
  );
}

export function Pricing() {
  const [billingCycle] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <Section id="pricing" title="Pricing">
      <div className="border border-b-0 grid grid-rows-1">
        <div className="grid grid-rows-1 gap-y-10 p-10">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-balance">
              Get Started Today
            </h2>

            <p className="mt-6 text-balance text-muted-foreground">
              Better Tables is <strong>open source</strong> and free to use. Start building powerful
              data tables today.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3">
          {siteConfig.pricing.map((tier, index) => (
            <PricingTier key={index} tier={tier} billingCycle={billingCycle} />
          ))}
        </div>
      </div>
    </Section>
  );
}
