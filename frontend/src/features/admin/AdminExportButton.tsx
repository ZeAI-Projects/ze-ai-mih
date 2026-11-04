import { useEffect, useState } from 'react';
import { apiResponse, get, type Domain } from '@/lib/miihApi';
import { useAdmin } from './AdminPortal';
import { ThemedDateTime } from './ThemedDateTime';

const columns: Record<string, string[]> = {
  TEAMS: ['team_id','registration_code','team_name','edition_code','domain_name','status','members','investor_pitch_interest','created_at','submitted_at','leader_name','leader_email','leader_mobile','all_member_names','all_member_emails','all_member_phones'],
  MEMBERS: ['team_id','registration_code','team_name','member_order','role','full_name','email','mobile','photo_filename','photo_file_id','domain_name','status','created_at','submitted_at'],
  PAYMENTS: ['team_id','registration_code','team_name','transaction_id','claimed_amount','currency','status','proof_filename','proof_file_id','submitted_at','verified_at','rejection_reason'],
  ANSWERS: ['team_id','registration_code','team_name','member_order','member_name','member_email','field_key','question_label','answer_scope','answer','answer_filename','file_asset_id'],
  STATISTICS: ['domain_name','registered_teams','registered_participants','edition_code'],
  EDITION_HISTORY: ['edition_code','title','year','status','starts_at','ends_at','location','registered_teams'],
};
type Props = { datasets: string[]; defaultStatus?: string; label?: string };
export function AdminExportButton({ datasets, defaultStatus = '', label = 'Export sheet' }: Props) {
  const { can, superAdmin } = useAdmin();
  const [open, setOpen] = useState(false);
  const [dataset, setDataset] = useState(datasets[0]);
  const [format, setFormat] = useState('XLSX');
  const [selected, setSelected] = useState<string[]>(columns[datasets[0]] || []);
  const [status, setStatus] = useState(defaultStatus);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [edition, setEdition] = useState(''); const [domain, setDomain] = useState('');
  const [editions, setEditions] = useState<{id:string;title:string}[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [busy, setBusy] = useState(false);const [error,setError] = useState('');const [success,setSuccess]=useState('');
  useEffect(()=>{if(open)setStatus(defaultStatus);},[open,defaultStatus]);
  const available = datasets.filter(x => x !== 'PAYMENTS' || superAdmin);
  useEffect(() => {
    if(!open) return;
    void get<{id:string;title:string}[]>('/admin/editions',true).then(setEditions).catch(()=>{});
    const close = (e:KeyboardEvent) => { if(e.key==='Escape') setOpen(false); };
    window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);
  },[open]);
  useEffect(()=>{if(!open||!edition){setDomains([]);return;}void get<Domain[]>(`/admin/editions/${edition}/domains`,true).then(setDomains).catch(()=>setDomains([]));},[edition,open]);
  if (!can('EXPORT_CREATE') || !available.length) return null;
  async function generate(){setError('');setSuccess('');setBusy(true);
    try {
      if(from && to && from>to) throw new Error('The start date must be before the end date.');
      const response=await apiResponse('/admin/exports/direct-download',{
        method:'POST',
        body:JSON.stringify({
          dataset,file_format:format,columns:selected,edition_id:edition||null,domain_id:domain||null,status:status||null,
          date_from:from ? `${from}T00:00:00+05:30` : null,date_to:to ? `${to}T23:59:59+05:30`:null,
        }),
      },true);
      if(!response.ok){
        const problem=await response.json().catch(()=>({detail:'Report unavailable'}));
        const detail=problem.detail;
        throw new Error(typeof detail==='string'?detail:typeof detail?.message==='string'?detail.message:`Export failed (HTTP ${response.status})`);
      }
      const blob=await response.blob();
      const tempUrl=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=tempUrl;link.download=`miih_${dataset.toLowerCase()}_${new Date().toISOString().slice(0,10)}.${format.toLowerCase()}`;
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(tempUrl),1000);
      setSuccess(`Downloaded ${response.headers.get('X-Export-Row-Count')||'the selected'} rows.`);
    }catch(e){setError(e instanceof Error?e.message:'Could not generate report');}finally{setBusy(false);}
  }
  return <><button type="button" className="miih-admin-primary" onClick={()=>{setOpen(true);setError('');setSuccess('');}}><span aria-hidden="true">⇩</span> {label}</button>
    {open&&<div className="miih-export-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="export-heading" className="miih-export-dialog">
      <div className="miih-export-title"><div><span className="miih-kicker">FILTER & DOWNLOAD</span><h2 id="export-heading">Create your export</h2><p>Teams and Members exports include personal details and recorded registration answers. Excel organizes them into sheets; CSV places answers in additional columns.</p></div><button type="button" aria-label="Close export" onClick={()=>setOpen(false)}>×</button></div>
      <div className="miih-admin-form-grid"><label>Data to export<select value={dataset} onChange={e=>{setDataset(e.target.value);setSelected(columns[e.target.value]||[]);setStatus('');if(format==='JSON'&&e.target.value!=='TEAMS')setFormat('XLSX');}}>{available.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
        <label>File format<select value={format} onChange={e=>setFormat(e.target.value)}><option value="XLSX">Excel (.xlsx)</option><option value="CSV">CSV (.csv)</option>{dataset==='TEAMS'&&<option value="JSON">JSON (.json) – all member details</option>}</select></label>
        <label>Event<select value={edition} onChange={e=>{setEdition(e.target.value);setDomain('');}}><option value="">All events</option>{editions.map(x=><option value={x.id} key={x.id}>{x.title}</option>)}</select></label>
        <label>Registration status<input value={status} onChange={e=>setStatus(e.target.value.toUpperCase())} placeholder={['TEAMS','MEMBERS','ANSWERS','STATISTICS'].includes(dataset)?'All submitted statuses':'All statuses'} list="miih-export-statuses"/><datalist id="miih-export-statuses">{['DRAFT','SUBMITTED','REVIEW','APPROVED','REJECTED','VERIFIED','PENDING'].map(v=><option key={v} value={v}/>)}</datalist></label>
        <label>From date<ThemedDateTime value={from} onChange={setFrom}/></label><label>To date<ThemedDateTime value={to} onChange={setTo}/></label>
        {edition&&<label className="miih-admin-wide">Domain<select value={domain} onChange={e=>setDomain(e.target.value)}><option value="">All domains</option>{domains.map(d=><option key={d.id} value={d.id}>{d.domain_name}</option>)}</select></label>}</div>
      <div className="miih-export-choose"><div className="miih-export-choose-head"><b>Columns ({selected.length}/{(columns[dataset]||[]).length})</b><button type="button" onClick={()=>setSelected(columns[dataset]||[])}>Select all</button></div><div className="miih-export-grid">{(columns[dataset]||[]).map(c=><label key={c}><input type="checkbox" checked={selected.includes(c)} onChange={e=>setSelected(s=>e.target.checked?[...s,c]:s.filter(v=>v!==c))}/>{c.replaceAll('_',' ')}</label>)}</div></div>
      {error&&<div className="miih-admin-error" role="alert">{error}</div>}{success&&<div className="miih-admin-good" role="status">{success}</div>}
      <footer className="miih-export-actions"><button className="miih-admin-outline" type="button" onClick={()=>setOpen(false)}>Close</button><button className="miih-admin-primary" type="button" disabled={busy||!selected.length} onClick={()=>void generate()}>{busy?'Preparing report…':'Generate & download'}</button></footer>
    </section></div>}
  </>;
}
