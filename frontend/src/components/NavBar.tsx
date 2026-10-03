'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navLinks = [
    { label: 'EXPLORE', href: '/explore' },
    { label: 'CITIES', href: '/cities/ahmedabad' },
    { label: 'PLAN A TRIP', href: '/trip' },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        {/* Single subtle gradient — just enough to keep logo/text readable over any image, zero background on scroll */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            {/* Logo — left */}
            <div className="flex-1 flex items-center">
              <Link href="/" className="opacity-90 hover:opacity-100 transition-opacity" onClick={() => setMobileOpen(false)}>
                <Image
                  src="/lokora-logo.png"
                  alt="Lokora"
                  width={108}
                  height={24}
                  className="h-7 w-auto object-contain"
                  priority
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </Link>
            </div>

            {/* Nav — center */}
            <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2 text-[11px] font-black tracking-[0.12em] text-white/80 hover:text-white transition-colors duration-150 hover:bg-white/10 rounded-lg"
                  style={{ fontFamily: "'Inter', 'system-ui', sans-serif", letterSpacing: '0.1em' }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Right CTAs */}
            <div className="flex-1 hidden md:flex items-center justify-end gap-2">
              <Link
                href="/provider/portal"
                className="text-[11px] font-black tracking-[0.1em] px-4 py-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-all duration-150"
                style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
              >
                FOR PROVIDERS
              </Link>
              <Link
                href="/auth/login"
                className="text-[11px] font-black tracking-[0.08em] px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all duration-200"
                style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
              >
                SIGN IN
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors ml-auto"
              aria-label="Toggle menu"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-[9px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
          <nav
            className="absolute top-0 right-0 h-full w-72 bg-slate-950/95 border-l border-white/10 flex flex-col pt-20 pb-8 px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-5 left-6">
              <Image src="/lokora-logo.png" alt="Lokora" width={90} height={20} className="h-6 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <div className="flex-1 space-y-1 mt-2">
              {[...navLinks, { label: 'FOR PROVIDERS', href: '/provider/portal' }].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-xs font-black tracking-widest text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                  style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link
              href="/auth/login"
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center text-xs font-black tracking-widest px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-colors"
              style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
            >
              SIGN IN
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}