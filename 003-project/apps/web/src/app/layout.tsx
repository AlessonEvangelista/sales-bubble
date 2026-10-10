import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SITE_DESCRIPTION, SITE_NAME } from '../lib/site';

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
