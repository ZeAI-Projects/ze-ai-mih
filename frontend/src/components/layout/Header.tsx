import { Link, useLocation } from 'react-router-dom';
import { HeaderBrand } from '@/components/common/HeaderBrand';
import { Icon } from '@/components/ui/Icon';
import { SITE } from '@/constants/app';
import { useMobileNavigation } from '@/hooks/use_mobile_navigation';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/use_reduced_motion';

const navigationItems = [
  { label: 'About Us', to: '/#about' },
  { label: 'Gallery', to: '/#gallery' },
  { label: 'Register', to: '/#register' },
];

export function Header({ theme, onThemeChange }: { theme: 'light' | 'dark'; onThemeChange: () => void }) {
  const { hash, pathname, key } = useLocation();
  const reducedMotion = useReducedMotion();
  const homeScroll = useRef<'smooth' | 'instant' | null>(null);
  const stickyRef = useRef<HTMLElement>(null);
  const { isOpen, headerRef, toggleRef, closeMenu, toggleMenu } = useMobileNavigation();

  useEffect(() => {
    const header = stickyRef.current;
    if (!header) return;
    const measure = () => document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--header-height'); };
  }, []);

  useEffect(() => {
    if (!homeScroll.current) return;
    const behavior = homeScroll.current;
    homeScroll.current = null;
    // Wait for Router to clear the old section hash before scrolling.
    // The new location key also triggers the existing hero-year replay.
    if (pathname === '/' && !hash) {
      window.scrollTo({ top: 0, left: 0, behavior: reducedMotion ? 'instant' : behavior });
    }
  }, [key, pathname, hash, reducedMotion]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header" ref={stickyRef}>
        <span className="journey-progress" aria-hidden="true" />
        <div className="container header-inner" ref={headerRef}>
          <Link
            to="/"
            className="brand"
            aria-label={`${SITE.NAME} home`}
            onClick={event => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              homeScroll.current = pathname === '/' && !reducedMotion ? 'smooth' : 'instant';
              closeMenu();
            }}
          >
            <HeaderBrand />
          </Link>
          <div className="header-controls">
            <button
              type="button"
              ref={toggleRef}
              className="menu-toggle"
              aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isOpen}
              aria-controls="primary-nav"
              onClick={toggleMenu}
            >
              <Icon name="menu" />
              <Icon name="close" />
            </button>
            <nav
              id="primary-nav"
              className={`primary-nav${isOpen ? ' is-open' : ''}`}
              aria-label="Main navigation"
            >
              {navigationItems.map((item) => (
                <Link key={item.to} to={item.to} aria-current={item.to.endsWith(hash) && hash ? 'location' : undefined} onClick={closeMenu}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <button type="button" className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'} onClick={onThemeChange}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                {theme === 'dark' ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
                  </>
                ) : (
                  <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
