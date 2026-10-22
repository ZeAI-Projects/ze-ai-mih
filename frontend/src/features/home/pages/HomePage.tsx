import { Link } from 'react-router-dom';
import { HeroVisual } from '../components/HeroVisual';
import { useLocation } from 'react-router-dom';
import { lazy, useEffect, useRef, useState } from 'react';
import brandLogo from '@/assets/images/header-brand.webp';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import { DeferredSection } from '@/components/common/DeferredSection';
import { SeasonReplay } from '../components/SeasonReplay';
import { Challenges } from '../components/Challenges';
import { ZeaiMark } from '@/components/common/HeaderBrand';
import { SeasonRewards } from '../components/SeasonRewards';
import '@/features/about/styles/about.css';
import '../styles/home.css';
import '../styles/season.css';
import '../styles/game.css';
const GalleryPage = lazy(() => import('@/features/gallery/pages/GalleryPage').then(m => ({ default: m.GalleryPage })));
const AboutPage = lazy(() => import('@/features/about/pages/AboutPage').then(m => ({ default: m.AboutPage })));
const RegisterPage = lazy(() => import('@/features/registration/pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
export function HomePage() {
  const brandRow = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [yearEntry, setYearEntry] = useState({ locationKey: location.key, run: 0, started: false });
  // Track every navigation so Back and repeated Home-logo clicks replay,
  // while section links and ordinary renders preserve the current animation.
  if (yearEntry.locationKey !== location.key) {
    const enteringHome = location.pathname === '/' && (!location.hash || location.hash === '#home');
    setYearEntry({ locationKey: location.key, run: yearEntry.run + (enteringHome ? 1 : 0), started: enteringHome ? false : yearEntry.started });
  }
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (yearEntry.started) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setYearEntry(entry => ({ ...entry, started: true }));
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    if (brandRow.current) observer.observe(brandRow.current);
    return () => observer.disconnect();
  }, [yearEntry.started, yearEntry.run]);
  return <>
    <section id="home" tabIndex={-1} className="hero">
      <div className="container hero-grid"><div className="hero-copy">
        <div ref={brandRow} className="season-eyebrow hero-brand-row">
          <ZeaiMark />
          <span className="india-crop"><img src={brandLogo} alt="#MadeInIndia" width="2170" height="725" /></span>
          <span key={yearEntry.run} role="img" aria-label="2027" className={`hero-year${yearEntry.started ? ' hero-year--started' : ''}${reducedMotion ? ' hero-year--reduced' : ''}`}>
            <span className="hero-year-digits" aria-hidden="true">
              <span>2</span><span>0</span><span>2</span>
              <span className="hero-year-slot"><span className="hero-year-six">6</span><span className="hero-year-seven">7</span><span className="hero-year-impact">✦</span></span>
            </span>
          </span>
        </div>
        <h1 className="hero-title">Your ideas.<br /><span>India’s next chapter.</span></h1>
        <p className="hero-description">Big problems. Bold builders. Bring your team, find your challenge, and build what comes next.</p>
        <div className="button-row"><Link className="button button-primary" to="/#register">Unlock your 2027 journey →</Link><Link className="text-link" to="/#replay">Replay the journey ↓</Link></div>
        <p className="hero-meta"><span className="status-dot" aria-hidden="true" />2027 · The next level starts with you.</p>
      </div><HeroVisual /></div>
    </section>
    <SeasonReplay /><Challenges /><SeasonRewards />
    <DeferredSection id="about"><AboutPage embedded /></DeferredSection>
    <DeferredSection id="gallery"><GalleryPage /></DeferredSection>
    <DeferredSection id="register"><RegisterPage embedded /></DeferredSection>
  </>;
}
