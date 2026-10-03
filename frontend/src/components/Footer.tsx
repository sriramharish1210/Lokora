import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="bg-lokora-navy text-slate-400 border-t border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-4">
              {/* Logo PNG — inverted to white for dark footer */}
              <Image
                src="/lokora-logo.png"
                alt="Lokora"
                width={110}
                height={25}
                className="h-7 w-auto object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Connecting travelers with verified local guides, artisans, and culinary hosts across India.
            </p>
          </div>

          {/* Cities */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Top Cities</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'Ahmedabad', href: '/cities/ahmedabad' },
                { label: 'Mumbai', href: '/cities/mumbai' },
                { label: 'Jaipur', href: '/cities/jaipur' },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-white transition-colors duration-200">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Experiences */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Experiences</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: 'Food & Culinary Trails', href: '/explore?cat=FOOD' },
                { label: 'Artisan Workshops', href: '/explore?cat=WORKSHOPS' },
                { label: 'Heritage & Culture', href: '/explore?cat=CULTURE' },
                { label: 'Local Adventures', href: '/explore?cat=ADVENTURE' },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-white transition-colors duration-200">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Providers */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">For Providers</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/provider/portal" className="hover:text-white transition-colors duration-200">
                  Host Dashboard
                </Link>
              </li>
              <li>
                <Link href="/provider/portal" className="hover:text-white transition-colors duration-200">
                  KYC Verification
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="hover:text-white transition-colors duration-200">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <span>© 2026 Lokora. All rights reserved.</span>
          <span>Made with care for India&apos;s local discovery ecosystem.</span>
        </div>
      </div>
    </footer>
  );
}