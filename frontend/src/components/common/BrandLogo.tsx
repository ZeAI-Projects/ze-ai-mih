import { SITE } from '@/constants/app';
import { useTheme } from '@/hooks/use_theme';

export function BrandLogo({ footer = false }: { footer?: boolean }) {
  const theme = useTheme();
  return (
    <span className={`brand-image${footer ? ' brand-image--footer' : ''}`}>
      <img
        src={theme === 'dark' ? SITE.FOOTER_LOGO : SITE.LOGO}
        width={2170}
        height={725}
        alt={`${SITE.ORGANISER} — Empowering You. ${SITE.NAME}.`}
        fetchPriority={footer ? 'auto' : 'high'}
        loading={footer ? 'lazy' : 'eager'}
      />
    </span>
  );
}
