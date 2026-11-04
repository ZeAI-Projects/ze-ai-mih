import { createContext, useContext, useEffect, useMemo, useState, type ReactNode, type FormEvent } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get, getSession, post, setSession, type AdminProfile, type Session } from '@/lib/miihApi';
import './styles/admin.css';
import { AdminDialogHost } from './AdminDialogs';

export type AdminContextValue = { profile:AdminProfile;permissions:Set<string>;superAdmin:boolean;can:(permission:string)=>boolean;logout:()=>void;notify:(message:string)=>void;updateProfile:(name:string)=>void };
const Context=createContext<AdminContextValue|null>(null);
export function useAdmin(){const ctx=useContext(Context);if(!ctx)throw new Error('Missing AdminContext');return ctx;}
function unwrap<T>(value:unknown):T {if(value && typeof value==='object' && 'data' in value)return (value as {data:T}).data;return value as T;}
export function useResource<T>(path:string|null,initial:T,watch:unknown[]=[]){
  const [data,setData]=useState<T>(initial);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [tick,setTick]=useState(0);
  useEffect(()=>{
    if(!path) {setLoading(false);return;}
    let active=true;
    let revision=0;let inFlight=false;let queued=false;let loaded=false;
    const refresh=()=>{
      if(inFlight){queued=true;return;}
      inFlight=true;const request=++revision;
      if(!loaded)setLoading(true);
      setError('');
      get<unknown>(path,true).then(v=>{
        if(active&&revision===request){setData(unwrap<T>(v));loaded=true;}
      }).catch(e=>{
        if(active&&revision===request)setError(e instanceof Error?e.message:'Request failed');
      }).finally(()=>{inFlight=false;if(active&&revision===request){setLoading(false);if(queued){queued=false;refresh();}}});
    };
    const onVisible=()=>{if(document.visibilityState==='visible')refresh();};
    refresh();
    const onStorage=(event:StorageEvent)=>{if(event.key==='miih:last-update')refresh();};
    window.addEventListener('storage',onStorage);
    window.addEventListener('miih:data-updated',refresh);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',onVisible);
    // Polling also picks up edits by other admins without reloading the page.
    const interval=window.setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
    return()=>{
      active=false;
      window.clearInterval(interval);
      window.removeEventListener('storage',onStorage);
      window.removeEventListener('miih:data-updated',refresh);
      window.removeEventListener('focus',refresh);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[path,tick,...watch]);
  return {data,setData,loading,error,reload:()=>setTick(t=>t+1)};
}
const navigation=[
  {name:'Dashboard',slug:'dashboard',symbol:'▦',permission:'DASHBOARD_VIEW'},
  {name:'Teams',slug:'teams',symbol:'♙',permission:'TEAMS_VIEW'},
  {name:'Participants',slug:'participants',symbol:'◉',permission:'PARTICIPANTS_VIEW'},
  {name:'Revenue',slug:'revenue',symbol:'₹',permission:'SUPER_ADMIN'},
  {name:'Statistics',slug:'statistics',symbol:'▥',permission:'STATISTICS_VIEW'},
  {name:'Audit Log',slug:'audit-log',symbol:'◷',permission:'HISTORY_VIEW'},
  {name:'Studio',slug:'studio',symbol:'▧',permission:'SITE_PREVIEW'},
  {name:'Registration Form',slug:'form',symbol:'☷',permission:'FORM_VIEW'},
  {name:'Hackathon Settings',slug:'settings',symbol:'⚙',permission:'EVENT_VIEW'},
  {name:'Admin Configuration',slug:'admins',symbol:'♜',permission:'SUPER_ADMIN'},
  {name:'My Profile',slug:'profile',symbol:'♧',permission:'ANY'},
];
export function AdminPortal(){
  const [profile,setProfile]=useState<AdminProfile|null>(null);
  const [permissions,setPermissions]=useState<Set<string>>(new Set());
  const [authState,setAuthState]=useState<'loading'|'guest'|'pending'|'ready'>('loading');
  const [notice,setNotice]=useState('');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const location=useLocation();const navigate=useNavigate();
  function logout(){setSession(null);setProfile(null);setAuthState('guest');navigate('/admin/login');}
  async function bootstrap(){if(!getSession()?.access_token){setAuthState('guest');return;}
    try {
      const [p,perm]=await Promise.all([get<unknown>('/admin/me',true),get<unknown>('/admin/permissions',true)]);
      const account=unwrap<AdminProfile>(p);const allowed=unwrap<{role:string;permissions:string[]}>(perm);
      setProfile(account);setPermissions(new Set(allowed.permissions));setAuthState('ready');
    }catch(err){if(err instanceof Error && ('status' in err) && (err as {status:number}).status===403){setAuthState('pending');}else{setAuthState('guest');setSession(null);}}
  }
  useEffect(()=>{void bootstrap();},[]);
  useEffect(()=>{setSidebarOpen(false);},[location.pathname]);
  useEffect(()=>{
    if(authState!=='ready')return;
    let active=true;
    let requestNumber=0;
    const refreshAccess=async()=>{
      const request=++requestNumber;
      try{
        const [p,perm]=await Promise.all([get<unknown>('/admin/me',true),get<unknown>('/admin/permissions',true)]);
        if(!active||request!==requestNumber)return;
        const account=unwrap<AdminProfile>(p);
        const allowed=unwrap<{permissions:string[]}>(perm);
        setProfile(prev=>prev && prev.id===account.id && prev.full_name===account.full_name && prev.role===account.role && prev.approval_status===account.approval_status && prev.email===account.email ? prev : account);
        setPermissions(prev=>{
          const next=new Set(allowed.permissions);
          return prev.size===next.size && [...prev].every(v=>next.has(v)) ? prev : next;
        });
      }catch{/* A temporary network error must not erase an active admin session. */}
    };
    const visible=()=>{if(document.visibilityState==='visible')void refreshAccess();};
    const updated=()=>{void refreshAccess();};
    const interval=window.setInterval(visible,30000);
    window.addEventListener('focus',updated);
    window.addEventListener('miih:data-updated',updated);
    document.addEventListener('visibilitychange',visible);
    return()=>{active=false;window.clearInterval(interval);window.removeEventListener('focus',updated);window.removeEventListener('miih:data-updated',updated);document.removeEventListener('visibilitychange',visible);};
  },[authState]);

  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),4500);return()=>window.clearTimeout(timer);},[notice]);
  const ctx=useMemo<AdminContextValue|null>(()=> profile?({profile,permissions,superAdmin:profile.role==='SUPER_ADMIN',can:(perm:string)=>profile.role==='SUPER_ADMIN'||perm==='ANY'||permissions.has(perm),logout,notify:setNotice,updateProfile:(name:string)=>setProfile(current=>current?{...current,full_name:name}:current)}):null,[profile,permissions]);
  if(authState==='loading')return <div className="miih-admin miih-admin-loading">Loading secure admin workspace…</div>;
  if(authState==='guest'||authState==='pending'||!ctx)return <AdminAuth pending={authState==='pending'} onAuthenticated={bootstrap}/>;
  const approvedProfile = ctx.profile;
  const sections=[navigation.slice(0,6),navigation.slice(6,-1),navigation.slice(-1)];
  return <Context.Provider value={ctx}><div className="miih-admin">
    <aside className={`miih-admin-sidebar ${sidebarOpen?'is-open':''}`} aria-label="Admin navigation">
      <NavLink className="miih-admin-brand" to="/admin/dashboard"><span className="miih-admin-logo">#</span><span><b>Made in India</b><small>Hackathon administration</small></span></NavLink>
      <div className="miih-side-divider"/>
      {sections.map((group,i)=><div className="miih-sidebar-group" key={i}><span className="miih-sidebar-caption">{['OPERATIONS','MANAGEMENT','ACCOUNT'][i]}</span>{group.filter(item=>ctx.can(item.permission)).map(item=><NavLink key={item.slug} to={`/admin/${item.slug}`} className={({isActive})=>`miih-side-link ${isActive?'selected':''}`}><span>{item.symbol}</span>{item.name}</NavLink>)}</div>)}
      <div className="miih-sidebar-bottom"><div className="miih-sidebar-avatar">{approvedProfile.full_name.slice(0,1).toUpperCase()}</div><div><b>{approvedProfile.full_name}</b><small>{approvedProfile.role==='SUPER_ADMIN'?'Super Admin':'Admin'}</small></div><button type="button" onClick={logout} title="Sign out">⇥</button></div>
    </aside>
    <div className="miih-admin-main"><header className="miih-admin-topbar"><button className="miih-mobile-toggle" type="button" onClick={()=>setSidebarOpen(v=>!v)}>☰ Menu</button><span className="miih-admin-top-label">ZeAI / Made in India <b>· Admin workspace</b></span><span className="miih-admin-top-status"><i/> {approvedProfile.role==='SUPER_ADMIN'?'Super Admin':'Approved Admin'}</span><a href="/register" target="_blank" rel="noopener noreferrer">View public site ↗</a></header>
      <div className="miih-admin-content"><Outlet/></div>
    </div>
    {notice&&<div className="miih-admin-toast" role="status">{notice}<button type="button" onClick={()=>setNotice('')} aria-label="Dismiss">×</button></div>}
  </div><AdminDialogHost /></Context.Provider>;
}
function AdminAuth({pending,onAuthenticated}:{pending:boolean;onAuthenticated:()=>Promise<void>}){
  const [mode,setMode]=useState<'login'|'signup'|'apply'|'pending'>(pending?'pending':'login');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [name,setName]=useState('');const [error,setError]=useState('');const [info,setInfo]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!pending)return;let active=true;void get<unknown>('/admin/application-status',true).then(value=>{if(!active)return;const result=unwrap<{approval_status:string}>(value);setMode(result.approval_status==='NOT_APPLIED'?'apply':'pending');setInfo(result.approval_status==='NOT_APPLIED'?'Enter your name and submit to appear in the Super Admin approval list.':`Application status: ${result.approval_status}.`);}).catch(error=>{if(active)setError(error instanceof Error?error.message:'Unable to load application status');});return()=>{active=false;};},[pending]);
  async function action(e:FormEvent){e.preventDefault();setBusy(true);setError('');setInfo('');
    try{
      if(mode==='signup'){await post('/auth/signup',{email,password});setInfo('Check your email for confirmation, then sign in and apply for admin approval.');setMode('login');}
      else if(mode==='login'){const s=await post<Session>('/auth/login',{email,password});if(!s.access_token)throw new Error('Email not confirmed or session unavailable.');setSession(s);try{await onAuthenticated();}catch{/* pending profile handled by application status */}try{const status=unwrap<{approval_status:string}>(await get<unknown>('/admin/application-status',true));setMode(status.approval_status==='NOT_APPLIED'?'apply':'pending');if(status.approval_status!=='NOT_APPLIED')setInfo(`Application status: ${status.approval_status}.`);}catch{setMode('apply');}}
      else if(mode==='apply'){await post('/admin/apply',{full_name:name},true);setMode('pending');setInfo('Application submitted to Super Admin for approval.');}
      else {const result=unwrap<{approval_status:string}>(await get<unknown>('/admin/application-status',true));if(result.approval_status==='APPROVED')await onAuthenticated();else if(result.approval_status==='NOT_APPLIED')setMode('apply');else setInfo(`Application status: ${result.approval_status}.`);}
    }catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}
  }
  return <div className="miih-admin miih-auth-screen"><div className="miih-auth-intro"><div className="miih-auth-symbol">#</div><p>ZEAI SOFT / MADE IN INDIA</p><h1>Manage every detail.<br/><em>Protect every entry.</em></h1><span>Secure hackathon administration, editable content, team registrations and permission-based workflows.</span></div>
    <form className="miih-auth-card" onSubmit={action}><p className="miih-kicker">ADMIN PORTAL</p><h2>{mode==='login'?'Administrator sign in':mode==='signup'?'Request admin access':mode==='apply'?'Complete access request':'Waiting for approval'}</h2><p>{mode==='login'?'Sign in to manage the hackathon. New staff can request access for Super Admin approval.':mode==='signup'?'Create an account to request access. You cannot enter the dashboard until a Super Admin approves you.':'Your request is subject to Super Admin approval.'}</p>
      {(mode==='login'||mode==='signup')&&<><label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@zeaisoft.com"/></label><label>Password<input required minLength={8} type="password" autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label></>}
      {mode==='apply'&&<label>Full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} /></label>}
      {mode==='pending'&&<div className="miih-admin-callout">Your application must be approved by the Super Admin. You can check its status here.</div>}
      {error&&<p className="miih-admin-error" role="alert">{error}</p>}{info&&<p className="miih-admin-good" role="status">{info}</p>}
      <button className="miih-admin-primary" type="submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':mode==='signup'?'Create account & request access':mode==='apply'?'Submit application':'Check approval status'} →</button>
      <div className="miih-auth-switch">{mode==='login'?<a href="/admin/request-access">Request Admin Access →</a>:mode==='signup'?<button type="button" onClick={()=>setMode('login')}>Already have an account? Sign in</button>:<button type="button" onClick={()=>{setSession(null);setMode('login');}}>Use a different account</button>}</div><a className="miih-auth-return" href="/">← Back to Made in India</a>
    </form>
  </div>;
}
export function ProtectedAdminPage({permission,children}:{permission:string;children:ReactNode}){const {can}=useAdmin();return can(permission)?<>{children}</>:<Navigate to="/admin/profile" replace/>;}
export function PageHeader({eyebrow,title,description,actions}:{eyebrow:string;title:string;description:string;actions?:ReactNode}){return <div className="miih-page-header"><div><p className="miih-kicker">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{actions&&<div className="miih-header-actions">{actions}</div>}</div>;}
export function Panel({children,title,toolbar}:{children?:ReactNode;title?:string;toolbar?:ReactNode}){return <section className="miih-admin-panel">{(title||toolbar)&&<div className="miih-panel-head"><h2>{title}</h2>{toolbar}</div>}{children}</section>}
export function Loading({message='Loading data…'}:{message?:string}){return <div className="miih-admin-loading-content">{message}</div>}
export function ErrorMessage({message}:{message?:string}){return message?<div className="miih-admin-error" role="alert"><strong>Unable to load this data.</strong><span>{message}</span><small>Confirm FastAPI is running on port 5000 and refresh this section after the connection is restored. Existing data was not changed.</small></div>:null;}
export function Empty({message='No records match your current filters.'}:{message?:string}){return <p className="miih-empty">{message}</p>;}
export function formatDate(v:unknown){if(!v)return '—';const d=new Date(String(v));return Number.isNaN(d.valueOf())?String(v):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}
export function formatMoney(v:unknown){const n=Number(v||0);return '₹'+n.toLocaleString('en-IN',{maximumFractionDigits:2});}
export function Badge({value}:{value:unknown}){const s=String(value||'—');return <span className={`miih-admin-badge miih-status-${s.toLowerCase().replace(/[^a-z]+/g,'-')}`}>{s.replace(/_/g,' ')}</span>}
export function DataTable({columns,rows,onSelect}:{columns:{key:string;label:string;render?:(v:unknown,r:Record<string,unknown>)=>ReactNode}[];rows:Record<string,unknown>[];onSelect?:(r:Record<string,unknown>)=>void}){return <div className="miih-admin-table-scroll"><table className="miih-admin-table"><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{onSelect&&<th>Details</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={String(r.id||i)}>{columns.map(c=><td key={c.key}>{c.render?c.render(r[c.key],r):String(r[c.key]??'—')}</td>)}{onSelect&&<td><button className="miih-admin-link" type="button" onClick={()=>onSelect(r)}>View ↗</button></td>}</tr>)}</tbody></table>{!rows.length&&<Empty/>}</div>}
