import { useEffect, useMemo, useState, useId, useRef, type FormEvent } from 'react';
import { API_BASE, getSession, api, ApiError, post, registrationRequest, upload, type Domain, type FormSection, type Question, type RegistrationConfig } from '@/lib/miihApi';
import './teamRegistrationDialog.css';
import { RegistrationUpload, type UploadState } from './RegistrationUpload';

const CODE = String('MIIH_UPCOMING'); // One permanent hackathon edition; versions are managed in the admin form builder.
const CONFIG_TIMEOUT_MS = 15000;
const INTERNAL_TEST=CODE==='MIIH_TEST_48H';
type Member = {full_name:string;email:string;mobile:string};
type Draft = {id:string;edit_token:string;registration_code?:string};
type AnswerRow = {question:Question;member_order?:number;value:unknown};
const emptyMember = ():Member=>({full_name:'',email:'',mobile:''});
const cleanLabel=(s:string)=>s.replace(/^\s*(?:Q(?:uestion)?\s*)?\d+\s*[.):-]\s*/i,'').trim();
const CANONICAL = new Set(['team_name','source_team_id','participant_category','investor_pitch_interest','team_domain','full_name','email','mobile','team_role','attending_member_count','attending_member_names','payment_transaction_id','payment_proof']);
const fieldKey = (q:Question, member?:number) => `${q.id}@${member ?? 'team'}`;
// Q25 controls Q20-Q24 and Q26. Older published forms sometimes lack
// visibility_rules, so also recognize legacy numbers and PITCH scope.
const PITCH_QUESTION_NUMBERS = new Set([20,21,22,23,24,26]);
function isPitchDependent(q:Question):boolean {
  if(q.field_key==='investor_pitch_interest')return false;
  return q.visibility_rules?.only_if_pitch_interest===true
    || q.answer_scope==='PITCH'
    || (q.legacy_question_number!=null && PITCH_QUESTION_NUMBERS.has(Number(q.legacy_question_number)));
}
function normalizeValue(q:Question, v:unknown):unknown { if(q.input_type==='NUMBER')return v===''?undefined:Number(v);return v; }
function fieldValid(q:Question, v:unknown):boolean {
  if (v===undefined || v===null || v==='' || (Array.isArray(v)&&v.length===0)) return !q.is_required;
  if(q.input_type==='BOOLEAN')return typeof v==='boolean' && (q.validation_rules?.must_be_true !== true || v===true);
  if(q.input_type==='FILE')return typeof v==='string' && /^[0-9a-f-]{36}$/i.test(v);
  if(q.input_type==='MULTI_SELECT')return Array.isArray(v) && v.length>0;
  if(q.input_type==='NUMBER')return typeof v==='number' && Number.isFinite(v);
  if(q.input_type==='EMAIL')return typeof v==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if(q.input_type==='PHONE')return typeof v==='string' && /^\+?[0-9 ()-]+$/.test(v) && v.replace(/\D/g,'').length>=7 && v.replace(/\D/g,'').length<=15;
  if(q.input_type==='URL'){try{return ['https:','http:'].includes(new URL(String(v)).protocol);}catch{return false;}}
  return v!==undefined && v!==null && String(v).trim().length>0;
}
function friendlyError(err:unknown) {return err instanceof Error ? err.message : 'Something went wrong. Please try again.';}
function QuestionField({question, value, onChange, onFile, busy, uploadState, onRemove}: {question:Question;value:unknown;onChange:(v:unknown)=>void;onFile:(f:File)=>void;busy:boolean;uploadState?:UploadState;onRemove:()=>void}) {
  const inputId=useId();
  const required = question.is_required;
  const label = <label htmlFor={inputId}>{cleanLabel(question.question_label)}{required&&<span aria-label="required" className="miih-required"> *</span>}</label>;
  if(question.input_type==='DERIVED')return null;
  const options=(question.options||[]).filter(o=>o.is_active!==false);
  const val=(typeof value==='string'||typeof value==='number')?String(value):'';
  return <div className="miih-form-field" data-question={question.field_key}>
    {label}{question.description&&<p className="miih-field-help">{question.description}</p>}
    {question.input_type==='BOOLEAN' ? <div className="miih-choice-row" role="group" aria-label={question.question_label}>
        <label><input type="radio" name={inputId} checked={value===true} onChange={()=>onChange(true)}/> Yes</label>
        <label><input type="radio" name={inputId} checked={value===false} onChange={()=>onChange(false)}/> No</label>
      </div> : question.input_type==='FILE' ? <RegistrationUpload inputId={inputId} state={uploadState} stored={typeof value==='string' && /^[0-9a-f-]{36}$/i.test(value)} photo={/photo|portrait/i.test(question.field_key)} disabled={busy} onSelect={onFile} onRemove={onRemove}/> : question.input_type==='TEXTAREA' ?
      <textarea id={inputId} rows={3} value={val} placeholder={question.placeholder||'Enter details'} onChange={e=>onChange(e.target.value)}/> :
      question.input_type==='SINGLE_SELECT' ?
      <select id={inputId} value={val} onChange={e=>onChange(e.target.value)}><option value="">Select an option</option>{options.map(o=><option value={o.option_value} key={o.option_value}>{o.option_label}</option>)}</select> :
      question.input_type==='MULTI_SELECT' ? <div className="miih-choice-row">
        {options.map(o=><label key={o.option_value}><input type="checkbox" checked={Array.isArray(value)&&value.includes(o.option_value)} onChange={e=>{const cur=Array.isArray(value)?value as string[]:[];onChange(e.target.checked?[...cur,o.option_value]:cur.filter(x=>x!==o.option_value));}}/> {o.option_label}</label>)}
      </div> : <input id={inputId} type={question.input_type==='EMAIL'?'email':question.input_type==='PHONE'?'tel':question.input_type==='DATE'?'date':question.input_type==='URL'?'url':question.input_type==='NUMBER'?'number':'text'} value={val} onChange={e=>onChange(question.input_type==='NUMBER'?(e.target.value===''?undefined:Number(e.target.value)):e.target.value)} placeholder={question.placeholder||'Enter details'} />}
    {!fieldValid(question,value)&&<small className="miih-error">{value===undefined||value===''?'This field is required.':'Please enter a valid answer.'}</small>}
  </div>;
}
export function TeamRegistrationDialog({open,onClose}:{open:boolean;onClose:()=>void}) {
  const modalRef=useRef<HTMLElement>(null);
  const [config,setConfig]=useState<RegistrationConfig|null>(null);
  const [loadState,setLoadState]=useState<'loading'|'loaded'|'unpublished'|'error'>('loading');
  const [reloadKey,setReloadKey]=useState(0);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [step,setStep]=useState(0);
  const [team,setTeam]=useState({team_name:'',domain_id:'',investor_pitch_interest:undefined as boolean|undefined});
  const [members,setMembers]=useState<Member[]>([emptyMember()]);
  const [uploads,setUploads]=useState<Record<string,UploadState>>({});
  const [confirmation,setConfirmation]=useState<{registration_code?:string;submitted_at?:string;payment_status?:string}>({});
  const [answers,setAnswers]=useState<Record<string,unknown>>({});
  const [transactionId,setTransactionId]=useState('');
  const [proofFile,setProofFile]=useState('');
  const [paymentRecorded,setPaymentRecorded]=useState(false);
  const [paymentLinkOpened,setPaymentLinkOpened]=useState(false);
  const [paymentEvidenceVisible,setPaymentEvidenceVisible]=useState(false);
  const [proofUpload,setProofUpload]=useState<UploadState|undefined>();
  const [submitted,setSubmitted]=useState(false);
  const [submittedTeamId,setSubmittedTeamId]=useState('');
  // The notice is configurable by Super Admin using published REGISTER / POPUP
  // content revisions. Missing or unpublished revisions use professional defaults.
  const [noticeContent,setNoticeContent]=useState<Record<string,string>>({});
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    setNoticeContent({});
    void api<Array<{section_key:string;slot_key:string;text_value?:string|null}>>(
      '/public/site-content/REGISTER', {signal:controller.signal}
    ).then(rows=>{
      if(controller.signal.aborted)return;
      const next:Record<string,string>={};
      for(const row of rows){
        if(row.section_key==='POPUP' && row.text_value?.trim()){
          next[row.slot_key]=row.text_value.trim();
        }
      }
      setNoticeContent(next);
    }).catch(()=>{/* The fixed default notice remains available without the CMS endpoint. */});
    return()=>controller.abort();
  },[open]);
  const registrationNotice={
    title:noticeContent.registration_closed_headline||'Team Registration Opening Soon',
    description:noticeContent.registration_closed_description||'Registration for the upcoming edition of the ZeAI #MadeInIndia Hackathon is not yet open. Our team is finalizing the event details and registration process. Confirmed information, eligibility criteria, and payment instructions will be available here when registration opens.',
    closing:noticeContent.registration_closed_closing||'Thank you for your interest. We look forward to welcoming your team.',
    button:noticeContent.registration_closed_button||'Close',
  };

  // An unpublished event deliberately returns 404. A slow/unreachable API must
  // never leave the registration dialog in a permanent loading state.
  useEffect(()=>{
    if(!open)return;
    let active=true;
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),CONFIG_TIMEOUT_MS);
    setLoadState('loading');
    setConfig(null);
    setMessage('');
    api<RegistrationConfig>(INTERNAL_TEST?`/public/test-editions/${CODE}/registration-config`:`/public/editions/${CODE}/registration-config`,{signal:controller.signal},INTERNAL_TEST)
      .then(c=>{
        if(!active)return;
        setConfig(c);
        setLoadState('loaded');
        // The minimum is the number of mandatory members. Additional seats are
        // optional, even when the configured default happens to be larger.
        const minimum=Math.max(1,Number(c.edition.min_team_size)||1);
        const maximum=Math.max(minimum,Number(c.edition.max_team_size)||minimum);
        setMembers(old=>{
          const hasEnteredDetails=old.some(m=>Boolean(m.full_name.trim()||m.email.trim()||m.mobile.trim()));
          const target=hasEnteredDetails?Math.min(maximum,Math.max(minimum,old.length)):minimum;
          return old.length===target?old:Array.from({length:target},(_,i)=>old[i]||emptyMember());
        });
      })
      .catch(e=>{
        if(!active)return;
        if(controller.signal.aborted){
          setLoadState('error');
          setMessage('The registration service took too long to respond. Check your connection and try again.');
        }else if(e instanceof ApiError && e.status===404){
          setLoadState('unpublished');
          setMessage('Registration is not published yet.');
        }else{
          setLoadState('error');
          setMessage(friendlyError(e));
        }
      })
      .finally(()=>window.clearTimeout(timeout));
    return()=>{active=false;window.clearTimeout(timeout);controller.abort();};
  },[open,reloadKey]);

  // Prevent scrolling the document behind the modal; the form itself remains
  // scrollable. Preserve and restore the exact previous scroll position.
  useEffect(()=>{
    if(!open)return;
    const body=document.body;
    const html=document.documentElement;
    const scrollY=window.scrollY;
    const previous={
      htmlOverflow:html.style.overflow,
      bodyOverflow:body.style.overflow,
      position:body.style.position,
      top:body.style.top,
      left:body.style.left,
      right:body.style.right,
      width:body.style.width,
    };
    html.style.overflow='hidden';
    body.style.overflow='hidden';
    body.style.position='fixed';
    body.style.top=`-${scrollY}px`;
    body.style.left='0';
    body.style.right='0';
    body.style.width='100%';
    return()=>{
      html.style.overflow=previous.htmlOverflow;
      body.style.overflow=previous.bodyOverflow;
      body.style.position=previous.position;
      body.style.top=previous.top;
      body.style.left=previous.left;
      body.style.right=previous.right;
      body.style.width=previous.width;
      window.scrollTo(0,scrollY);
    };
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null;
    modalRef.current?.focus();
    function handleKey(e:KeyboardEvent){
      if(e.key==='Escape'){e.preventDefault();return;}
      if(e.key!=='Tab')return;
      const items=Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')||[]).filter(el=>el.getClientRects().length);
      const first=items[0],last=items[items.length-1];
      if(!first){e.preventDefault();return;}
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===modalRef.current)){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===modalRef.current)){e.preventDefault();first.focus();}
    }
    window.addEventListener('keydown',handleKey);
    return()=>{window.removeEventListener('keydown',handleKey);previous?.focus();};
  },[open,onClose]);
  const questions = useMemo(()=>config?.sections.flatMap(s=>s.questions).filter(q=>q.is_active!==false)||[],[config]);
  const details=useMemo(()=>config?.sections.map(s=>({...s,questions:s.questions.filter(q=>q.is_active!==false && !CANONICAL.has(q.field_key) && q.input_type!=='DERIVED')})).filter(s=>s.questions.length) || [],[config]);
  const answerRows=useMemo<AnswerRow[]>(()=>details.flatMap(s=>s.questions.flatMap((q):AnswerRow[]=>{
    if(isPitchDependent(q) && team.investor_pitch_interest!==true)return [];
    const count=(q.answer_scope==='MEMBER')?members.length:(q.answer_scope==='LEADER'?1:0);
    return count?Array.from({length:count},(_,i)=>({question:q,member_order:i+1,value:answers[fieldKey(q,i+1)]})): [{question:q,member_order:undefined,value:answers[fieldKey(q)]}];
  })),[details,members.length,answers,team.investor_pitch_interest]);
  const findQuestion=(key:string)=>questions.find(q=>q.field_key===key);
  const must=(key:string)=>findQuestion(key)?.is_required===true;
  const questionLabel=(key:string,fallback:string)=>cleanLabel(findQuestion(key)?.question_label||fallback);
  const duplicateEmails=new Set(members.map(m=>m.email.trim().toLowerCase())).size!==members.length;
  const teamValid=!duplicateEmails && team.team_name.trim().length>=2 && (config?.domains.some(d=>d.id===team.domain_id)??false) && members.length>=(config?.edition.min_team_size||4) && members.length<=(config?.edition.max_team_size||4) && members.every(m=>m.full_name.trim().length>=2 && /\S+@\S+\.\S+/.test(m.email) && /^\+?[0-9 ()-]{7,30}$/.test(m.mobile.trim()) && m.mobile.replace(/\D/g,'').length>=7) && team.investor_pitch_interest!==undefined;
  const answersValid=answerRows.every(a=>fieldValid(a.question,a.value));
  const paymentFree=CODE==='MIIH_TEST_48H' && config?.payment?.payment_required===false && config?.payment?.payment_enabled===false;
  const canSubmit=Boolean(config?.registration_enabled && draft && teamValid && answersValid && (paymentFree || (transactionId.trim().length>=4 && proofFile && paymentRecorded)) && !busy);
  function setMember(index:number,key:keyof Member,value:string){setMembers(old=>old.map((m,i)=>i===index?{...m,[key]:value}:m));}
  function selectPitchInterest(value:boolean){
    setTeam(old=>({...old,investor_pitch_interest:value}));
    if(!value){
      const conditional = new Set(questions.filter(isPitchDependent).map(q=>q.id));
      setAnswers(old=>Object.fromEntries(Object.entries(old).filter(([key])=>!conditional.has(key.split('@')[0]))));
      setUploads(old=>Object.fromEntries(Object.entries(old).filter(([key])=>!conditional.has(key.split('@')[0]))));
    }
    // saveTeam() persists the switch and removes saved pitch answers when No.
  }
  function setAnswer(q:Question,idx:number|undefined,value:unknown){setAnswers(old=>({...old,[fieldKey(q,idx)]:value}));}
  async function uploadAnswer(q:Question,idx:number|undefined,file:File) {
    if(!draft){setMessage('Save the team first to enable uploads.');return;}
    const key=fieldKey(q,idx);
    const photo=/photo|portrait/i.test(q.field_key);
    setAnswer(q,idx,undefined);
    const error=file.size===0||file.size>10*1024*1024?'Choose a nonempty file up to 10 MB.':!['image/jpeg','image/png','image/webp',...(photo?[]:['application/pdf'])].includes(file.type)?'Unsupported file format.':'';
    if(error){setUploads(old=>({...old,[key]:{file,status:'error',error}}));return;}
    setUploads(old=>({...old,[key]:{file,status:'uploading'}}));
    setBusy(true);setMessage('');
    try { const result=await upload<{id:string}>(`/registrations/${draft.id}/upload`,file,INTERNAL_TEST,draft.edit_token);
      if(!/^[0-9a-f-]{36}$/i.test(result.id||''))throw new Error('Upload did not return a stored file reference.');
      setAnswer(q,idx,result.id);setUploads(old=>({...old,[key]:{file,status:'success'}}));
    } catch(e){setUploads(old=>({...old,[key]:{file,status:'error',error:friendlyError(e)}}));}finally{setBusy(false);}
  }
  function removeUpload(q:Question,idx?:number){setAnswer(q,idx,undefined);setUploads(old=>{const next={...old};delete next[fieldKey(q,idx)];return next;});}

  async function saveTeam(){
    if(!teamValid){setMessage('Complete all required team details, including all member names, emails and phone numbers.');return;}
    setBusy(true);setMessage('');
    try {
      let current=draft;
      if(!current){current=await post<Draft>(`/registrations/${CODE}/start`,{},INTERNAL_TEST);setDraft(current);}
      await registrationRequest(current.id,current.edit_token,'/team','PUT',{...team,source_team_id:null,participant_category:null,members},INTERNAL_TEST);
      setStep(1);
    }catch(e){setMessage(friendlyError(e));}finally{setBusy(false);}
  }
  async function saveAnswers(){
    if(!draft)return;
    if(!answersValid){
      const missing=answerRows.filter(a=>!fieldValid(a.question,a.value)).slice(0,4).map(a=>`${cleanLabel(a.question.question_label)}${a.member_order?` (Member ${a.member_order})`:''}`);
      setMessage('Please complete these required answers before payment: '+missing.join('; '));
      return;
    }
    const rows=answerRows.map(r=>({question_id:r.question.id,...(r.member_order?{member_order:r.member_order}:{}),...((r.value===undefined||r.value===null||r.value==='')?{clear:true}:r.question.input_type==='FILE'?{file_id:r.value}:{value:normalizeValue(r.question,r.value)})}));
    setBusy(true);setMessage('');
    try {
      // A form may contain only canonical/team fields, with no extra answer rows.
      // That is valid: still advance to the payment step after saving the team.
      if(rows.length)await registrationRequest(draft.id,draft.edit_token,'/answers','PUT',{answers:rows},INTERNAL_TEST);
      setMessage('');
      setStep(2);
    }
    catch(e){setMessage(friendlyError(e));}finally{setBusy(false);}
  }
  async function uploadProof(file:File){
    if(!draft){setMessage('Save the team and its answers before uploading payment proof.');return;}
    setProofFile('');setPaymentRecorded(false);
    if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size===0 || file.size>10*1024*1024){
      const error='Choose a JPG, PNG or WebP payment screenshot up to 10 MB.';
      setProofUpload({file,status:'error',error});setMessage(error);return;
    }
    setProofUpload({file,status:'uploading'});
    setBusy(true);setMessage('');
    try{
      const result=await upload<{id:string}>(`/registrations/${draft.id}/upload`,file,INTERNAL_TEST,draft.edit_token);
      if(!/^[0-9a-f-]{36}$/i.test(result.id||''))throw new Error('The payment screenshot could not be stored. Please try again.');
      setProofFile(result.id);
      setProofUpload({file,status:'success'});
    }catch(e){const error=friendlyError(e);setProofUpload({file,status:'error',error});setMessage(error);}
    finally{setBusy(false);}
  }
  async function saveProof(){if(!draft || !proofFile || transactionId.trim().length<4)return;setBusy(true);setMessage('');
    try{await registrationRequest(draft.id,draft.edit_token,'/payment-evidence','POST',{transaction_id:transactionId.trim(),proof_file_id:proofFile},INTERNAL_TEST);setPaymentRecorded(true);setMessage('Evidence saved. Your payment is pending administrator verification; submit the registration to finish.');}
    catch(e){setMessage(friendlyError(e));}finally{setBusy(false);}
  }
  async function submit(e:FormEvent){e.preventDefault();if(!draft||!canSubmit)return;setBusy(true);setMessage('');
    try {const check=await registrationRequest<{can_submit:boolean;errors:string[]}>(draft.id,draft.edit_token,'/validation','GET',undefined,INTERNAL_TEST);if(!check.can_submit){setMessage('Please review: '+check.errors.join(' • '));return;}const response=await registrationRequest<{team_id:string;registration_code:string;submitted_at:string;payment_status:string}>(draft.id,draft.edit_token,'/submit','POST',undefined,INTERNAL_TEST);setSubmittedTeamId(response.team_id);setConfirmation(response);setSubmitted(true);setStep(3);}
    catch(e){setMessage(friendlyError(e));}finally{setBusy(false);}
  }
  async function downloadDocument(kind:'confirmation'|'payment-receipt'){
    if(!draft || !submittedTeamId)return;
    setBusy(true);setMessage('');
    try{
      const headers:Record<string,string>={'X-Registration-Token':draft.edit_token};
      if(INTERNAL_TEST){const session=getSession();if(!session?.access_token)throw new Error('Sign in as Super Admin to download the test confirmation.');headers.Authorization='Bearer '+session.access_token;}
      const response=await fetch(`${API_BASE}/registrations/${draft.id}/${kind}.pdf`,{headers});
      if(!response.ok){const detail=await response.json().catch(()=>null);throw new Error(typeof detail?.detail==='string'?detail.detail:'The document is not available yet.');}
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);const a=document.createElement('a');
      a.href=url;a.download=`${submittedTeamId}-${kind}.pdf`;document.body.appendChild(a);a.click();a.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(e){setMessage(friendlyError(e));}finally{setBusy(false);}
  }
  if(!open)return null;
  const edition=config?.edition;
  const min=Math.max(1,Number(edition?.min_team_size)||1),max=Math.max(min,Number(edition?.max_team_size)||min);
  return <div className="miih-modal-backdrop" >
    <section ref={modalRef} tabIndex={-1} className="miih-registration-modal" role="dialog" aria-modal="true" aria-labelledby="miih-register-heading">
      <header className="miih-modal-top"><div><p className="eyebrow">MADE IN INDIA • TEAM ENTRY</p><h2 id="miih-register-heading">Register your team<span className="miih-accent">.</span></h2><p>One leader. One registration. Every team member included.</p></div><button className="miih-icon-button" type="button" onClick={onClose} aria-label="Close registration">×</button></header>
      {loadState==='loading'?<div className="miih-modal-body miih-loading-notice" role="status" aria-live="polite"><span className="miih-loading-spinner" aria-hidden="true"/><p>Loading registration details…</p><small>If the service is unavailable, you can retry shortly.</small></div>:loadState!=='loaded'||!config?<div className="miih-modal-body miih-disabled-notice">
          <h3>{loadState==='error'?'Registration Details Unavailable':registrationNotice.title}</h3>
          <p>{loadState==='error'?'We are currently unable to retrieve the registration information. Please try again shortly. If the issue continues, contact the ZeAI organizing team for assistance.':registrationNotice.description}</p>
          {loadState==='unpublished'&&<p className="miih-notice-closing">{registrationNotice.closing}</p>}
          {loadState==='error'&&<p role="alert" className="miih-error">{message}</p>}
          <div className="miih-recovery-actions">{loadState==='error'&&<button className="button button-primary" type="button" onClick={()=>setReloadKey(k=>k+1)}>Try again</button>}<button className={loadState==='error'?'miih-secondary-btn':'button button-primary'} type="button" onClick={onClose}>{loadState==='error'?'Close':registrationNotice.button}</button></div>
        </div>:
      <>
        {!config.registration_enabled && <div className="miih-status-alert"><strong>Registration is not yet open.</strong> You can review the steps, but submissions will be available when the event registration opens.</div>}
        <nav className="miih-progress" aria-label="Registration progress">{['Team','Questions',paymentFree?'Confirm':'Payment','Done'].map((label,i)=><span className={step===i?'active':step>i?'done':''} key={label}><b>{i+1}</b> {label}</span>)}</nav>
        <div className="miih-modal-body">
        {step===0 && <div className="miih-reg-section"><h3>Team details</h3><p className="miih-muted">Team size is configured by the organizer ({min}–{max} members, including the leader).</p>
          <div className="miih-two-col"><div className="miih-form-field"><label>{questionLabel('team_name','Team name')} <span className="miih-required">*</span></label><input value={team.team_name} onChange={e=>setTeam({...team,team_name:e.target.value})} placeholder="Enter your team name"/></div>
          <div className="miih-form-field"><label>Select domain <span className="miih-required">*</span></label><select value={team.domain_id} onChange={e=>setTeam({...team,domain_id:e.target.value})}><option value="">Select a domain</option>{config.domains.map((d:Domain)=><option key={d.id} value={d.id}>{d.domain_name}</option>)}</select></div>
          </div>
          <div className="miih-form-field"><label>{questionLabel('investor_pitch_interest','Are you interested in an investor pitch?')} {must('investor_pitch_interest')&&<span className="miih-required">*</span>}</label><div className="miih-choice-row"><label><input type="radio" checked={team.investor_pitch_interest===true} onChange={()=>selectPitchInterest(true)}/> Yes</label><label><input type="radio" checked={team.investor_pitch_interest===false} onChange={()=>selectPitchInterest(false)}/> No</label></div></div>
          <div className="miih-member-heading"><h3>Team members</h3><span>{members.length} members</span></div>
          {members.map((m,i)=><div className="miih-member-card" key={i}><div className="miih-member-title"><strong>{i===0?'Team Leader':`Member ${i+1}`}</strong>{i>=min&&<button type="button" onClick={()=>setMembers(a=>a.filter((_,j)=>j!==i))}>Remove</button>}</div><div className="miih-three-col">{(['full_name','email','mobile'] as const).map(k=><div key={k} className="miih-form-field"><label>{questionLabel(k,k==='full_name'?'Full name':k==='email'?'Email':'Mobile')} <span className="miih-required">*</span></label><input type={k==='email'?'email':k==='mobile'?'tel':'text'} value={m[k]} onChange={e=>setMember(i,k,e.target.value)} placeholder={k==='full_name'?'Full name':k==='email'?'name@example.com':'Mobile number'}/></div>)}</div></div>)}
          {duplicateEmails&&<p role="alert" className="miih-error">Each member must have a different email address.</p>}{members.length<max&&<button type="button" className="miih-secondary-btn" onClick={()=>setMembers(m=>m.length<max?[...m,emptyMember()]:m)}>+ Add Member {members.length+1} (optional)</button>}
          <div className="miih-modal-actions"><span className="miih-muted">* Required fields</span><button disabled={!teamValid||busy||!config.registration_enabled} type="button" className="button button-primary" onClick={saveTeam}>{busy?'Saving…':'Save & continue →'}</button></div>
        </div>}
        {step===1&&<div className="miih-reg-section"><h3>Registration questions</h3><p className="miih-muted">Questions and required fields are controlled by the hackathon administrator. Each member has their own personal details.</p>
          {details.map((s:FormSection)=>{const visible=s.questions.filter(q=>!isPitchDependent(q)||team.investor_pitch_interest===true);if(!visible.length)return null;return <section className="miih-question-section" key={s.id}><h4>{s.title}</h4>{s.description&&<p>{s.description}</p>}{visible.map((q:Question)=>(q.answer_scope==='MEMBER'||q.answer_scope==='LEADER')?Array.from({length:q.answer_scope==='LEADER'?1:members.length},(_,i)=><div key={`${q.id}-${i}`}><small className="miih-member-tag">{i===0?'Leader':`Member ${i+1}`}: {members[i]?.full_name||'Participant'}</small><QuestionField question={q} value={answers[fieldKey(q,i+1)]} onChange={v=>setAnswer(q,i+1,v)} onFile={f=>uploadAnswer(q,i+1,f)} busy={busy} uploadState={uploads[fieldKey(q,i+1)]} onRemove={()=>removeUpload(q,i+1)}/></div>):<QuestionField key={q.id} question={q} value={answers[fieldKey(q)]} onChange={v=>setAnswer(q,undefined,v)} onFile={f=>uploadAnswer(q,undefined,f)} busy={busy} uploadState={uploads[fieldKey(q)]} onRemove={()=>removeUpload(q)}/>)}</section>;})}
          <div className="miih-modal-actions"><button type="button" className="miih-secondary-btn" onClick={()=>setStep(0)}>← Back to team</button><button type="button" className="button button-primary" disabled={busy||!config.registration_enabled} onClick={saveAnswers}>{busy?'Saving…':'Save & continue →'}</button></div>
        </div>}
        {step===2&&<form className="miih-reg-section" onSubmit={submit}>
          <h3>{paymentFree?'Review & submit test registration':'Payment & registration confirmation'}</h3>
          <p className="miih-muted">{paymentFree?'This is the authorized payment-free test edition. No Razorpay transaction or screenshot is needed.':'Step 1: Open the official Razorpay payment page. Step 2: Complete payment there and return to this registration tab. Step 3: Enter the transaction ID and upload your payment screenshot. Step 4: Save the proof and submit.'}</p>
          {!paymentFree&&<>
            <div className="miih-payment-card">
              <span>Registration fee</span>
              <strong>{config.payment.fee_amount!=null?'₹'+Number(config.payment.fee_amount).toLocaleString('en-IN'):'Not configured'}</strong>
              {config.payment.payment_enabled&&config.payment.payment_url
                ? <a href={config.payment.payment_url} className="button button-primary" target="_blank" rel="noopener noreferrer" onClick={()=>{setPaymentLinkOpened(true);setPaymentEvidenceVisible(true);setMessage('');}}>{paymentLinkOpened?'Reopen Razorpay payment ↗':(config.payment.button_label||'Pay now with Razorpay')+' ↗'}</a>
                : <p role="alert">Online payment is not enabled for this edition. Please contact the organizer.</p>}
            </div>
            {config.payment.payment_enabled&&config.payment.payment_url&&<>
              {!paymentEvidenceVisible&&<div className="miih-payment-guidance">
                <p>Already completed your payment in another tab or on your phone?</p>
                <button type="button" className="miih-secondary-btn" onClick={()=>{setPaymentEvidenceVisible(true);setMessage('');}}>I have paid — enter payment details →</button>
              </div>}
              {paymentEvidenceVisible&&<section className="miih-payment-evidence" aria-label="Payment details and proof">
                <h4>Return from Razorpay? Submit your payment proof</h4>
                <p className="miih-muted">Payment details are manually reviewed. Uploading evidence does not mean the payment has been verified.</p>
                <div className="miih-two-col">
                  <div className="miih-form-field">
                    <label htmlFor="miih-transaction-id">Razorpay payment / transaction ID <span className="miih-required">*</span></label>
                    <input id="miih-transaction-id" value={transactionId} disabled={paymentRecorded||busy} onChange={e=>{setTransactionId(e.target.value);setMessage('');}} placeholder="Enter the ID shown on your payment receipt" autoComplete="off" />
                  </div>
                  <div className="miih-form-field">
                    <label>Payment screenshot <span className="miih-required">*</span></label>
                    <RegistrationUpload state={proofUpload} stored={Boolean(proofFile)} photo purpose="payment" disabled={busy||paymentRecorded} onSelect={f=>void uploadProof(f)} onRemove={()=>{setProofFile('');setProofUpload(undefined);setPaymentRecorded(false);setMessage('');}} />
                  </div>
                </div>
                {!paymentRecorded&&<button type="button" className="miih-secondary-btn" disabled={!proofFile||transactionId.trim().length<4||busy} onClick={saveProof}>{busy?'Saving…':'Save transaction ID & screenshot'}</button>}
                {paymentRecorded&&<p role="status" className="miih-uploaded">✓ Payment evidence saved — Pending Verification. You can now submit your registration.</p>}
              </section>}
            </>}
          </>}
          <div className="miih-modal-actions"><button type="button" className="miih-secondary-btn" onClick={()=>{setMessage('');setStep(1);}}>← Back to questions</button><button type="submit" className="button button-primary" disabled={!canSubmit}>{busy?'Submitting…':'Submit team registration →'}</button></div>
        </form>}
        {step===3&&submitted&&<section className="miih-success" aria-label="Registration confirmation">
          <div className="miih-success-heading">
            <div className="miih-success-icon" aria-hidden="true">✓</div>
            <div className="miih-success-heading-text">
              <p className="miih-success-eyebrow">REGISTRATION CONFIRMED</p>
              <h3>Team registration submitted!</h3>
              <p>{paymentFree?'Your internal test registration has been saved. No payment is required.':'Your registration was received successfully. The organizing team will review your details and payment evidence.'}</p>
            </div>
          </div>
          <div className="miih-success-reference">
            <span>YOUR TEAM ID</span>
            <strong>{submittedTeamId||draft?.registration_code||'Confirmation saved'}</strong>
            <small>Keep this ID for any communication about your registration.</small>
          </div>
          <dl className="miih-success-details">
            <div><dt>Team name</dt><dd>{team.team_name}</dd></div>
            <div><dt>Registration reference</dt><dd>{confirmation.registration_code||draft?.registration_code||'—'}</dd></div>
            <div><dt>Hackathon domain</dt><dd>{config.domains.find(d=>d.id===team.domain_id)?.domain_name||'—'}</dd></div>
            <div><dt>Submitted on</dt><dd>{confirmation.submitted_at?new Date(confirmation.submitted_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'}</dd></div>
            <div><dt>Members registered</dt><dd>{members.length} (including team leader)</dd></div>
            <div><dt>Payment status</dt><dd><span className="miih-success-payment-badge">{paymentFree?'Not required':'Pending verification'}</span></dd></div>
            {!paymentFree&&<>
              <div><dt>Registration fee</dt><dd>{config.payment.currency||'INR'} {Number(config.payment.fee_amount||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</dd></div>
              <div><dt>Transaction ID</dt><dd className="miih-success-transaction">{transactionId||'—'}</dd></div>
            </>}
          </dl>
          {!paymentFree&&<p className="miih-success-note">Your payment evidence has been received, but payment is not yet verified. This confirmation is not a paid invoice.</p>}
          <div className="miih-success-actions">
            <button className="button button-primary" disabled={busy} type="button" onClick={()=>void downloadDocument('confirmation')}>{busy?'Preparing PDF…':'↓ Download confirmation PDF'}</button>
            <button className="miih-secondary-btn" type="button" onClick={onClose}>Close</button>
          </div>
          {message&&<p className="miih-error" role="alert">{message}</p>}
        </section>}
        {message&&step!==3&&<p className={message.toLowerCase().includes('recorded')?'miih-uploaded':'miih-error'} role="alert">{message}</p>}
        </div>
      </>}
    </section>
  </div>;
}
