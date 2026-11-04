import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { ROUTES } from '@/constants/routes';

export function NotFoundPage() {
  return (
    <section className="section">
      <div className="container">
        <p className="eyebrow">PAGE NOT FOUND</p>
        <h1 className="page-title">This page isn’t here.</h1>
        <p className="section-copy">Let’s get you back to Made in India.</p>
        <div className="button-row">
          <Link className="button button-primary" to={ROUTES.HOME}>
            Go to Home <Icon name="arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
