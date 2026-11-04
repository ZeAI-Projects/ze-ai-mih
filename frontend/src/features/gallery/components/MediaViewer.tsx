import { useEffect, useRef, type MouseEvent, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { HACKATHON_PHOTOS, AFTERPARTY_PHOTOS, HACKATHON_VIDEOS } from '../data/media';
import './media_viewer.css';

export type MediaSelection = { kind: 'photo' | 'afterparty' | 'video'; index: number } | null;

interface MediaViewerProps {
  selection: MediaSelection;
  onClose: () => void;
  onPhotoChange: (index: number) => void;
}

export function MediaViewer({ selection, onClose, onPhotoChange }: MediaViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photos = selection?.kind === 'afterparty' ? AFTERPARTY_PHOTOS : HACKATHON_PHOTOS;
  const photo = selection && selection.kind !== 'video' ? photos[selection.index] : null;
  const video = selection?.kind === 'video' ? HACKATHON_VIDEOS[selection.index] : null;
  const isOpen = selection !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen) {
      dialog?.close();
      return;
    }
    if (dialog && !dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function closeViewer() {
    dialogRef.current?.close();
    onClose();
  }

  function changePhoto(offset: number) {
    if (selection) {
      onPhotoChange((selection.index + offset + photos.length) % photos.length);
    }
  }

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      closeViewer();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (!photo || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      changePhoto(event.key === 'ArrowRight' ? 1 : -1);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="media-viewer"
      aria-labelledby="media-viewer-title"
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeViewer();
      }}
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
    >
      <div className="media-viewer-header">
        <span>
          {selection?.kind === 'afterparty' ? 'AFTERPARTY · 2026' : 'MADE IN INDIA · 2026'}
        </span>
        <button
          className="media-close"
          type="button"
          autoFocus
          onClick={closeViewer}
          aria-label="Close media viewer"
        >
          <Icon name="close" />
        </button>
      </div>
      {photo && (
        <img
          className="media-viewer-photo"
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
        />
      )}
      {video && (
        <video
          key={video.id}
          className="media-viewer-video"
          src={video.src}
          poster={video.poster}
          aria-label={video.title}
          controls
          autoPlay
          playsInline
          preload="metadata"
        />
      )}
      <div className="media-viewer-caption">
        <div aria-live="polite">
          <h2 id="media-viewer-title">{video?.title ?? photo?.title}</h2>
          <p>{video?.description ?? photo?.caption}</p>
          {photo && (
            <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
              From {photo.credit} <Icon name="external" />
            </a>
          )}
        </div>
        {photo && (
          <div className="photo-controls">
            <button type="button" aria-label="Previous photo" onClick={() => changePhoto(-1)}>
              <Icon name="arrow" />
            </button>
            <span>
              {(selection?.index ?? 0) + 1} / {photos.length}
            </span>
            <button type="button" aria-label="Next photo" onClick={() => changePhoto(1)}>
              <Icon name="arrow" />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
