import { SITE } from '@/constants/app';

export function BrandLogo({ footer = false }: { footer?: boolean }) {
  return (
    <span className={`brand-image${footer ? ' brand-image--footer' : ''}`}>
      <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={SITE.FOOTER_LOGO} />
      <img
        src={SITE.LOGO}
        width={2170}
        height={725}
        alt={`${SITE.ORGANISER} — Empowering You. ${SITE.NAME}.`}
        fetchPriority={footer ? 'auto' : 'high'}
        loading={footer ? 'lazy' : 'eager'}
      />
      </picture>
    </span>
  );
}
