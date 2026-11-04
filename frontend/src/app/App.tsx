import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PublishedContentBridge } from '@/features/cms/PublishedContentBridge';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import { PAGE_METADATA, NOT_FOUND_METADATA } from '@/constants/routes';

export function App() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const path = location.pathname.replace(/\/$/, '') || '/';
  const metadata = PAGE_METADATA[path] ?? NOT_FOUND_METADATA;

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
    <>
      <PublishedContentBridge />
      <Header />
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <MobileActionBar />
    </>
  );
}
