import type { MetadataRoute } from 'next';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const TOOLS = [
  '/tools/msme-demand-letter',
  '/tools/tds-calculator',
  '/tools/gst-invoice-generator',
  '/tools/brand-deal-rate-calculator',
  '/tools/collab-agreement-generator',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...TOOLS.map((path) => ({
      url: `${site}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${site}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${site}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${site}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
