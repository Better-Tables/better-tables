import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { siteConfig } from '@/lib/config';
import { cn } from '@/lib/utils';

export function MobileDrawer() {
  return (
    <Drawer>
      <DrawerTrigger
        render={
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
            aria-label="Open menu"
          />
        }
      >
        <Menu />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="px-6">
          <Link href="/" title="brand-logo" className="relative mr-6 flex items-center gap-2">
            <Icons.logo className="h-10 w-auto" />
            <DrawerTitle>{siteConfig.name}</DrawerTitle>
          </Link>
          <DrawerDescription>{siteConfig.description}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Link
            href="#"
            className={cn(buttonVariants({ variant: 'default' }), 'rounded-full text-white')}
          >
            {siteConfig.cta}
          </Link>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
