import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
/** Mount near the viewport once, retaining form/media state thereafter. */
export function DeferredSection({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  const [ready, setReady] = useState(() => window.location.hash === `#${id}`);
  useEffect(() => {
    if (ready) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '500px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready]);
  return <div id={id} ref={ref} tabIndex={-1} style={{ minHeight: 600 }}>
    {ready || hash ? <Suspense fallback={<p className="container section-pending" role="status">Loading {id}…</p>}>{children}</Suspense> : <span className="section-pending" />}
  </div>;
}
