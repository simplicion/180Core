'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Code2,
  Menu,
  X,
  Shield,
  CreditCard,
  ChevronDown,
  LogOut,
  ArrowRight,
  Terminal,
  User,
  ExternalLink,
} from 'lucide-react';
import { AILogoIcon, Button } from '@workspace/ui';
import { use180Identity } from '@workspace/identity-sdk';
import toast from 'react-hot-toast';
import ThemeToggle from './ThemeToggle';
import { getDocsUrl, DOCS_LINKS } from '@/lib/docs-url';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<{ id?: string; name?: string; email?: string; username?: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const { launch180Identity, isOpeningIdentity } = use180Identity();

  const getProfileUrl = () => {
    if (typeof window === 'undefined') return 'http://localhost:3009';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3009' : 'https://profile.180workspace.com';
  };

  const checkAuth = () => {
    if (typeof window === 'undefined') return;
    const token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');

    if (token) {
      setIsAuthenticated(true);
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUserProfile(JSON.parse(storedUser));
        } else {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            setUserProfile({
              id: payload.sub || payload.id,
              name: payload.name || payload.email || 'Developer',
              email: payload.email,
              username: payload.username,
            });
          }
        }
      } catch (_) {
        setUserProfile({ name: 'Developer' });
      }
    } else {
      setIsAuthenticated(false);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleAuthChange = () => checkAuth();
    window.addEventListener('storage', handleAuthChange);
    const handleMessage = (e: MessageEvent) => {
      if (e.data && (e.data.type === '180_IDENTITY_SUCCESS' || e.data.type === '180_AUTH_SUCCESS')) {
        if (e.data.token) {
          localStorage.setItem('platform_auth_token', e.data.token);
          document.cookie = `platform_auth_token=${e.data.token}; path=/; max-age=604800; SameSite=Lax`;
        }
        if (e.data.user) {
          localStorage.setItem('user', JSON.stringify(e.data.user));
          setUserProfile(e.data.user);
          setIsAuthenticated(true);
        }
        setTimeout(checkAuth, 100);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setProductsDropdownOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProductsDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('platform_auth_token');
    localStorage.removeItem('platform_refresh_token');
    localStorage.removeItem('user');
    document.cookie = 'platform_auth_token=; path=/; max-age=0;';
    setIsAuthenticated(false);
    setUserProfile(null);
    setUserDropdownOpen(false);
    toast.success('Signed out successfully');
    window.dispatchEvent(new Event('180_SIGNOUT'));
    router.push('/');
  };

  const isProductsActive =
    pathname.startsWith('/products') ||
    pathname === '/identity' ||
    pathname === '/pay';

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-white/10 bg-white/90 dark:bg-black/85 backdrop-blur-xl transition-colors duration-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Clean Brand Logo */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="flex items-center gap-3 group min-h-[44px] shrink-0">
            <div className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center p-1.5 shadow-xs group-hover:scale-105 transition-all duration-300 shrink-0">
              <img
                src="/black-icon.svg"
                alt="180 Developers"
                className="w-5 h-5 min-w-[20px] min-h-[20px] object-contain dark:invert group-hover:scale-110 transition-transform duration-300 shrink-0"
              />
            </div>
            <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white flex items-center">
              180 Developers
            </span>
          </Link>
        </div>

        {/* Center: Clean, Modern Tech Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
          {/* 1. Products Hover / Click Dropdown */}
          <div
            className="relative"
            ref={dropdownRef}
            onMouseEnter={() => setProductsDropdownOpen(true)}
            onMouseLeave={() => setProductsDropdownOpen(false)}
          >
            <button
              type="button"
              onClick={() => setProductsDropdownOpen(!productsDropdownOpen)}
              className={`flex items-center gap-1.5 py-2 transition-colors cursor-pointer ${
                isProductsActive || productsDropdownOpen
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <span>Products</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  productsDropdownOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'opacity-60'
                }`}
              />
            </button>

            {/* Products Floating Dropdown */}
            {productsDropdownOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-80 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl p-2.5 space-y-1.5 backdrop-blur-xl">
                  <Link
                    href="/products/identity"
                    onClick={() => setProductsDropdownOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Shield className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-zinc-950 dark:text-white flex items-center gap-1.5">
                        <span>180 Identity</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
                          Auth & SSO
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                        Universal Single Sign-On, 1-tap WhatsApp OTP, and RS256 JWKS tokens.
                      </p>
                    </div>
                  </Link>

                  <Link
                    href="/products/pay"
                    onClick={() => setProductsDropdownOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-zinc-950 dark:text-white flex items-center gap-1.5">
                        <span>180 Pay</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30">
                          1-Click Pay
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                        Instant popup checkouts, 180 wallet balances, and 2-way signed webhooks.
                      </p>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 2. Docs Link */}
          <a
            href={getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Docs</span>
            <ExternalLink className="w-3 h-3 text-zinc-400 opacity-70" />
          </a>
        </nav>

        {/* Right: Theme Toggle & Single Action Button */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Action Button: Profile avatar if logged in, Authenticate if not */}
          {isAuthenticated ? (
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-all cursor-pointer min-h-[38px] shadow-2xs"
                title="Account Menu & Dashboard"
                aria-label="User Profile Menu"
              >
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {(userProfile?.name || userProfile?.email || 'D')[0].toUpperCase()}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 shadow-2xl p-2 space-y-1 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-white/10">
                    <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      {userProfile?.name || 'Developer'}
                    </p>
                    {userProfile?.email && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {userProfile.email}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                      Signed in via 180 Identity
                    </p>
                  </div>

                  <a
                    href={getProfileUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>View 180 Profile</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>

                  <Link
                    href="/dashboard"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Applications Dashboard</span>
                  </Link>

                  <a
                    href={getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Code2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span>Documentation</span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={() => launch180Identity(() => checkAuth())}
              disabled={isOpeningIdentity}
              size="sm"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer min-h-[38px]"
            >
              <span>{isOpeningIdentity ? 'Connecting...' : 'Sign In with 180 ID'}</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-80" />
            </Button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all duration-200 cursor-pointer shadow-xs"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-black/95 px-4 pt-3 pb-6 space-y-3 backdrop-blur-2xl shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-4">
              Products
            </span>
            <Link
              href="/products/identity"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>180 Identity (Auth & SSO)</span>
              </div>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">OIDC 1.0</span>
            </Link>

            <Link
              href="/products/pay"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5"
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>180 Pay (Payments)</span>
              </div>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">1-Click</span>
            </Link>
          </div>

          <a
            href={getDocsUrl(DOCS_LINKS.CORE_OVERVIEW)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 min-h-[44px]"
          >
            <div className="flex items-center gap-3">
              <Code2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Docs</span>
            </div>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>

          {/* Auth Action on Mobile */}
          <div className="pt-3 border-t border-zinc-200 dark:border-white/10">
            {isAuthenticated ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                    {(userProfile?.name || userProfile?.email || 'D')[0].toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      {userProfile?.name || 'Developer'}
                    </p>
                    {userProfile?.email && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {userProfile.email}
                      </p>
                    )}
                  </div>
                </div>

                <a
                  href={getProfileUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>View 180 Profile</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>

                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  <Terminal className="w-4 h-4" />
                  <span>Applications Dashboard</span>
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/30 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  launch180Identity(() => checkAuth());
                }}
                disabled={isOpeningIdentity}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isOpeningIdentity ? 'Connecting...' : 'Sign In with 180 ID'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
