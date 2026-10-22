import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import type { FlightController, FlightPhase } from './flight3d';
import './flight_experience.css';

const SKYLINE = '/media/flight/kuala-lumpur-skyline.png';
const labels: Record<FlightPhase, string> = {
  entry: 'Your journey to Malaysia has begun.',
  flyover: 'Revealing Kuala Lumpur in your wake.',
  exit: 'Arriving in Malaysia.',
};

export default function FlightExperience() {
  const reduced = useReducedMotion();
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
    viewport.current?.style.setProperty('--destination-edge', '100%');
    locked.current = false;
    setMessage(text); setState('arrived');
  }, []);

  const launch = () => {
    if (locked.current) return;
    locked.current = true; generation.current += 1;
    flight.current?.dispose(); flight.current = null;
    start.current = null; amount.current = 0;
    viewport.current?.style.setProperty('--destination-edge', reduced ? '100%' : '0%');
    setDragging(false); setProgress(0); setPhase('loading');
    setRun(value => value + 1);
    if (reduced) {
      finish('Malaysia unlocked. Motion reduced to match your preferences.');
    } else {
      setMessage('Preparing your flight…'); setState('flying');
    }
  };

  useEffect(() => {
    if (state === 'arrived') prize.current?.focus({ preventScroll: true });
    if (state === 'flying') skip.current?.focus({ preventScroll: true });
  }, [state, run]);

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
    const image = new Image(); image.src = SKYLINE;
    Promise.all([
      import('./flight3d'),
      image.decode().then(() => true, () => false),
    ]).then(([{ startFlight }, loaded]) => {
      if (!active() || !canvas.current) return;
      if (!loaded) {
        setImageFailed(true);
        finish('Malaysia unlocked. The destination photograph could not load; registration is still available.');
        return;
      }
      setImageFailed(false);
      controller = startFlight(canvas.current, next => {
        if (active()) { setPhase(next); setMessage(labels[next]); }
      }, () => { if (active()) finish(); });
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

  return <div className={`flight-experience cinematic-flight layout-two flight-${state}`}
    onKeyDown={event => {
      if (event.key === 'Escape' && state === 'flying') {
        event.preventDefault(); finish('Flight skipped. Explore the 2027 rewards.');
      }
    }}>
    <div className="destination-scene">
      {/* One stationary frame is shared by preparation, flight, and the settled destination. */}
      <div ref={viewport} className={`flight-viewport phase-${phase}`} role="region" aria-label="Flight to Kuala Lumpur">
        {state === 'ready' ? <div className="destination-copy">
          <span className="season-tag">2027 · NEXT LEVEL</span>
          <h3>Your ideas.<br />A world of possibilities.</h3>
          <div className="destination-awards"><strong>₹20,00,000 <small>Total prize pool</small></strong><span>₹10,00,000 Grand Winner award</span></div>
          <p>Malaysia trip for three grand-winning members.</p>
        </div> : <div className="flight-cinema-heading">
          <span className="season-tag">{state === 'arrived' ? 'MALAYSIA UNLOCKED' : phase === 'loading' ? 'PREPARING YOUR FLIGHT' : 'TAKEOFF CONFIRMED'}</span>
          <h3>India → Malaysia</h3>
        </div>}
        <figure className={`flight-city${imageFailed ? ' image-unavailable' : ''}`} aria-hidden={state !== 'arrived'}>
          <img src={SKYLINE} alt="Kuala Lumpur city skyline with the Petronas Twin Towers" width="768" height="432"
            onLoad={() => setImageFailed(false)} onError={() => setImageFailed(true)} />
          {imageFailed && <span className="flight-image-fallback">KUALA LUMPUR<br /><small>Destination photograph unavailable</small></span>}
          <figcaption>KUALA LUMPUR, MALAYSIA</figcaption>
        </figure>
        {/* A fresh canvas avoids reusing a deliberately lost WebGL context on replay. */}
        {state === 'flying' && <canvas key={run} aria-hidden="true" ref={canvas} />}
        {state === 'flying' && <button ref={skip} className="button button-secondary flight-stop" type="button"
          onClick={() => finish('Flight skipped. Explore the 2027 rewards.')}>Skip flight</button>}
      </div>
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
    {state === 'arrived' && <div ref={prize} tabIndex={-1} className="prize-unlocked" role="region" aria-label="Malaysia unlocked rewards">
      <span className="season-tag">MALAYSIA UNLOCKED</span><strong>₹20,00,000</strong><span>TOTAL PRIZE POOL — 2027</span>
      <p>₹10,00,000 GRAND WINNER</p><small>Malaysia trip for three grand-winning members.</small>
      <Link className="button button-primary" to="/#register">REGISTER FOR 2027 →</Link>
      <button className="text-link" type="button" onClick={launch}>Replay flight ↻</button>
    </div>}
  </div>;
}
