import { useEffect, useState } from 'react';
import { get } from '@/lib/miihApi';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import { HACKATHON_PHOTOS, HACKATHON_VIDEOS, AFTERPARTY_PHOTOS } from '../data/media';
import { MediaViewer, type MediaSelection } from '../components/MediaViewer';
import { PhotoRail } from '../components/PhotoRail';
import { GallerySpotlight } from '../components/GallerySpotlight';
import { AutoplayVideoCard } from '../components/AutoplayVideoCard';
import '../styles/gallery.css';

const IDEA_SPARKS = [
  'What could you build to make someone’s everyday a little easier?',
  'Pick a problem around you. Sketch a smarter way to solve it.',
  'Pair your strongest skill with someone else’s curiosity.',
  'What would you make if you had a team and one weekend?',
  'Start with a tiny idea. Give it one unexpected twist.',
];

export function GalleryPage() {
  const reducedMotion = useReducedMotion();
  const [selection, setSelection] = useState<MediaSelection>(null);
  const [newMedia,setNewMedia]=useState<Array<{key:string;url:string;kind:'IMAGE'|'VIDEO';label:string;category:string;alt_text?:string}>>([]);
  useEffect(()=>{let active=true;const refresh=()=>{void get<typeof newMedia>('/public/gallery-additions').then(rows=>{if(active)setNewMedia(rows);}).catch(()=>{});};refresh();window.addEventListener('miih:data-updated',refresh);return()=>{active=false;window.removeEventListener('miih:data-updated',refresh);};},[]);
  const [sparkIndex, setSparkIndex] = useState(0);

  return (
    <div className="gallery-page">
      <section className="gallery-intro" aria-labelledby="gallery-title">
        <div className="container">
          <p className="gallery-kicker">
            <Icon name="spark" /> 2026 REPLAY · MOMENTS UNLOCKED
          </p>
          <div className="gallery-heading-row">
            <h2 id="gallery-title">
              The ideas. The people.
              <br />
              <span>The energy.</span>
            </h2>
            <aside className="gallery-idea-spark" aria-label="Idea spark">
              <span className="idea-spark-label">
                <Icon name="spark" /> A LITTLE IDEA SPARK
              </span>
              <p aria-live="polite" aria-atomic="true">
                {IDEA_SPARKS[sparkIndex]}
              </p>
              <button
                type="button"
                onClick={() => setSparkIndex((current) => (current + 1) % IDEA_SPARKS.length)}
              >
                Give me another <Icon name="arrow" />
              </button>
            </aside>
          </div>
          <div className="gallery-intro-bottom">
            <p className="gallery-description">
              From the first spark to the last track. A little collaboration, a lot of curiosity,
              and room to celebrate.
            </p>
            <div className="gallery-context">
              <span className="gallery-context-label">
                <span aria-hidden="true" /> Made in India · Bengaluru 2026
              </span>
              <p>
                The builds, the breakthroughs, the people. Real moments from our finals in
                Bengaluru, Karnataka.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="gallery-collection">
        <div className="container">
          <section
            className="gallery-panel gallery-panel--photos"
            id="gallery-photos"
            aria-labelledby="gallery-photos-title"
          >
            <div className="gallery-panel-heading">
              <div>
                <p className="gallery-panel-kicker">01 / BEHIND THE BUILD</p>
                <h2 id="gallery-photos-title">
                  Small moments.
                  <br />
                  <span>Big possibilities.</span>
                </h2>
              </div>
              <p>Shared screens. Fresh perspectives. Explore moments of teamwork and creativity.</p>
            </div>
            <PhotoRail
              photos={HACKATHON_PHOTOS}
              category="photos"
              autoPlay={false}
              suspended={selection !== null}
              onSelect={(index) => setSelection({ kind: 'photo', index })}
            />
          </section>

          <GallerySpotlight
            photo={HACKATHON_PHOTOS[7]}
            label="A MOMENT TO REMEMBER"
            onSelect={() => setSelection({ kind: 'photo', index: 7 })}
          />

          <section
            className="gallery-panel gallery-panel--videos"
            id="gallery-videos"
            aria-labelledby="gallery-videos-title"
          >
            <div className="gallery-panel-heading">
              <div>
                <p className="gallery-panel-kicker">02 / THE ENERGY IN MOTION</p>
                <h2 id="gallery-videos-title">
                  See the ideas.
                  <br />
                  <span>Feel the energy.</span>
                </h2>
              </div>
              <p>
                Two edited event films and three moments from the floor.{' '}
                {reducedMotion
                  ? 'Click a film to open the player. Automatic playback is off to match your reduced-motion preference.'
                  : 'Films play muted as you scroll into view. Click a film to open the full player.'}
              </p>
            </div>
            <div className="gallery-video-grid">
              {HACKATHON_VIDEOS.map((video, index) => (
                <AutoplayVideoCard
                  key={video.id}
                  video={video}
                  index={index}
                  enabled={!reducedMotion && selection === null}
                  onOpen={() => setSelection({ kind: 'video', index })}
                />
              ))}
            </div>
          </section>

          <section
            className="gallery-panel gallery-panel--afterparty"
            id="gallery-afterparty"
            aria-labelledby="gallery-afterparty-title"
          >
            <div className="gallery-panel-heading">
              <div>
                <p className="gallery-panel-kicker">03 / AFTER THE LAST DEMO</p>
                <h2 id="gallery-afterparty-title">
                  Build all day.
                  <br />
                  <span>Dance all night.</span>
                </h2>
              </div>
              <p>
                The demos wrapped. The music took over. Ten moments from our DJ night, with the
                people who made the weekend.
              </p>
            </div>
            <div className="afterparty-tag">
              <span aria-hidden="true">♫</span> GOOD MUSIC. BETTER COMPANY.
            </div>
            <GallerySpotlight
              photo={AFTERPARTY_PHOTOS[4]}
              label="FROM THE OTHER SIDE OF THE DECKS"
              onSelect={() => setSelection({ kind: 'afterparty', index: 4 })}
            />
            <PhotoRail
              photos={AFTERPARTY_PHOTOS}
              category="afterparty"
              suspended={selection !== null}
              onSelect={(index) => setSelection({ kind: 'afterparty', index })}
            />
            <p className="afterparty-sample-note">
              From the 2026 afterparty. One last track, a room full of memories.
            </p>
          </section>

          {newMedia.length>0&&<section className="miih-gallery-additions" aria-label="Additional hackathon gallery media"><h2>More hackathon moments</h2>{Array.from(new Set(newMedia.map(m=>m.category))).map(category=><div key={category}><h3>{category}</h3><div className="miih-gallery-additions-grid">{newMedia.filter(m=>m.category===category).map(m=><figure key={m.key}>{m.kind==='VIDEO'?<video src={m.url} controls playsInline preload="metadata"/>:<img src={m.url} alt={m.alt_text||m.label} loading="lazy"/>}<figcaption>{m.label}</figcaption></figure>)}</div></div>)}</section>}
          <div className="gallery-credit-row">
            <p>Our people. Our moments. Made in India.</p>
          </div>
          <aside className="gallery-next" aria-labelledby="gallery-next-title">
            <div className="gallery-next-icon" aria-hidden="true">
              <Icon name="spark" />
            </div>
            <div className="gallery-next-copy">
              <p className="gallery-next-kicker">YOUR NEXT CHAPTER</p>
              <h2 id="gallery-next-title">Ready to make your own moment?</h2>
              <p>Bring your curiosity. Find your people. Build something that matters.</p>
            </div>
            <Link className="button button-primary" to="/#register">
              Create your 2027 moment <Icon name="arrow" />
            </Link>
          </aside>
        </div>
      </div>
      <MediaViewer
        selection={selection}
        onClose={() => setSelection(null)}
        onPhotoChange={(index) =>
          setSelection((current) => (current ? { ...current, index } : null))
        }
      />
    </div>
  );
}
