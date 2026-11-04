import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { SITE } from '@/constants/app';
import { HACKATHON_PHOTOS } from '@/features/gallery/data/media';
import { LabXFocus } from '../components/LabXFocus';
import { AboutJourney } from '../components/AboutJourney';
import '../styles/about.css';

const VALUES = [
  ['Room to belong.', 'Make space for every person’s ideas, growth, and wellbeing.', 'users'],
  ['Stay curious.', 'Learn from one another through mentoring, workshops, and practice.', 'spark'],
  ['Speak openly.', 'Ask questions, share feedback, and keep improving together.', 'code'],
  ['Life matters, too.', 'Support flexibility and wellbeing alongside meaningful work.', 'globe'],
] as const;
const STRENGTHS = [
  ['Product focus.', 'Start with a real problem and build towards a useful product.'],
  ['Technology with purpose.', 'Choose AI, automation, and web technologies to fit the challenge.'],
  ['Curious minds.', 'Bring fresh questions to familiar problems and keep learning.'],
  ['Shared progress.', 'Exchange ideas openly and use feedback to strengthen the next version.'],
];

export function AboutPage({ embedded = false }: { embedded?: boolean }) {
  const Title = embedded ? 'h2' : 'h1';
  const groupPhoto = HACKATHON_PHOTOS[7];
  return (
    <div className="about-page">
      <section className="about-opening">
        <div className="container">
          <div className="about-opening-top">
            <div>
              <p className="eyebrow">THE PEOPLE BEHIND THE IDEAS</p>
              <Title className="page-title">
                Curious minds.
                <br />
                <span>Useful technology.</span>
              </Title>
            </div>
            <div className="about-opening-intro">
              <p>
                Meet the product company behind Made in India and the people bringing students,
                ideas, and technology together.
              </p>
              <a className="text-link" href="#our-story">
                Get to know us <Icon name="arrow" />
              </a>
            </div>
          </div>
          <div className="about-opening-bottom">
            <figure className="about-community-photo">
              <img
                src={groupPhoto.src}
                alt={groupPhoto.alt}
                width={1600}
                height={1066}
                decoding="async"
                loading={embedded ? 'lazy' : 'eager'}
                fetchPriority={embedded ? 'auto' : 'high'}
              />
              <figcaption>
                <span>BENGALURU / 2026</span>
                {groupPhoto.caption}
              </figcaption>
            </figure>
            <div className="about-purpose-tile">
              <Icon name="spark" />
              <p>
                Built around
                <br />
                <strong>people.</strong>
              </p>
              <span>
                Bring your perspective.
                <br />
                Build something together.
              </span>
              <a href="#founder" aria-label="Meet our founder">
                <Icon name="arrow" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        className="section about-initiative"
        id="our-story"
        aria-labelledby="initiative-title"
      >
        <div className="container">
          <div className="about-story-heading">
            <div>
              <p className="eyebrow">THE MADE-IN-INDIA INITIATIVE</p>
              <h2 className="section-heading" id="initiative-title">
                An idea is
                <br />
                <span>just the start.</span>
              </h2>
            </div>
            <p className="section-copy">
              An idea gets more interesting when you start building it. ZeAI Soft created the
              Made-in-India Hackathon for students and emerging innovators to test their thinking,
              build with others, and show what their ideas can do.
            </p>
          </div>
          <AboutJourney />
        </div>
      </section>

      <section className="section about-company" aria-labelledby="company-title">
        <div className="container">
          <div className="about-company-heading">
            <div>
              <p className="eyebrow">ZEAI SOFT · A PRODUCT COMPANY</p>
              <h2 className="section-heading" id="company-title">
                Real problems.
                <br />
                <span>Purposeful products.</span>
              </h2>
            </div>
            <div>
              <p className="section-copy">
                ZeAI Soft is a product-based technology company working with artificial
                intelligence, machine learning, automation, and web technologies. Its focus is
                practical: turn complex business challenges into useful digital products.
              </p>
              <a
                className="text-link"
                href={SITE.ABOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                More about ZeAI Soft <Icon name="external" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>
          <div className="about-direction">
            <article>
              <span className="direction-icon">
                <Icon name="spark" />
              </span>
              <div>
                <p className="eyebrow">WHAT DRIVES US</p>
                <h3>Mission</h3>
                <p>Build AI-powered products that solve everyday business challenges.</p>
              </div>
            </article>
            <article>
              <span className="direction-icon">
                <Icon name="globe" />
              </span>
              <div>
                <p className="eyebrow">WHERE WE'RE HEADING</p>
                <h3>Vision</h3>
                <p>Create products people can trust, in India and beyond.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section founder-section" id="founder" aria-labelledby="founder-title">
        <div className="container about-founder">
          <figure className="founder-photo">
            <div className="founder-portrait-window">
              <img
                className="founder-portrait"
                src="/media/made-in-india-2026/kirthika-profile-cutout.png"
                alt="Portrait of Kirthika K., Founder and Managing Director of ZeAI Soft, wearing an orange saree"
                width={1024}
                height={1535}
                loading="lazy"
                decoding="async"
              />
            </div>
            <span className="founder-portrait-spark" aria-hidden="true">
              <Icon name="spark" />
            </span>
            <figcaption className="founder-portrait-label">
              <span>ZEAI SOFT</span>
              <span>Curiosity. With purpose.</span>
            </figcaption>
          </figure>
          <div className="founder-story">
            <p className="eyebrow">MEET OUR FOUNDER</p>
            <h2 id="founder-title">
              Kirthika <span>K.</span>
            </h2>
            <p className="founder-role">
              Founder &amp; Managing Director
              <br />
              ZeAI Soft
            </p>
            <div className="founder-rule">
              <span /> <Icon name="spark" />
            </div>
            <h3>
              A product mindset.
              <br />A place to begin.
            </h3>
            <p>
              Kirthika K. leads ZeAI Soft, the product company behind Made in India. The hackathon
              brings that focus on building into a shared space for students and emerging
              innovators.
            </p>
            <p>
              Here, learning takes a practical shape: a challenge to explore, people to build with,
              and a project to present.
            </p>
            <a className="text-link" href={`mailto:${SITE.EMAIL}`}>
              Connect with ZeAI Soft <Icon name="arrow" />
            </a>
          </div>
        </div>
      </section>

      <section className="section about-values" aria-labelledby="values-title">
        <div className="container">
          <div className="about-values-heading">
            <div>
              <p className="eyebrow">OUR VALUES</p>
              <h2 className="section-heading" id="values-title">
                People at
                <br />
                <span>the centre.</span>
              </h2>
            </div>
            <p className="section-copy">Good work starts with how we treat the people doing it.</p>
          </div>
          <div className="about-value-cards">
            {VALUES.map(([title, text, icon], index) => (
              <article key={title}>
                <div>
                  <span>0{index + 1}</span>
                  <Icon name={icon} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section about-ecosystem" aria-labelledby="labx-title">
        <div className="container about-ecosystem-grid">
          <div className="ecosystem-copy">
            <p className="eyebrow">BEYOND THE HACKATHON</p>
            <h2 className="section-heading">
              Keep the
              <br />
              <span>idea moving.</span>
            </h2>
            <p className="section-copy">
              What happens after the final presentation? The vision for LabX is to help ideas keep
              growing through project development, collaboration, and mentorship.
            </p>
            <div className="ecosystem-path" aria-hidden="true">
              <span>IDEA</span>
              <Icon name="arrow" />
              <span>PEOPLE</span>
              <Icon name="arrow" />
              <span>PROGRESS</span>
            </div>
          </div>
          <aside className="about-labx">
            <div className="labx-topline">
              <p className="eyebrow">A VISION FOR WHAT COMES NEXT</p>
              <Icon name="spark" />
            </div>
            <h3 id="labx-title">
              Lab<span>X</span>
            </h3>
            <p>A future space for people to find collaborators and take their projects further.</p>
            <LabXFocus />
          </aside>
        </div>
      </section>

      <section className="section about-strengths" aria-labelledby="strengths-title">
        <div className="container about-strengths-grid">
          <div>
            <p className="eyebrow">OUR STRENGTHS</p>
            <h2 className="section-heading" id="strengths-title">
              How we
              <br />
              move forward.
            </h2>
          </div>
          <div className="strength-rows">
            {STRENGTHS.map(([title, text], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <Icon name="arrow" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section about-connect" aria-labelledby="about-contact-title">
        <div className="container about-connect-card">
          <div>
            <p className="eyebrow">ZEAI SOFT × MADE IN INDIA</p>
            <h2 id="about-contact-title">
              Good things start
              <br />
              with a conversation.
            </h2>
            <p>Have a question about Made in India? Start with a hello.</p>
          </div>
          <div className="about-connect-actions">
            <Link className="button button-primary" to="/#register">
              Build your next big idea <Icon name="arrow" />
            </Link>
            <a className="text-link" href={`mailto:${SITE.EMAIL}`}>Email the team <Icon name="mail" /></a>
          </div>
        </div>
      </section>
    </div>
  );
}
