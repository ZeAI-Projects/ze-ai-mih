import { DashboardInsights } from '../DashboardInsights';
import { AdminExportButton } from '../AdminExportButton';
import { AdminVisualExportButton } from '../AdminVisualExportButton';
import { adminConfirm, adminPrompt } from '../AdminDialogs';
import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { patch, post, qs } from '@/lib/miihApi';
import {Badge,DataTable,Empty,ErrorMessage,formatDate,formatMoney,Loading,PageHeader,Panel,useAdmin,useResource} from '../AdminPortal';

const statusOptions=['','DRAFT','SUBMITTED','REVIEW','APPROVED','REJECTED'];
const exportFields:Record<string,string[]>={TEAMS:['team_id','registration_code','team_name','source_team_id','edition_code','domain_name','status','members','participant_category','investor_pitch_interest','created_at','submitted_at'],MEMBERS:['registration_code','team_name','member_order','role','full_name','email','mobile','domain_name','status','created_at'],PAYMENTS:['registration_code','team_name','transaction_id','claimed_amount','currency','status','submitted_at','verified_at','rejection_reason'],ANSWERS:['registration_code','team_name','member_order','field_key','question_label','answer_scope','answer','file_asset_id','domain_name','status']};
type Row = Record<string,unknown>;
const str=(v:unknown)=>String(v??'');
function FilterBar({search,onSearch,status,onStatus,extra,submittedOnly=false}:{submittedOnly?:boolean;search?:string;onSearch?:(s:string)=>void;status?:string;onStatus?:(s:string)=>void;extra?:ReactNode}){return <div className="miih-filter-bar">{onSearch&&<input aria-label="Search records" placeholder="Search name, team or code..." value={search||''} onChange={e=>onSearch(e.target.value)}/ >}{onStatus&&<select aria-label="Filter by status" value={status||''} onChange={e=>onStatus(e.target.value)}>{(submittedOnly?['','PENDING_APPROVAL','SUBMITTED','REVIEW','APPROVED','REJECTED','DRAFT']:statusOptions).map(s=><option key={s} value={s}>{submittedOnly?(s==='PENDING_APPROVAL'?'Awaiting approval':s||'All submitted'):(s||'All statuses')}</option>)}</select>}{extra}</div>}
function StatCard({name,value,foot}:{name:string;value:ReactNode;foot:string}){return <div className="miih-stat-card"><small>{name}</small><strong>{value}</strong><span>{foot}</span></div>}
type PendingTeam = {
  id:string;
  team_name?:string;
  registration_code?:string;
  status:string;
  domain_name?:string;
  submitted_at?:string;
  payment_verified?:boolean;
};
type DashboardOverview = {
  registered_teams?:number;
  participants?:number;
  verified_revenue?:number;
  pending_approvals?:number;
  pending_teams?:PendingTeam[];
};
export function DashboardPage(){
  const {superAdmin,can}=useAdmin();
  const {data,loading,error}=useResource<DashboardOverview>('/admin/dashboard',{});
  const queue=data.pending_teams||[];
  return <>
    <PageHeader eyebrow="OVERVIEW" title="Dashboard" description="Registration activity, teams awaiting review and verified payments." actions={<AdminVisualExportButton targetId="miih-dashboard-export" title="Dashboard summary" description="Admin dashboard summary with operational cards, approval queue and live insights." label="Export dashboard PDF" />}/>
    {error&&<ErrorMessage message={error}/>}
    {loading?<Loading/>:<div id="miih-dashboard-export">{error?<Panel title="Dashboard is temporarily unavailable"><p className="miih-muted-admin">Live counts will appear when the API is available.</p></Panel>:<>
      <div className="miih-stat-grid">
        <StatCard name="Registered Teams" value={str(data.registered_teams||0)} foot="Submitted registrations"/>
        <StatCard name="Total Participants" value={str(data.participants||0)} foot="Members of submitted teams"/>
        {superAdmin&&<StatCard name="Verified Revenue" value={formatMoney(data.verified_revenue)} foot="Approved teams · verified payments minus refunds"/>}
        <div className="miih-stat-card miih-pending-summary" aria-label="Pending team approvals">
          <small>Pending Team Approvals</small>
          <strong>{str(data.pending_approvals||0)}</strong>
          <span>Submitted teams awaiting an admin decision</span>
          {can('TEAMS_VIEW')&&<a className="miih-pending-link" href="/admin/teams?status=PENDING_APPROVAL">Review submissions →</a>}
        </div>
      </div>
      <Panel title="Teams awaiting approval" toolbar={can('TEAMS_VIEW')?<a className="miih-admin-outline" href="/admin/teams?status=PENDING_APPROVAL">Open Teams →</a>:undefined}>
        {queue.length? <div className="miih-pending-queue">{queue.map(team=><div className="miih-pending-team" key={team.id}>
          <div className="miih-pending-team-name"><strong>{team.team_name||'Unnamed team'}</strong><small>{team.registration_code||'—'} · {team.domain_name||'Domain not specified'}</small></div>
          <span className="miih-pending-payment">{team.payment_verified?'✓ Payment verified':'Payment not verified'}</span>
          <Badge value={team.status}/>
          {can('TEAMS_VIEW')&&<a href={`/admin/teams?status=PENDING_APPROVAL&team=${encodeURIComponent(team.id)}`} className="miih-admin-outline">Review →</a>}
        </div>)}</div> : <Empty message="No submitted teams are waiting for an approval decision."/>}
        {(data.pending_approvals||0)>queue.length&&<p className="miih-muted-admin">Showing the next {queue.length} teams. Open Teams to see the full queue.</p>}
      </Panel>
      <div className="miih-admin-grid2">
        <Panel title="Quick actions"><div className="miih-quick-links"><a href="/admin/teams">Manage teams →</a>{can('FORM_VIEW')&&<a href="/admin/form">Manage registration form →</a>}{can('SITE_PREVIEW')&&<a href="/admin/studio">Manage website media →</a>}{superAdmin&&<a href="/admin/admins">Manage administrator access →</a>}</div></Panel>
        <Panel title="Workspace overview"><p className="miih-muted-admin">Team reviews, registrations, exports and event settings are available from the sidebar according to each administrator's permissions.</p></Panel>
      </div>
      <DashboardInsights/>
    </>}</div>}
  </>;
}
export function TeamsPage(){const [params,setParams]=useSearchParams();const [search,setSearch]=useState('');const [status,setStatus]=useState(params.get('status')||'');const [domainId,setDomainId]=useState('');const [selected,setSelected]=useState<Row|null>(null);
  const {can,notify}=useAdmin();const {data,loading,error,reload}=useResource<Row[]>(`/admin/teams${qs({search,status,domain_id:domainId,limit:500})}`,[]);
  useEffect(()=>{const id=params.get('team');if(id&&data.length){const found=data.find(team=>String(team.id)===id);if(found)setSelected(found);}},[data,params]);
  const editions=useResource<{id:string}[]>('/admin/editions',[]);const domains=useResource<{id:string;domain_name:string}[]>(editions.data[0]?.id?`/admin/editions/${editions.data[0].id}/domains`:null,[]);
  const detail=useResource<Row>(selected?`/admin/teams/${selected.id}`:null,{});const {superAdmin}=useAdmin();const payment=useResource<Row[]>(superAdmin&&selected?`/admin/teams/${selected.id}/payments`:null,[]);
  async function review(value:'APPROVED'|'REJECTED'|'REVIEW'){if(!selected)return;const reason=value==='REJECTED'?await adminPrompt('Reason for rejecting this registration', '', true):null;if(value==='REJECTED'&&!reason)return;if(!await adminConfirm(`Mark this registration ${value.toLowerCase()}?`,'Review team registration',value==='REJECTED'))return;try{await patch(`/admin/teams/${selected.id}/review`,{status:value,reason},true);notify('Team status updated');reload();setSelected(null);}catch(e){notify(e instanceof Error?e.message:'Review failed');}}
  async function verifyTeamPayment(record:Row,newStatus:'VERIFIED'|'REJECTED'){
    if(!selected||String(selected.status)==='DRAFT')return;
    const reason=newStatus==='REJECTED'?await adminPrompt('Reason for rejecting this payment', '', true):null;
    if(newStatus==='REJECTED'&&!reason)return;
    if(!await adminConfirm(`${newStatus==='VERIFIED'?'Verify':'Reject'} this team's payment evidence?`, 'Payment review',newStatus==='REJECTED'))return;
    try{await patch(`/admin/revenue/payments/${record.id}`,{status:newStatus,rejection_reason:reason},true);payment.reload();notify('Payment verification saved. You can now approve the team.');}
    catch(e){notify(e instanceof Error?e.message:'Payment review failed');}
  }
  return <><PageHeader eyebrow="OPERATIONS / TEAMS" title="Registered Teams" description="Filter teams, review registrations and export exactly the records you need." actions={<AdminExportButton datasets={['TEAMS','ANSWERS']} defaultStatus={status}/>}/>
    <Panel toolbar={<FilterBar search={search} onSearch={setSearch} submittedOnly status={status} onStatus={next=>{setStatus(next);setParams(next?{status:next}:{})}} extra={<select aria-label="Filter domain" value={domainId} onChange={e=>setDomainId(e.target.value)}><option value="">All domains</option>{domains.data.map(d=><option key={d.id} value={d.id}>{d.domain_name}</option>)}</select>}/>}>
      <ErrorMessage message={error}/>{loading?<Loading/>:<DataTable rows={data} onSelect={setSelected} columns={[{key:'team_id',label:'Team ID'},{key:'registration_code',label:'Registration reference'},{key:'team_name',label:'Team'},{key:'domain_name',label:'Domain'},{key:'edition',label:'Edition'},{key:'member_count',label:'Members'},{key:'status',label:'Status',render:v=><Badge value={v}/>},{key:'submitted_at',label:'Submitted',render:formatDate}]}/>}</Panel>
    {selected&&<div className="miih-admin-drawer-backdrop" onClick={()=>setSelected(null)}><aside className="miih-admin-drawer" onClick={e=>e.stopPropagation()}><header><h2>Team details</h2><button onClick={()=>setSelected(null)} aria-label="Close">×</button></header>{detail.loading?<Loading/>:<><h3>{str(detail.data.team_name||selected.team_name)}</h3><p>Registration: {str(detail.data.registration_code||selected.registration_code)}</p><Badge value={detail.data.status||selected.status}/><h4>Team members</h4>{Array.isArray(detail.data.members)&&(detail.data.members as Row[]).map(m=><div className="miih-detail-card" key={str(m.id)}><strong>{str(m.full_name)}</strong><small>{str(m.role)} • {str(m.email)}</small><small>{str(m.mobile)}</small></div>)}{detail.data.private_data_hidden&&<p>Member details are restricted.</p>}<h4>Submitted answers</h4>{Array.isArray(detail.data.answers)&&(detail.data.answers as Row[]).map((a,i)=><div className="miih-answer-detail" key={i}><strong>{str(a.question_label)}</strong><span>{str(a.answer_json)}</span></div>)}{superAdmin&&String(detail.data.status||selected.status)!=='DRAFT'&&<><h4>Payment evidence</h4>{payment.data.map(p=><div key={str(p.id)} className="miih-detail-card"><strong>Transaction: {str(p.transaction_id)}</strong><small>{formatMoney(p.claimed_amount)} · {str(p.status)}</small>{Boolean(p.proof_file_id)&&<PaymentProof id={str(p.proof_file_id)}/>}{p.status==='PENDING'&&<div className="miih-admin-row"><button type="button" onClick={()=>void verifyTeamPayment(p,'VERIFIED')}>Verify payment</button><button type="button" onClick={()=>void verifyTeamPayment(p,'REJECTED')}>Reject proof</button></div>}</div>)}</>}
 {can('REGISTRATION_REVIEW')&&['SUBMITTED','REVIEW'].includes(str(detail.data.status||selected.status))&&<div className="miih-admin-row"><button type="button" onClick={()=>review('APPROVED')}>Approve team</button><button type="button" onClick={()=>review('REVIEW')}>Mark review</button><button type="button" onClick={()=>review('REJECTED')}>Reject team</button></div>}
 {String(detail.data.status||selected.status)==='DRAFT'&&<p className="miih-muted-admin">Draft registration – no approval actions until the Team Leader submits.</p>}</>}</aside></div>}
  </>}
