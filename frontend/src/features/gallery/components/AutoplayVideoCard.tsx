import { useCallback, useEffect, useRef, useState } from 'react';
import type { HackathonVideo } from '../data/media';
import './autoplay_video.css';

interface AutoplayVideoCardProps {
  video: HackathonVideo;
  enabled: boolean;
  index: number;
  onOpen: () => void;
}

export function AutoplayVideoCard({ video, enabled, onOpen }: AutoplayVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wantsPlayback = useRef(false);
  const [inView, setInView] = useState(false);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<'blocked' | 'error' | null>(null);
  const [documentVisible, setDocumentVisible] = useState(
    () => document.visibilityState === 'visible',
  );
  const shouldPlay = inView && documentVisible && enabled;

  const startPlayback = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    element.play().catch((error: unknown) => {
      if (
        !element.isConnected ||
        !wantsPlayback.current ||
        !element.paused ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        return;
      setNotice(
        error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'error',
      );
    });
  }, []);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
        setInView(visible);
        if (visible) setHasEnteredView(true);
      },
      { threshold: [0, 0.25] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibility = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    wantsPlayback.current = shouldPlay;
    if (shouldPlay && hasEnteredView) {
      if (element.paused) startPlayback();
    } else {
      element.pause();
    }
  }, [shouldPlay, hasEnteredView, startPlayback]);

  useEffect(() => {
    const element = videoRef.current;
    return () => {
      wantsPlayback.current = false;
      element?.pause();
    };
  }, []);

  return (
    <article className="autoplay-video-card" data-video-id={video.id} aria-label={video.location}>
      <div className="autoplay-video-screen">
        <video
          ref={videoRef}
          className="autoplay-video-frame"
          src={hasEnteredView ? video.src : undefined}
          poster={video.poster}
          aria-label={`${video.location} — video by ${video.credit}`}
          controls={false}
          tabIndex={-1}
          muted
          playsInline
          loop
          preload="none"
          onPlay={() => {
            setPlaying(true);
            setNotice(null);
            if (!wantsPlayback.current) videoRef.current?.pause();
          }}
          onPause={() => setPlaying(false)}
          onError={() => {
            wantsPlayback.current = false;
            setPlaying(false);
            setNotice('error');
                }}
        >
          Your browser cannot play this video. <a href={video.src}>Open the video file</a>.
        </video>
        <button
          className="autoplay-video-toggle"
          type="button"
          onClick={onOpen}
          aria-label={`Open video player: ${video.location}`}
          data-playing={playing}
        />
        {notice && (
          <p className="autoplay-video-notice" role="status">
            {notice === 'blocked'
              ? 'Click or tap the video to play.'
              : 'This clip couldn’t load. Tap to retry or '}
            {notice === 'error' && (
              <a href={video.src} target="_blank" rel="noopener noreferrer">
                open the video file
              </a>
            )}
            {notice === 'error' && '.'}
          </p>
        )}
      </div>
    </article>
  );
}
