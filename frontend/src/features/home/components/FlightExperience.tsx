import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import type { FlightController, FlightPhase } from './flight3d';
import './flight_experience.css';

import { useFlightEnvironment } from './flightEnvironment';
const labels: Record<FlightPhase, string> = {
  entry: 'Your journey to Malaysia has begun.',
  turn: 'Banking left and climbing toward Kuala Lumpur.',
  flyover: 'Flying above Kuala Lumpur.',
  exit: 'Arriving in Malaysia.',
};

export default function FlightExperience() {
  const reduced = useReducedMotion();
  const { environment, prepare } = useFlightEnvironment();
  const [state, setState] = useState<'ready' | 'flying' | 'arrived'>('ready');
  const [phase, setPhase] = useState<FlightPhase | 'loading'>('loading');
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [run, setRun] = useState(0);
  const [message, setMessage] = useState('Your next destination: Kuala Lumpur.');
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const prize = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const start = useRef<{ x: number; id: number } | null>(null);
  const amount = useRef(0);
  const locked = useRef(false);
  const flight = useRef<FlightController | null>(null);
  // Invalidates pending imports/decodes immediately on skip, replay, or unmount.
  const generation = useRef(0);

  const finish = useCallback((text = 'Journey complete. Malaysia unlocked!') => {
    generation.current += 1;
    flight.current?.dispose(); flight.current = null;
    locked.current = false;
    setMessage(text); setState('arrived');
  }, []);

  const launch = async () => {
    if (locked.current) return;
    locked.current = true; const token = ++generation.current;
    flight.current?.dispose(); flight.current = null;
    start.current = null; amount.current = 0;
    setDragging(false); setProgress(0); setPhase('loading');
    setRun(value => value + 1);
    setMessage('Preparing your Kuala Lumpur skyline?');
    try { await prepare(); } catch {
      if (token === generation.current) finish('Malaysia unlocked. Destination graphics are unavailable.');
      return;
    }
    if (token !== generation.current) return;
    if (reduced) {
      finish('Malaysia unlocked. Motion reduced to match your preferences.');
    } else {
      setMessage('Preparing your flight…'); setState('flying');
    }
  };

  useEffect(() => {
    if (state === 'arrived') {
      prize.current?.focus({ preventScroll: true });
      prize.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' });
    }
    if (state === 'flying') skip.current?.focus({ preventScroll: true });
  }, [state, run, reduced]);

  useEffect(() => {
    if (state !== 'flying') return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish('Flight skipped. Explore the 2027 rewards.'); }
      if (event.key === 'Tab') {
        const controls = Array.from(viewport.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? []);
        if (!controls.length) return;
        event.preventDefault();
        const index = controls.indexOf(document.activeElement as HTMLElement);
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
    };
  }, [state, finish]);

  useEffect(() => {
    if (state !== 'flying') return;
    if (reduced) {
      finish('Malaysia unlocked. Motion reduced to match your preferences.');
      return;
    }
    const token = ++generation.current;
    let cancelled = false;
    let controller: FlightController | null = null;
    const active = () => !cancelled && token === generation.current;
    const visibility = () => {
      if (document.hidden && active()) finish('Flight skipped while away. Malaysia unlocked!');
    };
    document.addEventListener('visibilitychange', visibility);
    import('./flight3d').then(({ startFlight }) => {
      if (!active() || !canvas.current) return;
      controller = startFlight(canvas.current, next => {
        if (active()) { setPhase(next); setMessage(labels[next]); }
      }, () => { if (active()) finish(); }, viewport.current?.closest('[data-theme]')?.getAttribute('data-theme') === 'dark');
      flight.current = controller;
      if (!controller) finish('Malaysia unlocked. Showing the still destination because 3D is unavailable.');
    }).catch(() => {
      if (active()) finish('Malaysia unlocked. Flight graphics are unavailable; your destination and rewards are ready.');
    });
    return () => {
      cancelled = true; generation.current += 1; controller?.dispose();
      if (flight.current === controller) flight.current = null;
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [state, reduced, run, finish]);

  useEffect(() => { flight.current?.setTheme(environment.theme === 'dark'); }, [environment.theme]);
  useEffect(() => () => { ++generation.current; }, []);

  const reward = <div ref={prize} tabIndex={-1} className="prize-unlocked" role="region" aria-label="Malaysia unlocked rewards">
      {!reduced && <div className="prize-burst" aria-hidden="true"><span className="prize-ring" />{Array.from({length:12},(_,i)=><i key={i} style={{'--burst-angle': `${i*30}deg`} as CSSProperties} />)}</div>}
      <span className="season-tag">MALAYSIA UNLOCKED</span><strong>₹20,00,000</strong><span>TOTAL PRIZE POOL — 2027</span>
      <p>₹10,00,000 GRAND WINNER</p><small>Malaysia trip for three grand-winning members.</small>
      <Link className="button button-primary" to="/#register">REGISTER FOR 2027 →</Link>
      <button className="text-link" type="button" onClick={launch}>Replay flight ↻</button>
    </div>;

  const flightScene = <div ref={viewport} className={`flight-viewport phase-${phase}`} role={state === 'flying' ? 'dialog' : 'region'} aria-modal={state === 'flying' ? true : undefined} aria-label="Flight to Kuala Lumpur">
        {state === 'ready' ? <div className="destination-copy">
          <span className="season-tag">2027 · NEXT LEVEL</span>
          <h3>Your ideas.<br />A world of possibilities.</h3>
          <div className="destination-awards"><strong>₹20,00,000 <small>Total prize pool</small></strong><span>₹10,00,000 Grand Winner award</span></div>
          <p>Malaysia trip for three grand-winning members.</p>
        </div> : <div className="flight-cinema-heading">
          <span className="season-tag">{state === 'arrived' ? 'MALAYSIA UNLOCKED' : phase === 'loading' ? 'PREPARING YOUR FLIGHT' : 'TAKEOFF CONFIRMED'}</span>
          <h3>India → Malaysia</h3>
        </div>}
        <figure className={`flight-city${imageFailed ? ' image-unavailable' : ''}`} aria-hidden={state !== 'arrived'} style={{ '--skyline-image': `url("${environment.src}")` } as CSSProperties}>
          <img src={environment.src} alt="Kuala Lumpur city skyline with the Petronas Twin Towers" width="768" height="432"
            onLoad={() => setImageFailed(false)} onError={() => setImageFailed(true)} />
          {imageFailed && <span className="flight-image-fallback">KUALA LUMPUR<br /><small>Destination photograph unavailable</small></span>}
          <figcaption>KUALA LUMPUR, MALAYSIA</figcaption>
        </figure>
        {/* A fresh canvas avoids reusing a deliberately lost WebGL context on replay. */}
        {state === 'flying' && <canvas key={run} aria-hidden="true" ref={canvas} />}
        {state === 'flying' && <button ref={skip} className="button button-secondary flight-stop" type="button"
          onClick={() => finish('Flight skipped. Explore the 2027 rewards.')}>Skip flight</button>}
      </div>;

  return <div data-theme={environment.theme} className={`flight-experience cinematic-flight layout-two flight-${state}`}
    onKeyDown={event => {
      if (event.key === 'Escape' && state === 'flying') {
        event.preventDefault(); finish('Flight skipped. Explore the 2027 rewards.');
      }
    }}>
    <div className="destination-scene">
      {/* One stationary frame is shared by preparation, flight, and the settled destination. */}
      {state === 'flying'
        ? createPortal(<div data-theme={environment.theme} className={`cinematic-flight layout-two flight-${state} flight-overlay`}>{flightScene}</div>, document.body)
        : flightScene}
    </div>
    <div className="flight-controls">
      {state === 'ready' && <>
        <div className="launch-route-labels"><span>INDIA</span><span>MALAYSIA</span></div>
        <div className={`flight-swipe${dragging ? ' is-dragging' : ''}`} role="group" aria-label="Swipe right to fly to Malaysia"
          style={{ '--launch-progress': progress / 100 } as CSSProperties}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0 || locked.current) return;
            start.current = { x: event.clientX, id: event.pointerId }; amount.current = 0;
            setDragging(true); event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            if (!start.current || start.current.id !== event.pointerId) return;
            amount.current = Math.max(0, Math.min(100, (event.clientX - start.current.x) / Math.max(1, event.currentTarget.clientWidth - 64) * 100));
            setProgress(amount.current);
            if (amount.current >= 80) launch();
          }}
          onPointerUp={event => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            start.current = null; amount.current = 0; setDragging(false); if (!locked.current) setProgress(0);
          }}
          onPointerCancel={() => { start.current = null; amount.current = 0; setDragging(false); if (!locked.current) setProgress(0); }}>
          <span className="swipe-fill" /><span className="launch-track-copy">SWIPE TO TAKE OFF →</span>
          <span className="launch-handle" aria-hidden="true">✈</span>
          <span className="launch-markers" aria-hidden="true">{[20, 40, 60, 80].map(value => <i key={value} className={progress >= value ? 'active' : ''} />)}</span>
          <progress max="100" value={progress} aria-label="Flight launch progress" />
        </div>
        <div className="launch-actions"><span>{Math.round(progress)}% · {dragging ? 'Keep swiping' : 'Your next level is waiting'}</span>
          <button type="button" className="button button-primary" onClick={launch}>Launch flight ↗</button></div>
      </>}
      <p role="status" aria-live="polite" aria-atomic="true" className="flight-status">{message}</p>
    </div>
    {state === 'arrived' && reward}

  </div>;
}
