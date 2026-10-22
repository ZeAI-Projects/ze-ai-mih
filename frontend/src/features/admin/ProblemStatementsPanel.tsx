import { useState, type FormEvent } from 'react';
import { api, post, put, type Domain } from '@/lib/miihApi';
import { Panel, useAdmin, useResource, ErrorMessage } from './AdminPortal';
import { adminConfirm } from './AdminDialogs';
type Track = { id: string; name: string };
type Statement = { id?: string; edition_id: string; domain_id: string; track_id: string; statement_code: string; title: string; summary: string; description: string; expected_outcome: string; difficulty: string; display_order: number; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' };
export function ProblemStatementsPanel({ editionId }: { editionId: string }) {
  const { can, superAdmin, notify } = useAdmin();
  const [page, setPage] = useState(1);
  const rows = useResource<Statement[]>(editionId ? `/admin/problem-statements?edition_id=${editionId}&page=${page}` : null, []);
  const domains = useResource<Domain[]>(editionId ? `/admin/editions/${editionId}/domains` : null, []);
  const tracks = useResource<Track[]>('/public/problem-statement-tracks', []);
  const blank = (): Statement => ({ edition_id: editionId, domain_id: '', track_id: '', statement_code: '', title: '', summary: '', description: '', expected_outcome: '', difficulty: '', display_order: 0, status: 'DRAFT' });
  const [draft, setDraft] = useState<Statement>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editable = can('EVENT_EDIT') && (draft.status !== 'PUBLISHED' || superAdmin);
  function edit(row: Statement) { const value = blank(); for (const key of Object.keys(value) as Array<keyof Statement>) Object.assign(value, { [key]: row[key] ?? value[key] }); setDraft({ ...value, id: row.id }); setError(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const { id, ...body } = draft;
    try { if (id) await put(`/admin/problem-statements/${id}`, body, true); else await post('/admin/problem-statements', body, true); rows.reload(); setDraft(blank()); notify('Challenge saved.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save challenge.'); } finally { setBusy(false); }
  }
  async function remove(row: Statement) {
    if (!await adminConfirm(`Delete challenge “${row.title}”?`, 'Delete challenge', true)) return;
    setBusy(true); setError('');
    try { await api(`/admin/problem-statements/${row.id}`, { method: 'DELETE' }, true); rows.reload(); if (draft.id === row.id) setDraft(blank()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete.'); } finally { setBusy(false); }
  }
  return <Panel title="Problem statements"><p className="miih-muted-admin">Event editors can author drafts. Super Admin publishes, edits published challenges, or deletes. Only published challenges in active tracks and enabled domains appear publicly.</p>
    <ErrorMessage message={rows.error || tracks.error || domains.error || error} />
    {rows.loading ? <p>Loading challenges…</p> : rows.data.length ? <div>{rows.data.map(row => <div className="miih-admin-row" key={row.id}><button type="button" className="miih-admin-outline" onClick={() => edit(row)}>{row.title} · {row.status}</button>{superAdmin && <button type="button" disabled={busy} onClick={() => void remove(row)}>Delete</button>}</div>)}</div> : <p>No challenges on this page.</p>}
    <div className="miih-admin-row"><button type="button" disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous</button><span>Page {page}</span><button type="button" disabled={rows.data.length < 50} onClick={() => setPage(p => p+1)}>Next</button></div>
    {can('EVENT_EDIT') && <form onSubmit={save}><fieldset disabled={busy || !editable || !editionId}><legend>{draft.id ? 'Edit challenge' : 'New challenge'}</legend><div className="miih-admin-form-grid">
      <label>Track<select required value={draft.track_id} onChange={e => setDraft({ ...draft, track_id: e.target.value })}><option value="">Choose track</option>{tracks.data.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Domain<select required value={draft.domain_id} onChange={e => setDraft({ ...draft, domain_id: e.target.value })}><option value="">Choose enabled domain</option>{domains.data.filter(d => d.is_enabled !== false).map(d => <option key={d.id} value={d.id}>{d.domain_name}</option>)}</select></label>
      {(['statement_code', 'title', 'difficulty'] as const).map(key => <label key={key}>{key.replace(/_/g, ' ')}<input required={key !== 'difficulty'} maxLength={key === 'title' ? 200 : key === 'difficulty' ? 40 : 64} pattern={key === 'statement_code' ? '[A-Z][A-Z0-9_]{0,63}' : undefined} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
      {(['summary', 'description', 'expected_outcome'] as const).map(key => <label key={key}>{key.replace(/_/g, ' ')}<textarea maxLength={key === 'summary' ? 1000 : key === 'description' ? 16000 : 4000} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
      <label>Display order<input type="number" min="0" max="100000" value={draft.display_order} onChange={e => setDraft({ ...draft, display_order: Number(e.target.value) })} /></label>
      <label>Status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Statement['status'] })}><option>DRAFT</option>{superAdmin && <option>PUBLISHED</option>}<option>ARCHIVED</option></select></label>
    </div><button className="miih-admin-primary" type="submit">{busy ? 'Saving…' : 'Save challenge'}</button></fieldset><button className="miih-admin-outline" type="button" onClick={() => { setDraft(blank()); setError(''); }}>New / clear editor</button></form>}
  </Panel>;
}
