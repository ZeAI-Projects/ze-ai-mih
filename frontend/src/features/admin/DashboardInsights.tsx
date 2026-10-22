import {useState} from 'react';
import {qs} from '@/lib/miihApi';
import { useResource, useAdmin, Panel, Badge, Loading, ErrorMessage, formatDate, Empty } from './AdminPortal';
type Row = Record<string, unknown>;
export function DashboardInsights(){
 const [status,setStatus]=useState('');
 const { can } = useAdmin();
 const stats = useResource<{by_domain:Row[];by_status:Row[];by_day:Row[]}>(can('STATISTICS_VIEW')?'/admin/statistics':null,{by_domain:[],by_status:[],by_day:[]});
 const recent = useResource<Row[]>(can('TEAMS_VIEW')?`/admin/teams${qs({limit:5,status})}`:null,[]);
 const max=Math.max(1,...stats.data.by_domain.map(r=>Number(r.registered_teams)||0));
 return (!can('STATISTICS_VIEW')&&!can('TEAMS_VIEW'))?null:<div className="miih-admin-grid2 miih-dashboard-insights">
  <Panel title="Registration activity by domain"><ErrorMessage message={stats.error}/>{stats.loading?<Loading/>:stats.error?null:stats.data.by_domain.length?stats.data.by_domain.slice(0,8).map((row,index)=><div className="miih-chart-row" key={index}><span>{String(row.domain_name||'Unknown')}</span><div><i style={{width:`${100*Number(row.registered_teams||0)/max}%`}}/></div><b>{Number(row.registered_teams||0)}</b></div>):<Empty message="Registrations will appear here when teams submit their forms."/>}</Panel>
  <Panel title="Recent team registrations" toolbar={<select aria-label="Filter recent registrations by status" value={status} onChange={e=>setStatus(e.target.value)}>{['','DRAFT'].map(value=><option key={value} value={value}>{value==='DRAFT'?'Draft':'Submitted'}</option>)}</select>}><ErrorMessage message={recent.error}/>{recent.loading?<Loading/>:recent.error?null:recent.data.length?recent.data.map((row,index)=><div className="miih-tally-row" key={String(row.id||index)}><div><strong>{String(row.team_name||'Unnamed team')}</strong><small style={{display:'block',color:'var(--muted)'}}>{String(row.registration_code||'')} · {formatDate(row.submitted_at)}</small></div><Badge value={row.status}/></div>):<Empty message={status==='DRAFT'?'No draft registrations.':'No registrations match this filter.'}/>}</Panel>
 </div>;
}


/** Show real registration status counts rather than an empty workspace-information card. */
export function DashboardRegistrationPipeline(){
 const {can}=useAdmin();
 const allowed=can('STATISTICS_VIEW');
 const resource=useResource<{by_domain:Row[];by_status:Row[];by_day:Row[]}>(allowed?'/admin/statistics':null,{by_domain:[],by_status:[],by_day:[]});
 const statuses=[
  {key:'DRAFT',label:'Drafts started',url:'/admin/teams?status=DRAFT'},
  {key:'SUBMITTED',label:'Submitted / awaiting review',url:'/admin/teams?status=SUBMITTED'},
  {key:'REVIEW',label:'Under review',url:'/admin/teams?status=REVIEW'},
  {key:'APPROVED',label:'Approved registrations',url:'/admin/teams?status=APPROVED'},
  {key:'REJECTED',label:'Rejected registrations',url:'/admin/teams?status=REJECTED'},
 ];
 const counts=new Map(resource.data.by_status.map(row=>[String(row.status||'').toUpperCase(),Number(row.teams||0)]));
 const total=[...counts.values()].reduce((sum,count)=>sum+count,0);
 const recentDays=resource.data.by_day.slice(0,7).reduce((sum,row)=>sum+Number(row.teams||0),0);
 return <Panel title="Registration pipeline" toolbar={allowed?<a className="miih-admin-outline" href="/admin/statistics">Statistics →</a>:undefined}>
  {!allowed?<p className="miih-muted-admin">Detailed registration statistics are available to admins with Statistics permission.</p>:<>
   <ErrorMessage message={resource.error}/>
   {resource.loading?<Loading/>:resource.error?null:<>
    <div className="miih-dashboard-pipeline-intro"><div><strong>{total}</strong><small>Total registrations including drafts</small></div><div><strong>{recentDays}</strong><small>Submissions across the latest 7 recorded days</small></div></div>
    <div className="miih-dashboard-pipeline-list">{statuses.map(item=><a href={item.url} className="miih-dashboard-pipeline-item" key={item.key} aria-label={`${item.label}: ${counts.get(item.key)||0}`}><span><i className={`miih-pipeline-dot miih-pipeline-${item.key.toLowerCase()}`}/>{item.label}</span><b>{counts.get(item.key)||0}</b></a>)}</div>
    {!total&&<p className="miih-muted-admin miih-dashboard-fresh-note">No registrations yet. This panel will update automatically as team leaders register.</p>}
   </>}
  </>}
 </Panel>;
}
