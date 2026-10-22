import logo from '@/assets/images/header-brand.webp';
import labx from '@/assets/images/labx-header.webp';

export function ZeaiMark() {
  return <span className="zeai-crop"><img src={logo} alt="ZeAI Soft" width="2170" height="725" /></span>;
}

export function HeaderBrand() {
  return <span className="season-brand"><ZeaiMark /><span className="brand-divider" />
    <span className="labx-original"><img src={labx} alt="LabX by ZeAI" width="440" height="201" /></span>
    <span className="brand-divider" /><strong className="zeai-hash">#ZeAI</strong>
    <span className="india-crop"><img src={logo} alt="#MadeInIndia" width="2170" height="725" /></span>
  </span>;
}
