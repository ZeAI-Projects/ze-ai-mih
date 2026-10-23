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
    <span className="labx-original"><img src={labx} alt="LabX by ZeAI" width="440" height="201" /></span>
    <span className="brand-divider" /><strong className="zeai-hash">#ZeAI</strong>
    <MadeInIndiaMark />
  </span>;
}
