import type { Metadata } from 'next';
import ToolShell from '@/components/tool-shell';
import GstInvoiceTool from './tool';

export const metadata: Metadata = {
  title: 'Free GST Invoice Generator for Creators & Freelancers',
  description:
    'Make a clean, print-ready GST invoice in 30 seconds — CGST/SGST split calculated automatically, GSTIN optional. Free, no signup, no watermark.',
  keywords: ['GST invoice generator', 'freelance invoice India', 'creator invoice template', 'CGST SGST invoice', 'bill of supply'],
  alternates: { canonical: '/tools/gst-invoice-generator' },
  openGraph: {
    title: 'Free GST Invoice Generator for Creators & Freelancers',
    description: 'Make a clean, print-ready GST invoice in 30 seconds — CGST/SGST split calculated automatically, GSTIN optional. Free, no signup, no watermark.',
    url: '/tools/gst-invoice-generator',
    siteName: 'DealFlow',
    type: 'website',
    locale: 'en_IN',
    images: ['/og-gst-invoice.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free GST Invoice Generator for Creators & Freelancers',
    description: 'Make a clean, print-ready GST invoice in 30 seconds — CGST/SGST split calculated automatically, GSTIN optional. Free, no signup, no watermark.',
    images: ['/og-gst-invoice.png'],
  },
};

const faqs = [
  {
    q: 'Can I send an invoice without a GST number?',
    a: 'Yes. Below the ₹20 lakh annual threshold, GST registration is optional and you issue a bill of supply instead of a tax invoice — no GST line, no GSTIN. Brands still accept it; just leave the GSTIN fields blank here.',
  },
  {
    q: 'Which GST rate applies to creator services?',
    a: 'Most brand-deal services (content creation, promotion, marketing) fall under SAC 9983 and attract 18%. Some goods-adjacent supplies sit at 5% or 12% — when in doubt, 18% is the safe default for services and your CA can confirm.',
  },
  {
    q: 'CGST+SGST or IGST?',
    a: 'Same state as the client: CGST + SGST (half each). Different state: IGST at the full rate. This generator shows the intra-state split; for interstate just replace the two lines with one IGST line of the same total.',
  },
  {
    q: 'Does this store my invoices?',
    a: 'No — everything runs in your browser and disappears when you close the tab. If you want every invoice tracked, with due dates, ageing and automatic follow-ups, that is what the DealFlow app does.',
  },
];

export default function GstInvoicePage() {
  return (
    <ToolShell
      title="Free GST Invoice Generator"
      intro="A clean, print-ready invoice with the CGST/SGST split done for you. No account, no watermark, no “upgrade to remove logo” — because an invoice should never cost money to make."
      faqs={faqs}
    >
      <GstInvoiceTool />
    </ToolShell>
  );
}
