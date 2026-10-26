import logo from '@/assets/images/header-brand.webp';
import darkLogo from '@/assets/images/made-in-india-logo-footer.png';
import labx from '@/assets/images/labx-transparent.png';

export function ZeaiMark() {
  return <span className="zeai-crop"><picture><source media="(prefers-color-scheme: dark)" srcSet={darkLogo} /><img src={logo} alt="ZeAI Soft" width="2170" height="725" /></picture></span>;
}

export function MadeInIndiaMark() {
  return <span className="india-crop"><picture><source media="(prefers-color-scheme: dark)" srcSet={darkLogo} /><img src={logo} alt="#MadeInIndia" width="2170" height="725" /></picture></span>;
}

export function HeaderBrand() {
  return <span className="season-brand"><ZeaiMark /><span className="brand-divider" />
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        {/* The original mark has white lettering; preserve its blue/cyan artwork. */}
        <filter id="labx-light-ink" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="letterMask" />
          <feComposite in="letterMask" in2="SourceAlpha" operator="in" result="letters" />
          <feFlood floodColor="#30283e" result="ink" />
          <feComposite in="ink" in2="letters" operator="in" result="darkLetters" />
          <feComposite in="SourceGraphic" in2="letters" operator="out" result="colorMark" />
          <feMerge><feMergeNode in="colorMark" /><feMergeNode in="darkLetters" /></feMerge>
        </filter>
      </defs>
    </svg>
    <span className="labx-original"><img src={labx} alt="LabX by ZeAI" width="440" height="201" /></span>
    <span className="brand-divider" /><strong className="zeai-hash">#ZeAI</strong>
    <MadeInIndiaMark />
  </span>;
}