export function ParticipantsPage(){const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [selected,setSelected]=useState<Row|null>(null);const {data,error,loading}=useResource<Row[]>(`/admin/participants${qs({search,status,limit:500})}`,[]);const detail=useResource<Row>(selected?`/admin/participants/${selected.id}`:null,{});return <><PageHeader eyebrow="OPERATIONS / PEOPLE" title="Participants" description="Search registered participants, review their teams and export filtered data." actions={<AdminExportButton datasets={['MEMBERS','ANSWERS']} defaultStatus={status}/>}/><Panel toolbar={<FilterBar search={search} onSearch={setSearch} status={status} onStatus={setStatus}/>}><ErrorMessage message={error}/>{loading?<Loading/>:<DataTable rows={data} onSelect={setSelected} columns={[{key:'full_name',label:'Participant'},{key:'role',label:'Team role'},{key:'team_name',label:'Team'},{key:'email',label:'Email'},{key:'mobile',label:'Phone'},{key:'status',label:'Status',render:v=><Badge value={v}/>}]}/>}</Panel>{selected&&<div className="miih-admin-drawer-backdrop" onClick={()=>setSelected(null)}><aside className="miih-admin-drawer" onClick={e=>e.stopPropagation()}><header><h2>Participant profile</h2><button onClick={()=>setSelected(null)}>×</button></header>{detail.loading?<Loading/>:<div>{Object.entries(detail.data).map(([k,v])=><p key={k}><b>{k.replace(/_/g,' ')}</b> : {str(v)}</p>)}</div>}</aside></div>}</>}
export function RevenuePage(){const {superAdmin}=useAdmin();const [status,setStatus]=useState('');const [selected,setSelected]=useState<Row|null>(null);const {data,error,loading}=useResource<Row[]>(`/admin/revenue${qs({status,limit:500})}`,[]);
  return <><PageHeader eyebrow="FINANCE / PAYMENT VERIFICATION" title="Revenue" description="Approved teams with verified payments only. Review pending payment evidence under Teams." actions={<AdminExportButton datasets={['PAYMENTS']} defaultStatus={status}/>}/>{!superAdmin?<ErrorMessage message="Only Super Admin can access payment records."/>:<Panel toolbar={<FilterBar status={status} onStatus={setStatus}/>}><ErrorMessage message={error}/>{loading?<Loading/>:<DataTable rows={data} onSelect={setSelected} columns={[{key:'registration_code',label:'Registration'},{key:'team_name',label:'Team'},{key:'transaction_id',label:'Transaction ID'},{key:'claimed_amount',label:'Claimed',render:formatMoney},{key:'refunded',label:'Refunded',render:formatMoney},{key:'status',label:'Verification',render:v=><Badge value={v}/>},{key:'submitted_at',label:'Submitted',render:formatDate}]}/>}</Panel>}{selected&&<div className="miih-admin-drawer-backdrop" onClick={()=>setSelected(null)}><aside className="miih-admin-drawer" onClick={e=>e.stopPropagation()}><header><h2>Payment verification</h2><button onClick={()=>setSelected(null)}>×</button></header><p>{str(selected.team_name)} • {str(selected.transaction_id)}</p><p>Amount: {formatMoney(selected.claimed_amount)}</p><p>Status: <Badge value={selected.status}/></p>{Boolean(selected.proof_file_id)&&<PaymentProof id={str(selected.proof_file_id)}/> }</aside></div>}</>}
