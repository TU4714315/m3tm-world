import type { Metadata } from 'next';
import DocsClient from './DocsClient';
import { ENDPOINT_COUNT } from './apiCatalog';

export const metadata: Metadata = {
  title: 'Documentation & API Reference',
  description: `Official M3TM.WORLD documentation — self-hosting guide, interface reference, and the API reference for ${ENDPOINT_COUNT} endpoints. Public map feeds remain directly accessible; OSINT and scanner routes require the authenticated M3TM.APP internal bridge.`,
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'M3TM.WORLD — Documentation & API Reference',
    description: `Self-hosting guide, interface reference, and the ${ENDPOINT_COUNT}-endpoint M3TM.WORLD API reference, with public feeds separated from authenticated internal tools.`,
    url: '/docs',
    type: 'article',
  },
};

export default function DocsPage() {
  return <DocsClient />;
}
