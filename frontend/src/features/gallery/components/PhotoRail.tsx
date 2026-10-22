import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import type { HackathonPhoto } from '../data/media';
import './photo_rail.css';

interface PhotoRailProps {
  photos: HackathonPhoto[];
  category: 'photos' | 'afterparty';
  onSelect: (index: number) => void;
  suspended: boolean;
  autoPlay?: boolean;
}

export function PhotoRail({
  photos,
  category,
  onSelect,
  suspended,
  autoPlay = false,
}: PhotoRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [autoPreference, setAutoPreference] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [inView, setInView] = useState(true);
  const autoRequested = autoPlay && (autoPreference ?? !reducedMotion);
  const running = autoRequested && !hovered && !focused && !suspended && pageVisible && inView;

  useEffect(() => {
    function handleVisibility() {
      setPageVisible(!document.hidden);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: '80px',
    });
    observer.observe(rail);
    return () => observer.disconnect();
  }, []);

  const move = useCallback(
    (direction: number, manual = true) => {
      const rail = railRef.current;
      const card = rail?.querySelector<HTMLElement>('.photo-rail-card');
      if (!rail || !card) return;
      if (manual) setAutoPreference(false);
      const max = rail.scrollWidth - rail.clientWidth;
      const origin = card.getBoundingClientRect().left;
      const stops = Array.from(rail.querySelectorAll<HTMLElement>('.photo-rail-card')).map((item) =>
        Math.min(max, item.getBoundingClientRect().left - origin),
      );
      const position = rail.scrollLeft;
      const next =
        direction > 0
          ? position >= max - 2
            ? 0
            : (stops.find((stop) => stop > position + 2) ?? max)
          : position <= 2
            ? max
            : (stops.reverse().find((stop) => stop < position - 2) ?? 0);
      rail.scrollTo({
        left: Math.max(0, Math.min(max, next)),
        behavior: reducedMotion ? 'instant' : 'smooth',
      });
    },
    [reducedMotion],
  );

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => move(1, false), 4000);
    return () => window.clearInterval(timer);
  }, [running, move]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  }

  return (
    <div className={`photo-rail-collection photo-rail-collection--${category}`}>
      <div className="photo-rail-controls">
        <p>
          <span className="rail-count">{photos.length.toString().padStart(2, '0')}</span> frames.
          Plenty of good energy.
        </p>
        <div className="photo-rail-actions">
          {autoPlay && (
            <button
              className="rail-autoplay"
              type="button"
              aria-label={autoRequested ? 'Pause photo slideshow' : 'Resume photo slideshow'}
              onClick={() => setAutoPreference(!autoRequested)}
            >
              <span aria-hidden="true">{autoRequested ? 'Ⅱ' : '▶'}</span>
              {autoRequested ? 'Pause slideshow' : 'Play slideshow'}
            </button>
          )}
          <button
            type="button"
            className="rail-arrow rail-arrow--previous"
            aria-label={`Previous ${category === 'afterparty' ? 'afterparty photos' : 'photos'}`}
            onClick={() => move(-1)}
          >
            <Icon name="arrow" />
          </button>
          <button
            type="button"
            className="rail-arrow"
            aria-label={`Next ${category === 'afterparty' ? 'afterparty photos' : 'photos'}`}
            onClick={() => move(1)}
          >
            <Icon name="arrow" />
          </button>
        </div>
      </div>
      <div
        className="photo-rail"
        ref={railRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={
          category === 'photos' ? 'Hackathon photo carousel' : 'Afterparty photo carousel'
        }
        tabIndex={0}
        data-auto-scrolling={running}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
        onPointerDown={() => setAutoPreference(false)}
        onWheel={() => setAutoPreference(false)}
        onKeyDown={handleKeyDown}
      >
        {photos.map((photo, index) => (
          <figure className="photo-rail-card" key={photo.id}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Enlarge ${category === 'afterparty' ? 'afterparty photo' : 'photo'}: ${photo.title}`}
            >
              <span className="photo-rail-image">
                <img
                  src={photo.src}
                  width={photo.width}
                  height={photo.height}
                  alt={photo.alt}
                  loading="lazy"
                  decoding="async"
                />
                <span className="rail-photo-number">
                  {(index + 1).toString().padStart(2, '0')} /{' '}
                  {photos.length.toString().padStart(2, '0')}
                </span>
                <span className="rail-photo-expand" aria-hidden="true">
                  <Icon name="external" />
                </span>
                <span className="photo-rail-caption">
                  <strong>{photo.title}</strong>
                  <span>{photo.caption}</span>
                </span>
              </span>
            </button>
          </figure>
        ))}
      </div>
      <p className="photo-rail-help">
        {autoRequested
          ? 'A new frame every few seconds. Hover or focus to pause.'
          : 'Swipe, scroll, or use the arrows to explore.'}{' '}
        Select a photo for the full view.
      </p>
    </div>
  );
}
