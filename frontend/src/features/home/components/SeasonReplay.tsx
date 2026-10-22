import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
const Flight = lazy(() => import('./FlightExperience'));

export function SeasonReplay() {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => { const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); observer.disconnect(); } }, { rootMargin: '250px' }); if (ref.current) observer.observe(ref.current); return () => observer.disconnect(); }, []);
  return <section ref={ref} id="replay" tabIndex={-1} className="section season-section" aria-labelledby="season-title">
    <div className="container"><p className="eyebrow">ONE JOURNEY. A NEW LEVEL.</p><h2 className="section-heading" id="season-title">2026 replay. 2027 unlocked.</h2>
      <div className="season-grid"><article className="season-card season-past">
        <span className="season-tag">2026 · LEVEL COMPLETE</span><h3>Big ideas took flight.</h3><strong className="season-prize">₹10,00,000</strong><p>2026 prize pool · Season completed</p>
        <div className="boarding-pass"><div className="ticket-main"><span>MADE IN INDIA / BOARDING PASS</span><h4>SUPER AURA</h4><p>Grand Winner · 3 winning members</p><div className="ticket-route"><b>INDIA</b><span>→</span><b>KUALA LUMPUR</b></div><p>Malaysia trip earned · 3 people</p><strong className="ticket-stamp">EXPIRED<br />JOURNEY COMPLETED</strong><small>Decorative event souvenir. Not a valid travel ticket.</small></div><div className="ticket-stub"><b>2026</b><span>LEVEL COMPLETE</span><strong>03</strong><small>WINNING MEMBERS</small><span>SUPER AURA</span></div></div>
      </article><article className="season-card season-next">
        <div className="flight-slot">{near && <Suspense fallback={<p>Preparing your flight…</p>}><Flight /></Suspense>}</div>
        <Link to="/#register" className="button button-primary">Unlock your next level →</Link>
      </article></div>
    </div>
  </section>;
}
