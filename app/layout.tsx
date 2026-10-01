import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/seo';
import { prisma } from '@/lib/prisma';
import { currentSiteUrl } from '@/lib/sites/url';
import './globals.css';
import { SiteAnalytics } from '@/components/site-analytics';
import { NavProgress } from '@/components/nav-progress';

// Site-wide defaults, per site (each site has its own address and owner). Pages refine these.
export async function generateMetadata(): Promise<Metadata> {
  const [base, profile] = await Promise.all([
    currentSiteUrl().catch(() => SITE_URL),
    prisma.profile.findUnique({ where: { id: 1 }, select: { name: true, role: true } }).catch(() => null),
  ]);
  const name = profile?.name || 'Portfolio';
  const title = profile?.role ? `${name} | ${profile.role}` : name;
  return {
    metadataBase: new URL(base),
    title,
    description: `${title}. Experience, projects and engineering work.`,
    applicationName: `${name} Portfolio`,
    authors: [{ name, url: base }],
    creator: name,
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
    openGraph: { type: 'website', siteName: name, locale: 'en_US' },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
    // Google Search Console ("URL prefix" property → HTML tag method): only the content="…" value. Main site only.
    ...(process.env.GOOGLE_SITE_VERIFICATION?.trim() && base === SITE_URL
      ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION.trim() } }
      : {}),
  };
}

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
        <NavProgress />
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
