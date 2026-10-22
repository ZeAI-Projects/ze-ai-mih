import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, type Domain } from '@/lib/miihApi';
type Track = { id: string; code: string; name: string; description: string };
type Challenge = { id: string; title: string; summary: string; domain_name: string; track_name: string; difficulty: string };
type Result = { items: Challenge[]; total: number };
function domainGlyph(name: string) {
  const n = name.toLowerCase();
  if (/health|medic|bio/.test(n)) return '✚';
  if (/agri|food|rural/.test(n)) return '♧';
  if (/financ|commerce/.test(n)) return '₹';
  if (/educ|learn/.test(n)) return '▤';
  if (/energy|climat|sustain/.test(n)) return '☀';
  if (/cyber|secur/.test(n)) return '◇';
  if (/robot|hardware|iot/.test(n)) return '⚙';
  if (/space|transport|mobil/.test(n)) return '↗';
  return '⌘';
}
function ChallengeCard({ item }: { item: Challenge }) {
  const [detail, setDetail] = useState<{ description: string; expected_outcome: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return <article className="challenge-card"><span className="eyebrow">{item.domain_name}</span><h3>{item.title}</h3><p>{item.summary}</p><small>{item.track_name}{item.difficulty && ` · ${item.difficulty}`}</small>
    <details onToggle={async e => { if (!e.currentTarget.open || detail || loading) return; setLoading(true); setError(''); try { setDetail(await api(`/public/problem-statements/${item.id}`)); } catch { setError('Details are unavailable. Close and reopen to retry.'); } finally { setLoading(false); } }}><summary>Explore challenge</summary>{loading && <p role="status">Loading details…</p>}{error && <p role="alert">{error}</p>}{detail && <><p>{detail.description}</p>{detail.expected_outcome && <p><strong>Expected outcome</strong><br />{detail.expected_outcome}</p>}</>}</details>
  </article>;
}
export function Challenges() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [track, setTrack] = useState('RISING_BUILDERS');
  const [domain, setDomain] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const query = new URLSearchParams({ edition_code: 'MIIH_UPCOMING', track_code: track, page: String(page), page_size: '6' });
    if (domain) query.set('domain_id', domain);
    const timer = window.setTimeout(() => {
      Promise.allSettled([api<Track[]>('/public/problem-statement-tracks', { signal: controller.signal }), api<Domain[]>('/public/challenge-domains', { signal: controller.signal }), api<Result>(`/public/problem-statements?${query}`, { signal: controller.signal })])
        .then(([t, d, r]) => {
          if (controller.signal.aborted) return;
          if (t.status === 'fulfilled' && Array.isArray(t.value)) setTracks(t.value);
          if (d.status === 'fulfilled' && Array.isArray(d.value)) setDomains(d.value);
          if (r.status === 'fulfilled' && Array.isArray(r.value.items) && typeof r.value.total === 'number') setResult(r.value);
          const failed = [r, d, t].find(item => item.status === 'rejected');
          if (failed?.status === 'rejected') {
            const e = failed.reason;
            setError(e instanceof ApiError && e.status === 0 ? 'We couldn’t connect to the challenge service. Check your connection and try again.' : e instanceof ApiError && e.status === 503 && e.message.includes('not configured') ? 'The challenge catalogue is being prepared. The enabled domains are available below; published challenges will follow.' : 'The challenge service is temporarily unavailable. Please try again.');
          } else if (r.status !== 'fulfilled' || !Array.isArray(r.value.items)) setError('The challenge service returned an unexpected response. Please try again.');
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [track, domain, page, retry]);
  return <section id="challenges" tabIndex={-1} className="section domain-section" aria-labelledby="domains-title"><div className="container">
    <p className="eyebrow">CHOOSE YOUR PLAYING FIELD</p><h2 id="domains-title" className="section-heading">Find your niche<br /><span>aka problem statement.</span></h2>
    <p className="section-copy">Pick your track, then explore the domains enabled for this edition.</p>
    <div className="track-controls" aria-label="Audience track">{[
      ['RISING_BUILDERS', 'Rising Builders', 'School students through 1st-year college'],
      ['NEXT_LEVEL_BUILDERS', 'Next-Level Builders', '2nd-year college through startup teams and founders'],
    ].map(([code, name, description]) => <button type="button" key={code} aria-pressed={track === code} onClick={() => { setTrack(code); setPage(1); }}><strong>{tracks.find(t => t.code === code)?.name || name}</strong><span>{description}</span></button>)}</div>
    <div className="challenge-domains" aria-label="Domain filter"><button type="button" aria-pressed={!domain} onClick={() => { setDomain(''); setPage(1); }}><span className="domain-glyph" aria-hidden="true">✦</span>All enabled domains</button>{domains.map(d => <button type="button" key={d.id} aria-pressed={domain === d.id} onClick={() => { setDomain(d.id); setPage(1); }}><span className="domain-glyph" aria-hidden="true">{domainGlyph(d.domain_name)}</span>{d.domain_name}</button>)}</div>
    <div aria-live="polite" aria-busy={loading}>{loading ? <p>Loading challenges…</p> : error ? <div className="challenge-empty" role="alert"><h3>Challenge catalogue</h3><p>{error}</p><button type="button" onClick={() => setRetry(v => v+1)}>Retry</button></div> : result.items.length ? <div className="challenge-grid">{result.items.map(item => <ChallengeCard key={item.id} item={item} />)}</div> : <div className="challenge-empty"><h3>CHALLENGES UNLOCKING SOON</h3><p>Published challenges for this track and domain will appear here.</p></div>}</div>
    {!loading && !error && result.total > 6 && <div className="challenge-pagination"><button type="button" disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous</button><span>Page {page} of {Math.ceil(result.total/6)}</span><button type="button" disabled={page*6 >= result.total} onClick={() => setPage(p => p+1)}>Next</button></div>}
    <Link className="button button-primary" to="/#register">Choose your challenge &amp; register →</Link>
  </div></section>;
}
