import { useState } from 'react';
import { DOMAINS } from '@/constants/hackathon';
import { Icon } from '@/components/ui/Icon';

const IDEAS = [
  'What could you automate to give someone an hour of their day back?',
  'How could technology make everyday healthcare easier to access?',
  'What would make learning work better in a low-bandwidth classroom?',
  'How could people share safety information while protecting their privacy?',
  'How would you help someone recognise a scam before they click?',
  'What could make everyday money decisions simpler to understand?',
  'How could a daily commute become more accessible and predictable?',
  'What small change could help a community measure and reduce waste?',
  'What could more people do if technology spoke their language?',
  'How could a small manufacturer spot a problem before production stops?',
  'What useful insight could you build from open satellite data?',
  'How could a farmer turn local information into better decisions?',
];

export function DomainExplorer() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <ul className="domain-list" aria-label="Hackathon domains">
        {DOMAINS.map((domain, index) => (
          <li key={domain}>
            <button
              type="button"
              aria-pressed={selected === index}
              aria-controls="domain-idea"
              onClick={() => setSelected(index)}
            >
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              {domain}
            </button>
          </li>
        ))}
      </ul>
      {selected !== null && <div className="domain-idea" id="domain-idea" role="status" aria-live="polite">
        <span className="domain-idea-icon" aria-hidden="true">
          <Icon name="spark" />
        </span>
        <div>
          <p className="domain-idea-label">A STARTING POINT · {DOMAINS[selected]}</p>
          <p className="domain-idea-question">{IDEAS[selected]}</p>
        </div>
        <span className="domain-idea-note">
          An idea to explore,
          <br />
          not an official brief.
        </span>
      </div>}
    </>
  );
}
