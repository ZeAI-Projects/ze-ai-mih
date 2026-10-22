import { Icon } from '@/components/ui/Icon';
import type { HackathonPhoto } from '../data/media';
import './gallery_spotlight.css';

interface GallerySpotlightProps {
  photo: HackathonPhoto;
  label: string;
  onSelect: () => void;
}

export function GallerySpotlight({ photo, label, onSelect }: GallerySpotlightProps) {
  return (
    <figure className="gallery-spotlight">
      <button type="button" onClick={onSelect} aria-label={`Open spotlight: ${photo.title}`}>
        <span className="spotlight-image">
          <img
            src={photo.src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
          />
          <span className="spotlight-expand" aria-hidden="true">
            <Icon name="external" />
          </span>
        </span>
        <span className="spotlight-caption">
          <span className="spotlight-label">
            <Icon name="spark" /> {label}
          </span>
          <strong>{photo.title}</strong>
          <span>{photo.caption}</span>
        </span>
      </button>
    </figure>
  );
}
