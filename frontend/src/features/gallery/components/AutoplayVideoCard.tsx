import { useCallback, useEffect, useRef, useState } from 'react';
import type { HackathonVideo } from '../data/media';
import './autoplay_video.css';

interface AutoplayVideoCardProps {
  video: HackathonVideo;
  enabled: boolean;
  index: number;
}

type PlaybackMode = 'auto' | 'play' | 'pause';

export function AutoplayVideoCard({ video, enabled }: AutoplayVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wantsPlayback = useRef(false);
  const [inView, setInView] = useState(false);
  const [hasEnteredView, setHasEnteredView] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<'blocked' | 'error' | null>(null);
  const [documentVisible, setDocumentVisible] = useState(
    () => document.visibilityState === 'visible',
  );
  const [playback, setPlayback] = useState<{ enabled: boolean; mode: PlaybackMode }>({
    enabled,
    mode: 'auto',
  });

  // Suspending autoplay cancels a manual start but preserves a deliberate pause.
  const mode = playback.enabled === enabled || playback.mode === 'pause' ? playback.mode : 'auto';
  if (playback.enabled !== enabled) setPlayback({ enabled, mode });
  const shouldPlay =
    inView && documentVisible && (mode === 'play' || (enabled && mode !== 'pause'));

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
      setPlayback({ enabled, mode: 'pause' });
    });
  }, [enabled]);

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

  function play() {
    setNotice(null);
    if (!inView) videoRef.current?.scrollIntoView({ block: 'center' });
    if (videoRef.current?.error) videoRef.current.load();
    setPlayback({ enabled, mode: 'play' });
    // Keep explicit retries inside the click's browser playback authorization.
    if (inView && hasEnteredView) {
      wantsPlayback.current = true;
      startPlayback();
    }
  }

  function pause() {
    wantsPlayback.current = false;
    videoRef.current?.pause();
    setPlayback({ enabled, mode: 'pause' });
  }

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
            // Keep browser-initiated playback in sync with the gallery state.
            if (!wantsPlayback.current) setPlayback({ enabled, mode: 'play' });
          }}
          onPause={(event) => {
            setPlaying(false);
            // A deliberate pause persists when the visitor scrolls away and back.
            if (wantsPlayback.current && event.currentTarget.paused) {
              setPlayback({ enabled, mode: 'pause' });
            }
          }}
          onError={() => {
            wantsPlayback.current = false;
            setPlaying(false);
            setNotice('error');
            setPlayback({ enabled, mode: 'pause' });
          }}
        >
          Your browser cannot play this video. <a href={video.src}>Open the video file</a>.
        </video>
        <button
          className="autoplay-video-toggle"
          type="button"
          onClick={playing ? pause : play}
          aria-label={`${playing ? 'Pause' : 'Play'} video: ${video.location}`}
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
