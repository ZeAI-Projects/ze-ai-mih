import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { HACKATHON_PHOTOS } from '@/features/gallery/data/media';
import './hero_visual.css';

const CARD_TURNS = [-4, 5, -2, 7, -6, 3, -5, 4, -1, 6];

export function HeroVisual() {
  const [dropCount, setDropCount] = useState(0);
  const photoCount = HACKATHON_PHOTOS.length;
  const currentIndex = dropCount % photoCount;
  const mountedCount = Math.min(dropCount + 1, 3);
  const cards = Array.from(
    { length: mountedCount },
    (_, index) => dropCount - mountedCount + index + 1,
  );

  useEffect(() => {
    if (dropCount === 0) return;
    // Warm just the next image so a new card is ready without mounting the whole collection.
    const nextImage = new Image();
    nextImage.decoding = 'async';
    nextImage.fetchPriority = 'low';
    nextImage.src = HACKATHON_PHOTOS[(currentIndex + 1) % photoCount].src;
  }, [currentIndex, photoCount, dropCount]);

  return (
    <div className="hero-visual">
      <p className="polaroid-intro">
        <Icon name="spark" /> 2026 Hackathon Replay · Level Complete
      </p>

      <button
        type="button"
        className="polaroid-stack"
        aria-label="Drop the next photo"
        aria-describedby="polaroid-instructions"
        onClick={() => setDropCount((count) => count + 1)}
      >
        {cards.map((serial, position) => {
          const index = serial % photoCount;
          const photo = HACKATHON_PHOTOS[index];
          const depth = dropCount - serial;

          return (
            <span
              key={serial}
              className={`polaroid-card${serial > 0 ? ' polaroid-card--dropped' : ''}`}
              aria-hidden={depth > 0 ? true : undefined}
              style={
                {
                  '--polaroid-turn': `${CARD_TURNS[index % CARD_TURNS.length]}deg`,
                  '--polaroid-depth': depth,
                  zIndex: position + 1,
                } as CSSProperties
              }
            >
              <span className="polaroid-image">
                <img
                  src={photo.src}
                  srcSet={photo.src === '/media/made-in-india-2026/event-01.webp' ? '/media/flight/hero-550.webp 550w, /media/flight/hero-960.webp 960w' : undefined}
                  sizes="(max-width: 767px) 85vw, 480px"
                  alt={depth === 0 ? photo.alt : ''}
                  width={photo.width}
                  height={photo.height}
                  loading="eager"
                  decoding={serial === 0 ? 'sync' : 'async'}
                  fetchPriority={serial === 0 ? 'high' : 'auto'}
                  draggable={false}
                />
              </span>
              <span className="polaroid-caption">
                <strong>{photo.title}</strong>
                <span>{photo.caption}</span>
              </span>
            </span>
          );
        })}
        <span className="polaroid-drop-mark" aria-hidden="true">
          <Icon name="arrow" />
        </span>
      </button>

      <div className="polaroid-meta">
        <p id="polaroid-instructions">Click the stack. See what drops next.</p>
        <p className="polaroid-counter" role="status" aria-live="polite" aria-atomic="true">
          Photo {currentIndex + 1} of {photoCount}
        </p>
      </div>
      <Link className="hero-visual-explore" to="/#gallery">
        Explore the moments <Icon name="arrow" />
      </Link>
    </div>
  );
}

