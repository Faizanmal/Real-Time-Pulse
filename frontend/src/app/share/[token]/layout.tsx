import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shared portal',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SharedPortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
