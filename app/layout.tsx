import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vinay Bharti — Software Engineer',
  description: 'Software Engineer portfolio focused on building scalable, high-performance web applications.',
  robots: { index: true, follow: true }
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
      <body className="scanlines">{children}</body>
    </html>
  );
}
