import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
export const metadata: Metadata = {
  metadataBase: new URL('https://dispute-court-genlayer.blazekingsley2.chatgpt.site'),
  title: 'Dispute Court — Agreement-first resolution',
  description: 'Agree first. Fund second. Resolve against a record both parties accepted on Studionet.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Dispute Court — Agreement-first resolution', description: 'Agree first. Fund second. Resolve against a record both parties accepted on Studionet.', type: 'website', url: '/',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'Dispute Court — Agreement-first resolution · Built for Studionet' }],
  },
  twitter: { card: 'summary_large_image', title: 'Dispute Court — Agreement-first resolution', description: 'Agree first. Fund second. Resolve against a record both parties accepted on Studionet.', images: ['/og.png'] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
