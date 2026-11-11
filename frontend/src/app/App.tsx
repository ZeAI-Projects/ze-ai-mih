import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PublishedContentBridge } from '@/features/cms/PublishedContentBridge';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import { PAGE_METADATA, NOT_FOUND_METADATA } from '@/constants/routes';
import { RegistrationModalContext } from '@/features/registration/RegistrationModalContext';
import { ThemeContext, type Theme } from '@/hooks/use_theme';

const TeamRegistrationDialog = lazy(() =>
  import('@/features/registration/components/TeamRegistrationDialog').then((module) => ({
    default: module.TeamRegistrationDialog,
  })),
);

function getThemePreference(): Theme | null {
  try {
    const saved = window.localStorage.getItem('miih.theme');
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch (error) {
    console.warn('Unable to read the saved theme preference.', error);
    return null;
  }
}

function getInitialTheme(): Theme {
  return getThemePreference() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function App() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [hasThemePreference, setHasThemePreference] = useState(() => getThemePreference() !== null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationMounted, setRegistrationMounted] = useState(false);
  const path = location.pathname.replace(/\/$/, '') || '/';
  const metadata = PAGE_METADATA[path] ?? NOT_FOUND_METADATA;
  const openRegistration = useCallback(() => {
    setRegistrationMounted(true);
    setRegistrationOpen(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    window.dispatchEvent(new Event('miih:theme-change'));
    if (hasThemePreference) {
      try {
        window.localStorage.setItem('miih.theme', theme);
      } catch (error) {
        console.warn('Unable to save the theme preference.', error);
      }
    }
  }, [theme, hasThemePreference]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (!hasThemePreference) setTheme(event.matches ? 'dark' : 'light');
    };
    preference.addEventListener('change', onPreferenceChange);
    return () => preference.removeEventListener('change', onPreferenceChange);
  }, [hasThemePreference]);

  useEffect(() => {
    document.title = metadata.title;
    document.body.className = `page-${metadata.key}`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', metadata.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', metadata.title);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute('content', metadata.description);

    if (previousPath.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      mainRef.current?.focus({ preventScroll: true });
      previousPath.current = location.pathname;
    }

    if (location.hash) {
      const navigateToAnchor = () => {
        if (document.querySelector('.section-pending')) return false;
        const anchor = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        anchor?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
        anchor?.focus({ preventScroll: true });
        return true;
      };
      if (!navigateToAnchor()) {
        const observer = new MutationObserver(() => { if (navigateToAnchor()) observer.disconnect(); });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
      }
    }
  }, [location.pathname, location.hash, location.key, metadata, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = 'shown';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px 80px 0px', threshold: 0.01 },
    );
    const sections = mainRef.current?.querySelectorAll<HTMLElement>(
      '.section, .gallery-panel, .gallery-spotlight, .gallery-next',
    );
    sections?.forEach((section) => {
      if (section.getBoundingClientRect().top < window.innerHeight) return;
      section.dataset.reveal = 'waiting';
      observer.observe(section);
    });
    return () => {
      observer.disconnect();
      sections?.forEach((section) => delete section.dataset.reveal);
    };
  }, [location.pathname, reducedMotion]);

  return (
    <ThemeContext.Provider value={theme}>
    <RegistrationModalContext.Provider value={openRegistration}>
      <PublishedContentBridge />
      <Header theme={theme} onThemeChange={() => {
        setHasThemePreference(true);
        setTheme((current) => current === 'dark' ? 'light' : 'dark');
      }} />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <MobileActionBar />
      {registrationMounted && (
        <Suspense fallback={null}>
          <TeamRegistrationDialog open={registrationOpen} onClose={() => setRegistrationOpen(false)} />
        </Suspense>
      )}
    </RegistrationModalContext.Provider>
    </ThemeContext.Provider>
  );
}
