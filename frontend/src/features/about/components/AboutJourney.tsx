import { useState } from 'react';
import { HACKATHON_PHOTOS } from '@/features/gallery/data/media';
import { Icon } from '@/components/ui/Icon';

const CHAPTERS = [
  {
    name: 'Find your people',
    title: 'Your perspective belongs here.',
    text: 'Bring what you know and listen to what others see. A conversation with someone who thinks differently can change the way you approach a problem.',
    photo: HACKATHON_PHOTOS[0],
  },
  {
    name: 'Make it real',
    title: 'Make something you can test.',
    text: 'Sketch it, code it, try it. A first version gives you something to question, improve, and build on.',
    photo: HACKATHON_PHOTOS[3],
  },
  {
    name: 'Share your work',
    title: 'Show the work behind the idea.',
    text: 'Explain the problem you chose, walk through your approach, and demonstrate what you made. Let people see both the result and the thinking that got you there.',
    photo: HACKATHON_PHOTOS[4],
  },
];

export function AboutJourney() {
  const [selected, setSelected] = useState(0);
  const chapter = CHAPTERS[selected];
  return (
    <div className="about-journey">
      <div className="journey-choices" role="group" aria-label="Explore the hackathon journey">
        {CHAPTERS.map((item, index) => (
          <button
            type="button"
            key={item.name}
            aria-pressed={selected === index}
            aria-controls="journey-story"
            onClick={() => setSelected(index)}
          >
            <span>0{index + 1}</span>
            {item.name}
            <Icon name="arrow" />
          </button>
        ))}
      </div>
      <div className="journey-story" id="journey-story">
        <figure>
          <img
            src={chapter.photo.src}
            alt={chapter.photo.alt}
            width={1600}
            height={1066}
            loading="lazy"
            decoding="async"
          />
          <figcaption>{chapter.photo.caption}</figcaption>
        </figure>
        <div className="journey-story-copy" aria-live="polite" aria-atomic="true">
          <span className="journey-large-number" aria-hidden="true">
            0{selected + 1}
          </span>
          <h3>{chapter.title}</h3>
          <p>{chapter.text}</p>
          <span className="journey-footnote">THE MADE-IN-INDIA EXPERIENCE</span>
        </div>
      </div>
    </div>
  );
}
