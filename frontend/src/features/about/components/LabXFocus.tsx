import { useState } from 'react';

const FOCUS = [
  {
    title: 'Develop',
    text: 'The aim: give early ideas room to become working prototypes through practical project development.',
  },
  {
    title: 'Connect',
    text: 'The aim: bring innovators together to find collaborators, compare approaches, and learn from one another.',
  },
  {
    title: 'Grow',
    text: 'The aim: connect projects with mentorship and opportunities that can help shape their next step.',
  },
];

export function LabXFocus() {
  const [selected, setSelected] = useState(0);
  return (
    <div className="labx-explorer">
      <div className="about-labx-focus" role="group" aria-label="Explore LabX focus areas">
        {FOCUS.map((focus, index) => (
          <button
            type="button"
            key={focus.title}
            aria-pressed={selected === index}
            aria-controls="labx-focus-description"
            onClick={() => setSelected(index)}
          >
            {focus.title}
          </button>
        ))}
      </div>
      <p id="labx-focus-description" role="status" aria-live="polite">
        {FOCUS[selected].text}
      </p>
      <span className="labx-plan-label">
        Part of the LabX vision. These are planned areas of focus.
      </span>
    </div>
  );
}
