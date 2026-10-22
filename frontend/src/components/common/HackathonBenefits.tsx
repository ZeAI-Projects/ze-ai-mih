import { CONFIRMED_BENEFITS } from '@/constants/hackathon';
import './hackathon_benefits.css';

export function HackathonBenefits({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`section hackathon-benefits${compact ? ' hackathon-benefits--compact' : ''}`}
      id="benefits"
      aria-labelledby="benefits-title"
    >
      <div className="container">
        <div className="section-grid">
          <div>
            <p className="eyebrow">CONFIRMED FOR THE NEXT EDITION</p>
            <h2 className="section-heading" id="benefits-title">
              Build your idea.
              <br />
              <span>Grow along the way.</span>
            </h2>
          </div>
          <p className="section-copy">
            Learning, guidance, and good company. Here’s what you can look forward to while turning
            a real-world challenge into something you can show.
          </p>
        </div>
        <div className="benefit-grid">
          {CONFIRMED_BENEFITS.map((benefit, index) => (
            <article className="benefit-card" key={benefit.title}>
              <span className="benefit-number" aria-hidden="true">
                0{index + 1}
              </span>
              <div>
                <h3>{benefit.title}</h3>
                {!compact && <p>{benefit.description}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
