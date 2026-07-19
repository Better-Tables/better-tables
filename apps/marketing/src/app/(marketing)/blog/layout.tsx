interface BlogLayoutProps {
  children: React.ReactNode;
}

// Header and footer come from the root layout; this layout only provides the
// landmark element for the blog pages.
export default function BlogLayout({ children }: BlogLayoutProps) {
  return <main>{children}</main>;
}
