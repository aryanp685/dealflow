import type { Metadata, Viewport } from 'next';
import Providers from '@/components/providers';
import SwRegister from '@/components/sw-register';
import { faqs, offers } from '@/lib/content';
import './globals.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const title = 'DealFlow — stop losing money on brand deals';
const description =
  'Track every brand deal, deadline and invoice — then let DealFlow write the follow-up when a brand sits on your payment. GST and TDS split included.';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'DealFlow',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: site,
      description,
      offers: offers.map((o) => ({ '@type': 'Offer', ...o })),
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: title, template: '%s — DealFlow' },
  description,
  applicationName: 'DealFlow',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  alternates: { canonical: '/' },
  keywords: [
    'brand deal tracker',
    'creator invoice tracker',
    'freelancer payment tracking',
    'GST TDS calculator India',
    'overdue invoice reminder',
    'influencer brand deal management',
  ],
  openGraph: {
    title,
    description,
    url: site,
    siteName: 'DealFlow',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  other: {
    'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION || '',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0d10',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <SwRegister />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