function PaymentProof({id}:{id:string}){const {data,error}=useResource<{url:string}>(`/admin/files/${id}/signed-url`,{url:''});return <>{error?<ErrorMessage message={error}/>:data.url?<a href={data.url} rel="noopener noreferrer" target="_blank">Open private payment screenshot ↗</a>:<Loading message="Loading private proof…"/>}</>}
export function StatisticsPage(){const {data,loading,error}=useResource<{by_domain:Row[];by_status:Row[];by_day:Row[]}>('/admin/statistics',{by_domain:[],by_status:[],by_day:[]});const max=Math.max(1,...data.by_domain.map(d=>Number(d.registered_teams)||0));return <><PageHeader eyebrow="ANALYTICS / INSIGHTS" title="Statistics" description="Explore registrations by domain, approval status and date." actions={<AdminVisualExportButton targetId="miih-statistics-export" title="Statistics report" description="Registration charts and tallies grouped by domain, approval status and submission day." label="Export statistics PDF" />}/><ErrorMessage message={error}/>{loading?<Loading/>:<div id="miih-statistics-export" className="miih-admin-grid2"><Panel title="Teams by Domain">{data.by_domain.map((r,i)=><div className="miih-chart-row" key={i}><span>{str(r.domain_name)}</span><div><i style={{width:`${Number(r.registered_teams||0)/max*100}%`}}/></div><b>{str(r.registered_teams)}</b></div>)}{!data.by_domain.length&&<Empty/>}</Panel><Panel title="Registration Status">{data.by_status.map((r,i)=><div className="miih-tally-row" key={i}><Badge value={r.status}/><strong>{str(r.teams)}</strong></div>)}{!data.by_status.length&&<Empty/>}<h3>Submissions by day</h3>{data.by_day.map((r,i)=><div key={i} className="miih-tally-row"><span>{formatDate(r.day)}</span><b>{str(r.teams)}</b></div>)}</Panel></div>}</>}
type AuditRecord = {
  action?:string;
  entity_table?:string;
  entity_id?:string;
  admin_name?:string;
  admin_email?:string;
  activity_at?:string;
  before_value?:unknown;
  after_value?:unknown;
};
const auditTitles:Record<string,string>={
  ADMIN_PERMISSION_CHANGED:'Administrator permissions updated',
  ADMIN_APPROVED:'Administrator access approved',
  ADMIN_REJECTED:'Administrator access rejected',
  ADMIN_ROLE_CHANGED:'Administrator role updated',
  TEAM_REVIEW:'Team registration reviewed',
  PAYMENT_REVIEW:'Payment evidence reviewed',
  EDITION_UPDATED:'Hackathon details updated',
  DOMAIN_UPDATED:'Hackathon domain updated',
  FORM_PUBLISHED:'Registration form published',
  SITE_CONTENT_PUBLISHED:'Website content published',
  MEDIA_PUBLISHED:'Website media published',
};
function humanLabel(value:string){return value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());}
function auditGroup(record:AuditRecord){
  const term=`${record.action||''} ${record.entity_table||''}`.toUpperCase();
  if(/ADMIN|PERMISSION|ROLE/.test(term))return 'Access';
  if(/PAYMENT|REFUND|REVENUE/.test(term))return 'Payments';
  if(/TEAM|REGISTRATION|PARTICIPANT/.test(term))return 'Teams';
  if(/SITE|MEDIA|CMS|FORM|DOMAIN|EDITION|EVENT|CONTENT/.test(term))return 'Website';
  return 'Other';
}
function auditMap(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function auditSafeValue(value:unknown,key:string){
  if(/password|secret|token|credential|authorization|api.?key/i.test(key))return '[hidden]';
  if(value===null||value===undefined)return '—';
  if(typeof value==='object')return JSON.stringify(value);
  return String(value);
}
function auditChanges(record:AuditRecord){
  const before=auditMap(record.before_value),after=auditMap(record.after_value);
  const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  return keys.map(key=>({key,old:auditSafeValue(before[key],key),next:auditSafeValue(after[key],key)}));
}
function auditTime(value?:string){
  if(!value)return 'Time not recorded';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(date)+' IST';
}
export function HistoryPage(){
  const {superAdmin}=useAdmin();
  const {data:records,error,loading,reload}=useResource<AuditRecord[]>(superAdmin?'/admin/audit-logs?limit=250':null,[]);
  const [search,setSearch]=useState('');
  const [group,setGroup]=useState('All');
  const filtered=records.filter(record=>{
    if(group!=='All'&&auditGroup(record)!==group)return false;
    const needle=search.toLowerCase().trim();
    if(!needle)return true;
    return [record.action,record.admin_name,record.admin_email,record.entity_table,record.entity_id].some(value=>String(value||'').toLowerCase().includes(needle));
  });
  return <>
    <PageHeader eyebrow="ADMIN ACTIVITY / ACCOUNTABILITY" title="Audit Log" description="A record of administrator actions, including who made each change, when it happened and the values recorded." actions={superAdmin?<button type="button" className="miih-admin-outline" onClick={reload}>↻ Refresh activity</button>:undefined}/>
    {!superAdmin?<Panel title="Audit log access"><p className="miih-muted-admin">Detailed administrator change history is restricted to the Super Admin.</p></Panel>:<Panel title="Activity timeline" toolbar={<span className="miih-audit-count">{filtered.length} of {records.length} recorded actions</span>}>
      <div className="miih-audit-filters"><label>Search activity<input aria-label="Search audit activity" placeholder="Admin, action or record…" value={search} onChange={event=>setSearch(event.target.value)}/></label><label>Category<select aria-label="Filter audit category" value={group} onChange={event=>setGroup(event.target.value)}>{['All','Teams','Payments','Access','Website','Other'].map(name=><option key={name}>{name}</option>)}</select></label></div>
      <ErrorMessage message={error}/>
      {loading?<Loading/>:error?null:filtered.length?<div className="miih-audit-timeline">{filtered.map((record,index)=>{
        const category=auditGroup(record);
        const changes=auditChanges(record);
        return <article className="miih-audit-event" key={`${record.entity_id||'entry'}-${record.activity_at||index}-${index}`}>
          <div className={`miih-audit-event-icon miih-audit-${category.toLowerCase()}`} aria-hidden="true">{category==='Payments'?'₹':category==='Access'?'♙':category==='Website'?'✦':category==='Teams'?'✓':'•'}</div>
          <div className="miih-audit-event-body"><div className="miih-audit-event-top"><div><span className="miih-audit-type">{category}</span><h3>{auditTitles[str(record.action)]||humanLabel(str(record.action)||'Admin activity')}</h3></div><time dateTime={record.activity_at||undefined}>{auditTime(record.activity_at)}</time></div>
            <p><strong>{record.admin_name||record.admin_email||'Unknown administrator'}</strong>{record.admin_name&&record.admin_email?` (${record.admin_email})`:''} changed <strong>{humanLabel(str(record.entity_table)||'a record')}</strong>.</p>
            {record.entity_id&&<small className="miih-audit-target">Record ID: {record.entity_id}</small>}
            {changes.length>0?<div className="miih-audit-diff">{changes.slice(0,3).map(change=><div key={change.key}><span>{humanLabel(change.key)}</span><del>{change.old}</del><strong>→ {change.next}</strong></div>)}{changes.length>3&&<small>+ {changes.length-3} more changed fields</small>}</div>:<p className="miih-muted-admin">No field-level values were recorded for this action.</p>}
            {changes.length>0&&<details className="miih-audit-more"><summary>View recorded changes</summary><div>{changes.map(change=><div key={change.key}><b>{humanLabel(change.key)}</b><span>Before: {change.old}</span><span>After: {change.next}</span></div>)}</div></details>}
          </div>
        </article>;
      })}</div>:<Empty message="No admin actions match these filters. Actions recorded in the database will appear here."/>}
      {records.length>=250&&<p className="miih-muted-admin">Showing up to 250 recent actions. Older records remain in the database.</p>}
    </Panel>}
  </>;
}
export function ExportsPage(){const {notify,superAdmin}=useAdmin();const [dataset,setDataset]=useState('TEAMS');const [fileFormat,setFileFormat]=useState('XLSX');const [status,setStatus]=useState('');const [dateFrom,setDateFrom]=useState('');const [dateTo,setDateTo]=useState('');const [busy,setBusy]=useState(false);const [selectedCols,setSelectedCols]=useState<string[]>(exportFields.TEAMS);const [domainId,setDomainId]=useState('');const editions=useResource<{id:string}[]>('/admin/editions',[]);const domains=useResource<{id:string;domain_name:string}[]>(editions.data[0]?.id?`/admin/editions/${editions.data[0].id}/domains`:null,[]);const {can}=useAdmin();const {data,error,reload}=useResource<Row[]>('/admin/exports/history',[]);async function exportNow(){setBusy(true);try{const result=await post<{download_url:string;row_count:number}>('/admin/exports',{dataset,file_format:fileFormat,status:status||null,domain_id:domainId||null,columns:selectedCols,date_from:dateFrom?new Date(dateFrom).toISOString():null,date_to:dateTo?new Date(dateTo+'T23:59:59').toISOString():null},true);if(result.download_url){window.open(result.download_url,'_blank','noopener,noreferrer');notify(`Export ready: ${result.row_count} rows.`);}reload();}catch(e){notify(e instanceof Error?e.message:'Export failed');}finally{setBusy(false);}}
  return <><PageHeader eyebrow="REPORTING / DOWNLOADS" title="Export Sheets" description="Filter each dataset and export clean XLSX or CSV reports. Excel headers are purple with frozen rows and AutoFilter."/><Panel title="Build your export"><div className="miih-admin-form-grid"><label>Dataset<select value={dataset} onChange={e=>{setDataset(e.target.value);setSelectedCols(exportFields[e.target.value]);}}>{['TEAMS','MEMBERS','ANSWERS',...(superAdmin?['PAYMENTS']:[])].map(k=><option key={k}>{k}</option>)}</select></label><label>Format<select value={fileFormat} onChange={e=>setFileFormat(e.target.value)}><option>XLSX</option><option>CSV</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statusOptions.map(s=><option key={s} value={s}>{s||'All statuses'}</option>)}</select></label><label>Domain<select value={domainId} onChange={e=>setDomainId(e.target.value)}><option value="">All domains</option>{domains.data.map(d=><option key={d.id} value={d.id}>{d.domain_name}</option>)}</select></label><label>From<input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>Until<input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label></div><details className="miih-export-columns"><summary>Choose Excel columns ({selectedCols.length} selected)</summary><div className="miih-export-grid">{(exportFields[dataset]||[]).map(col=><label key={col}><input type="checkbox" checked={selectedCols.includes(col)} onChange={e=>setSelectedCols(cols=>e.target.checked?[...cols,col]:cols.filter(c=>c!==col))}/>{col.replaceAll('_',' ')}</label>)}</div><button className="miih-admin-outline" type="button" onClick={()=>setSelectedCols(exportFields[dataset])}>Select all columns</button></details><button className="miih-admin-primary" type="button" disabled={busy||!selectedCols.length||!can('EXPORT_CREATE')} onClick={exportNow}>{busy?'Preparing…':'Generate & download sheet ⇩'}</button></Panel><Panel title="Recent exports"><ErrorMessage message={error}/><DataTable rows={data} columns={[{key:'dataset',label:'Dataset'},{key:'file_format',label:'Format'},{key:'row_count',label:'Rows'},{key:'status',label:'Status',render:v=><Badge value={v}/>},{key:'completed_at',label:'Completed',render:formatDate}]}/></Panel></>}
