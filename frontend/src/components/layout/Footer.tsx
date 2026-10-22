import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/common/BrandLogo';
import { Icon } from '@/components/ui/Icon';
import { SITE } from '@/constants/app';
import { ROUTES } from '@/constants/routes';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link className="footer-logo" to={ROUTES.HOME} aria-label={`${SITE.NAME} home`}>
            <BrandLogo footer />
          </Link>
          <p>
            We build AI products around real problems, and bring young minds together to explore
            what comes next.
          </p>
          <a
            className="social-link"
            href={SITE.LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${SITE.ORGANISER} on LinkedIn (opens in a new tab)`}
          >
            <span aria-hidden="true">in</span>
          </a>
        </div>
        <div className="footer-office">
          <h2>Office</h2>
          <ul className="contact-list">
            <li>
              <Icon name="pin" />
              <a href={SITE.MAP_URL} target="_blank" rel="noopener noreferrer">
                {SITE.ADDRESS}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <Icon name="phone" />
              <a href={`tel:${SITE.PHONE}`}>
                <strong>Mobile:</strong> {SITE.PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <Icon name="mail" />
              <a href={`mailto:${SITE.EMAIL}`}>
                <strong>Email:</strong> {SITE.EMAIL}
              </a>
            </li>
          </ul>
        </div>
        <div className="footer-links">
          <h2>Quick Links</h2>
          <nav aria-label="Footer navigation">
            <Link to={ROUTES.HOME}>Home</Link>
            <Link to={ROUTES.ABOUT}>About Us</Link>
            <Link to={ROUTES.GALLERY}>Gallery</Link>
            <Link to={ROUTES.REGISTER}>Register</Link>
            <a href={SITE.OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
              Visit {SITE.ORGANISER} <Icon name="external" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </nav>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <p>
            © {new Date().getFullYear()} {SITE.ORGANISER}. All rights reserved.
          </p>
          <span>Made in India. Start with an idea.</span>
        </div>
      </div>
    </footer>
  );
}
