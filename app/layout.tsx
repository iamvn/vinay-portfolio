import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/seo';
import './globals.css';
import { SiteAnalytics } from '@/components/site-analytics';

// Site-wide defaults. Pages refine these with their own titles, descriptions and canonical URLs.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Vinay Bharti | Senior Software Engineer',
  description: 'Senior Software Engineer specializing in React, Next.js, TypeScript and AI engineering. Explore Vinay Bharti\'s experience, projects and engineering work.',
  applicationName: 'Vinay Bharti Portfolio',
  authors: [{ name: 'Vinay Bharti', url: SITE_URL }],
  creator: 'Vinay Bharti',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: { type: 'website', siteName: 'Vinay Bharti', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
  // Google Search Console ("URL prefix" property → HTML tag method): only the content="…" value.
  ...(process.env.GOOGLE_SITE_VERIFICATION?.trim()
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION.trim() } }
    : {}),
};

// viewportFit "cover" lets the pages use env(safe-area-inset-*) around the iPhone notch and home bar.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#030609',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-game-mode="on" suppressHydrationWarning>
      <head>
        {/* Apply a saved "game mode off" before first paint (portfolio pages only, not the admin panel). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(!/^\\/(admin|login)(\\/|$)/.test(location.pathname)&&localStorage.getItem('portfolio-game-mode')==='off'){document.documentElement.dataset.gameMode='off'}}catch(e){}`,
          }}
        />
      </head>
      <body className="scanlines">
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