export function ProfilePage(){
  const {profile,notify,updateProfile,logout}=useAdmin();
  const [name,setName]=useState(profile.full_name);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const changed=name.trim()!==profile.full_name;
  async function save(){
    if(name.trim().length<2||!changed||busy)return;
    setBusy(true);setError('');
    try{
      await patch('/auth/admin/profile',{full_name:name.trim()},true);
      updateProfile(name.trim());
      notify('Your profile changes were saved.');
    }catch(err){setError(err instanceof Error?err.message:'Profile could not be saved.');}
    finally{setBusy(false);}
  }
  return <div className="miih-friendly-profile">
    <PageHeader eyebrow="MY ACCOUNT" title="My Profile" description="Your personal information in the Made in India admin workspace." />
    <div className="miih-friendly-profile-cover">
      <div className="miih-friendly-profile-avatar" aria-hidden="true">{profile.full_name.slice(0,1).toUpperCase()}</div>
      <div className="miih-friendly-profile-heading"><small>ZEAI · MADE IN INDIA</small><h2>{profile.full_name}</h2><p>{profile.email}</p></div>
      <span className="miih-friendly-profile-status">✓ Account active</span>
    </div>
    <div className="miih-friendly-profile-content">
      <Panel title="Personal details">
        <p className="miih-muted-admin">Update your display name here. Your sidebar name changes as soon as you save.</p>
        <form className="miih-editor-form" onSubmit={e=>{e.preventDefault();void save();}}>
          <label>Full name<input required minLength={2} maxLength={200} value={name} autoComplete="name" onChange={e=>setName(e.target.value)} /></label>
          <label>Email address<input value={profile.email} readOnly aria-readonly="true" /></label>
          {error&&<p className="miih-admin-error" role="alert">{error}</p>}
          <div className="miih-admin-row"><button type="submit" className="miih-admin-primary" disabled={!changed||busy||name.trim().length<2}>{busy?'Saving…':changed?'Save profile':'Up to date ✓'}</button>{changed&&<button type="button" className="miih-admin-outline" onClick={()=>setName(profile.full_name)}>Discard</button>}</div>
        </form>
      </Panel>
      <Panel title="Account actions"><p className="miih-muted-admin">You're signed in to the ZeAI admin workspace. For account changes, contact your organization administrator.</p><button type="button" className="miih-admin-outline" onClick={logout}>Sign out →</button></Panel>
    </div>
  </div>;
}
