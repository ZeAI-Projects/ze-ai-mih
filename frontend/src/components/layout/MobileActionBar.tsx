import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { Icon } from '@/components/ui/Icon';
import './mobile_action_bar.css';

export function MobileActionBar() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const intro = document.querySelector('#main section');
    const footer = document.querySelector('.site-footer');
    if (!intro || !footer) return;
    let pastIntro = false;
    let nearFooter = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === intro) pastIntro = entry.boundingClientRect.bottom <= 0;
        if (entry.target === footer) nearFooter = entry.isIntersecting;
      }
      setVisible(pastIntro && !nearFooter);
    });
    observer.observe(intro);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  const onGallery = pathname.replace(/\/$/, '') === ROUTES.GALLERY;
  const onRegister = pathname.replace(/\/$/, '') === ROUTES.REGISTER;

  return (
    <nav className="mobile-action-bar" aria-label="Quick actions" hidden={!visible}>
      {onGallery ? (
        <a href="#gallery-photos">
          Explore photos <Icon name="spark" />
        </a>
      ) : (
        <Link to="/#gallery">
          Explore gallery <Icon name="spark" />
        </Link>
      )}
      {onRegister ? (
        <a className="mobile-action-primary" href="#registration-title">
          Registration <Icon name="arrow" />
        </a>
      ) : (
        <Link className="mobile-action-primary" to="/#register">
          Register <Icon name="arrow" />
        </Link>
      )}
    </nav>
  );
}

