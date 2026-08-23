import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vinay Bharti — Software Engineer',
  description: 'Software Engineer portfolio focused on building scalable, high-performance web applications.',
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="scanlines">{children}</body>
    </html>
  );
}
