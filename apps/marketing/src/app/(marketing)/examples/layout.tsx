interface ExamplesLayoutProps {
  children: React.ReactNode;
}

// Header and footer come from the root layout; this layout only provides the
// landmark element for the example pages.
export default function ExamplesLayout({ children }: ExamplesLayoutProps) {
  return <main>{children}</main>;
}
