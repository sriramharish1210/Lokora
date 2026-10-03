import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  metadataBase: new URL('https://lokora.in'),
  title: {
    default: 'Lokora — Discover India Like a Local',
    template: '%s | Lokora',
  },
  description: 'Connect with verified local guides, culinary hosts, and artisans across India. Authentic discovery, not generic tourism.',
  keywords: ['India Travel', 'Local Experiences', 'Authentic Food Tours', 'Artisan Workshops', 'Culture Walk', 'Ahmedabad', 'Mumbai', 'Jaipur'],
  authors: [{ name: 'Lokora' }],
  openGraph: {
    title: 'Lokora — Discover India Like a Local',
    description: 'Connect with verified local guides, culinary hosts, and artisans across India.',
    url: 'https://lokora.in',
    siteName: 'Lokora',
    locale: 'en_IN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; img-src 'self' data: https: https://images.unsplash.com; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:4000;"
        />
        {/* Premium fonts loaded via <link> so they work at runtime even if not at build time */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavBar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
