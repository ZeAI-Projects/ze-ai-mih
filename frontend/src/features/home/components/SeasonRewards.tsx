import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '@/lib/miihApi';
import { Icon } from '@/components/ui/Icon';
const rewards = [
  ['Grand Winner', '₹10,00,000 cash award.', 'spark'],
  ['Domain winners', '₹5,000 domain-winner award.', 'code'],
  ['Malaysia awaits', 'Overall grand-winner team: a trip for three people.', 'globe'],
  ['Build with LabX', 'Collaboration opportunities to take your ideas further.', 'users'],
  ['Pitch to investors', 'An opportunity to present your idea and its potential.', 'spark'],
  ['Your next step', 'Internships and possible job opportunities.', 'users'],
  ['Learn from builders', 'Mentorship and meaningful connections.', 'users'],
] as const;
export function SeasonRewards() {
  const [blocks, setBlocks] = useState<Array<{block_key: string; title: string; body: string}>>([]);
  useEffect(() => { let active = true; const refresh = () => { void get<typeof blocks>('/public/editions/MIIH_UPCOMING/content').then(data => { if (active) setBlocks(data); }).catch(() => {}); }; refresh(); window.addEventListener('miih:data-updated', refresh); return () => { active = false; window.removeEventListener('miih:data-updated', refresh); }; }, []);
  return <section id="rewards" tabIndex={-1} className="section season-rewards" aria-labelledby="rewards-title"><div className="container"><p className="eyebrow">2027 · MORE TO BUILD TOWARDS</p><h2 id="rewards-title" className="section-heading">Big ambition.<br /><span>₹20 lakh prize pool.</span></h2><p className="section-copy">Rewards for outstanding work. Opportunities to keep growing.</p><div className="rewards-grid">{rewards.map(([title, body, icon], i) => { const content = blocks.find(b => b.block_key === `REWARD_2027_${i+1}`); return <article key={title} className="reward-card"><Icon name={icon} /><h3>{content?.title || title}</h3><p>{content?.body || body}</p></article>; })}</div><p className="reward-terms">Awards are subject to organiser rules and selection. Collaboration, pitches, internships and possible jobs are opportunities; participation does not guarantee an award or placement. The completed 2026 prize pool was ₹10 lakh.</p><Link className="button button-primary" to="/#register">Enter the 2027 challenge →</Link></div></section>;
}
