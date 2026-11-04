import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ROUTES } from '@/constants/routes';
import './next_chapter.css';

const CHALLENGES = [
  {
    name: 'Everyday life',
    icon: 'users',
    prompts: [
      'Make one daily task easier for someone in your community.',
      'Help a neighbour recognise an online scam before they click.',
      'Make a busy commute easier to plan.',
    ],
  },
  {
    name: 'Our planet',
    icon: 'globe',
    prompts: [
      'Help your campus see where its water goes.',
      'Give something usually thrown away a useful second life.',
      'Help a neighbourhood turn food waste into a shared resource.',
    ],
  },
  {
    name: 'Learning',
    icon: 'spark',
    prompts: [
      'Make a difficult concept easier to explore in your own language.',
      'Help a classroom keep learning when the internet drops.',
      'Connect students who can teach each other a new skill.',
    ],
  },
] as const;

export function NextChapter() {
  const [category, setCategory] = useState(0);
  const [prompt, setPrompt] = useState(0);
  const challenge = CHALLENGES[category];
  return (
    <section className="next-chapter section" aria-labelledby="home-cta-title">
      <div className="container next-chapter-card">
        <div className="next-chapter-copy">
          <p className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p>
          <h2 id="home-cta-title">
            What will
            <br />
            you <span>change?</span>
          </h2>
          <p>
            Big ideas often start with a small question. Pick something you care about and find your
            first spark.
          </p>
          <Link className="button button-primary" to={ROUTES.REGISTER}>
            View upcoming event <Icon name="arrow" />
          </Link>
          <span className="next-edition-note">
            <span className="status-dot" aria-hidden="true" /> Next edition coming soon
          </span>
        </div>
        <div className="idea-playground">
          <div className="idea-picker" role="group" aria-label="Pick a challenge theme">
            {CHALLENGES.map((item, index) => (
              <button
                type="button"
                key={item.name}
                aria-pressed={category === index}
                aria-controls="challenge-prompt"
                onClick={() => {
                  setCategory(index);
                  setPrompt(0);
                }}
              >
                <Icon name={item.icon} />
                {item.name}
              </button>
            ))}
          </div>
          <div className="idea-note">
            <div className="idea-note-top">
              <span>A STARTING SPARK</span>
              <Icon name={challenge.icon} />
            </div>
            <p id="challenge-prompt" role="status" aria-live="polite" aria-atomic="true">
              {challenge.prompts[prompt]}
            </p>
            <div className="idea-note-bottom">
              <span>0{prompt + 1} / 03</span>
              <button
                type="button"
                onClick={() => setPrompt((value) => (value + 1) % challenge.prompts.length)}
              >
                Another spark <Icon name="arrow" />
              </button>
            </div>
          </div>
          <p className="idea-disclaimer">
            For inspiration. Official challenges will be announced with the next edition.
          </p>
        </div>
      </div>
    </section>
  );
}
