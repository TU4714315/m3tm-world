import type { Metadata } from 'next';
import DocsClient from './DocsClient';
import { ENDPOINT_COUNT } from './apiCatalog';

export const metadata: Metadata = {
  title: 'Documentation & API Reference',
  description: `Official M3TM.WORLD documentation — self-hosting guide, interface reference, and the complete API reference for all ${ENDPOINT_COUNT} endpoints covering aviation, maritime, seismic, conflict, cyber, and public data feeds. No API key required.`,
  alternates: { canonical: '/docs' },
  openGraph: {
    title: 'M3TM.WORLD — Documentation & API Reference',
    description: `Self-hosting guide, interface reference, and the complete API reference for all ${ENDPOINT_COUNT} M3TM.WORLD endpoints.`,
    url: '/docs',
    type: 'article',
  },
};

export default function DocsPage() {
  return <DocsClient />;
}
