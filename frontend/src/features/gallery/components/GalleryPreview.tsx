import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ROUTES } from '@/constants/routes';
import { HACKATHON_PHOTOS, AFTERPARTY_PHOTOS } from '../data/media';
import './gallery_preview.css';

const MOMENTS = [
  HACKATHON_PHOTOS[0],
  HACKATHON_PHOTOS[4],
  HACKATHON_PHOTOS[7],
  AFTERPARTY_PHOTOS[1],
  AFTERPARTY_PHOTOS[4],
];

export function GalleryPreview() {
  const [selected, setSelected] = useState(0);
  const photo = MOMENTS[selected];
  const move = (direction: number) =>
    setSelected((current) => (current + direction + MOMENTS.length) % MOMENTS.length);
  return (
    <section className="section gallery-preview" aria-labelledby="gallery-preview-title">
      <div className="container gallery-preview-grid">
        <div className="gallery-preview-copy">
          <p className="eyebrow">THE 2026 MEMORY BOOK</p>
          <h2 id="gallery-preview-title">
            You had to
            <br />
            be <span>there.</span>
          </h2>
          <p>
            The table talks. The big presentations. The dance floor. A few moments that made this
            edition ours.
          </p>
          <Link className="button button-primary" to={ROUTES.GALLERY}>
            Explore the gallery <Icon name="arrow" />
          </Link>
          <div className="memory-navigation" role="group" aria-label="Browse event memories">
            <button type="button" aria-label="Previous memory" onClick={() => move(-1)}>
              <Icon name="arrow" />
            </button>
            <span aria-live="polite" aria-atomic="true">
              {String(selected + 1).padStart(2, '0')} <span>/ 05</span>
            </span>
            <button type="button" aria-label="Next memory" onClick={() => move(1)}>
              <Icon name="arrow" />
            </button>
          </div>
          <p className="memory-hint">Pick a frame. Relive a moment.</p>
        </div>
        <div className="memory-book">
          <figure className="memory-feature" id="memory-feature">
            <img
              key={photo.id}
              src={photo.src}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
            />
            <span className="memory-location">BENGALURU · 2026</span>
            <figcaption>
              <strong>{photo.title}</strong>
              <span>{photo.caption}</span>
            </figcaption>
          </figure>
          <div className="memory-filmstrip" role="group" aria-label="Choose an event memory">
            {MOMENTS.map((moment, index) => (
              <button
                key={moment.id}
                type="button"
                aria-label={`Show memory: ${moment.title}`}
                aria-pressed={selected === index}
                aria-controls="memory-feature"
                onClick={() => setSelected(index)}
              >
                <img
                  src={moment.src}
                  alt=""
                  width={160}
                  height={107}
                  loading="lazy"
                  decoding="async"
                />
                <span>{String(index + 1).padStart(2, '0')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
