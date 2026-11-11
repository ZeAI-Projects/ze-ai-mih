import { ThemedDateTime } from '../ThemedDateTime';
import { ProblemStatementsPanel } from '../ProblemStatementsPanel';
import { adminConfirm, adminPrompt, adminFormDialog } from '../AdminDialogs';
import { Icon } from '@/components/ui/Icon';
import { applyCmsItem } from '@/features/cms/PublishedContentBridge';
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {patch,post,put,qs,upload,type CmsSlot,type CmsRevision,type Domain,type Edition,type FormSection,type Question,type JsonRecord} from '@/lib/miihApi';
import {AdminIconButton,Badge,DataTable,Empty,ErrorMessage,Loading,PageHeader,Panel,useAdmin,useResource} from '../AdminPortal';

type Row=Record<string,unknown>;
const pages=['HOME','ABOUT','GALLERY','REGISTER','GLOBAL'];
const first=(v:unknown)=>String(v??'');
const questionTypes=[
 {value:'TEXT',label:'Short answer'},
 {value:'TEXTAREA',label:'Long answer'},
 {value:'EMAIL',label:'Email address'},
 {value:'PHONE',label:'Phone number'},
 {value:'URL',label:'Website link'},
 {value:'DATE',label:'Date'},
 {value:'NUMBER',label:'Number'},
 {value:'BOOLEAN',label:'Yes or no'},
 {value:'SINGLE_SELECT',label:'Choose one option'},
 {value:'MULTI_SELECT',label:'Choose multiple options'},
 {value:'IMAGE',label:'Image upload'},
 {value:'FILE',label:'File upload'},
 {value:'DERIVED',label:'Calculated value'},
] as const;
const answerScopes=[
 {value:'TEAM',label:'Whole team'},
 {value:'MEMBER',label:'Each team member'},
 {value:'LEADER',label:'Team leader'},
 {value:'PITCH',label:'Pitch details'},
] as const;
function localDateTime(value:unknown){if(!value)return '';const date=new Date(String(value));if(Number.isNaN(date.getTime()))return '';return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function useEditions(){const {data,setData,error,loading,reload}=useResource<Edition[]>('/admin/editions',[]);const [editionId,setEditionId]=useState('');useEffect(()=>{if(!editionId&&data.length)setEditionId((data.find(e=>e.edition_code==='MIIH_UPCOMING')||data[0]).id);},[editionId,data]);return {editions:data,setEditions:setData,editionId,setEditionId,edition:data.find(e=>e.id===editionId),error,loading,reload};}
function EditionSelect({editions,editionId,onChange}:{editions:Edition[];editionId:string;onChange:(v:string)=>void}){
 return <label className="miih-admin-inline-label">Hackathon
  <select value={editionId} onChange={e=>onChange(e.target.value)}>
   {editions.filter(e=>e.edition_code==='MIIH_UPCOMING').map(e=><option key={e.id} value={e.id}>Made In India Hackathon</option>)}
  </select>
 </label>;
}
export function CmsEditorPage({forcePage}:{forcePage?:'GALLERY'}){
 const {can,superAdmin,notify}=useAdmin();const [page,setPage]=useState(forcePage||new URLSearchParams(window.location.search).get('page')||'HOME');const [term,setTerm]=useState('');const [selected,setSelected]=useState<CmsSlot|null>(null);const [revision,setRevision]=useState<CmsRevision|null>(null);const [text,setText]=useState('');const [link,setLink]=useState('');const [alt,setAlt]=useState('');const [position,setPosition]=useState(0);const [assetId,setAssetId]=useState('');const [jsonText,setJsonText]=useState('{}');const [visible,setVisible]=useState(true);const [busy,setBusy]=useState(false);const [selector,setSelector]=useState('');const pickerFrame=useRef<HTMLIFrameElement|null>(null);const [pickerOn,setPickerOn]=useState(false);
 const {data:slots,loading,error}=useResource<CmsSlot[]>(`/admin/cms/slots${qs({page})}`,[]);
 const preview=useResource<CmsRevision[]>(`/admin/cms/preview/${page}`,[]);
 const filtered=useMemo(()=>slots.filter(s=>(s.editor_label+' '+s.section_key+' '+s.slot_key).toLowerCase().includes(term.toLowerCase())),[slots,term]);
 useEffect(()=>{if(selected){const r=preview.data.find(r=>r.slot_id===selected.id)||null;setRevision(r);setText(r?.text_value||'');setLink(r?.link_url||'');setAlt(r?.alt_text||'');setAssetId(r?.asset_file_id||'');setJsonText(JSON.stringify(r?.content_json||{},null,2));setVisible(r?.is_visible!==false);setPosition(r?.display_order||0);setSelector(typeof r?.content_json?.target_selector==='string'?r.content_json.target_selector:'');}},[selected,preview.data]);
 const pickElement=()=>{const frame=pickerFrame.current;if(!frame?.contentDocument)return;const documentInFrame=frame.contentDocument;
  const handler=(ev:MouseEvent)=>{ev.preventDefault();ev.stopPropagation();const e=ev.target as Element;const node=e.closest('h1,h2,h3,h4,p,a,span,img,video,button,li')||e;
    const path:string[]=[];let n:Element|null=node;
    while(n && n.tagName.toLowerCase()!=='html') {if(n.id){path.unshift('#'+CSS.escape(n.id));break;}const parent:Element|null=n.parentElement;
      const siblings=parent?Array.from(parent.children).filter(child=>child.tagName===n?.tagName):[];
      const index=siblings.indexOf(n)+1;path.unshift(n.tagName.toLowerCase()+(siblings.length>1?`:nth-of-type(${index})`:''));n=parent;}
    setSelector(path.join(' > '));setPickerOn(false);documentInFrame.removeEventListener('click',handler,true);
  };
  documentInFrame.addEventListener('click',handler,true);setPickerOn(true);
  window.setTimeout(()=>{documentInFrame.removeEventListener('click',handler,true);setPickerOn(false);},30000);
 };
 async function uploadCms(file:File){setBusy(true);try{const r=await upload<{id:string}>('/admin/cms/upload',file,true);setAssetId(r.id);notify('Media uploaded. Save the draft to attach it to this content slot.');}catch(e){notify(e instanceof Error?e.message:'Media upload failed');}finally{setBusy(false);}}
 async function saveDraft(){if(!selected)return;setBusy(true);try{let content_json:JsonRecord={};if(selected.slot_type==='JSON')content_json=JSON.parse(jsonText) as JsonRecord;if(selector.trim())content_json.target_selector=selector.trim();
 const r=await post<{id:string}>(`/admin/cms/slots/${selected.id}/revisions`,{text_value:text||null,link_url:link||null,alt_text:alt||null,asset_file_id:assetId||null,content_json,display_order:position,is_visible:visible},true);
 notify(`Draft saved for ${selected.editor_label}.`);setRevision(prev=>prev?{...prev,revision_id:r.id,status:'DRAFT'}:{slot_id:selected.id,section_key:selected.section_key,slot_key:selected.slot_key,slot_type:selected.slot_type,editor_label:selected.editor_label,revision_id:r.id,status:'DRAFT'});preview.reload();
 }catch(e){notify(e instanceof Error?e.message:'Could not save draft');}finally{setBusy(false);}}
 async function publish(){if(!revision?.revision_id)return;setBusy(true);try{await post(`/admin/cms/revisions/${revision.revision_id}/publish`,{},true);notify('Published. Refresh the public preview to see the content.');preview.reload();}catch(e){notify(e instanceof Error?e.message:'Publish failed');}finally{setBusy(false);}}
 return <><PageHeader eyebrow="CONTENT MANAGEMENT" title={forcePage?'Gallery & Media':'Website Editor'} description="Edit existing content locations, upload images and videos, save drafts and preview changes. Publishing is reserved for Super Admin." actions={<a className="miih-admin-outline" href="/admin/preview">Open site preview ↗</a>}/>
 <div className="miih-admin-editor-layout"><Panel title="Content locations" toolbar={<span className="miih-muted-admin">{filtered.length} items</span>}><div className="miih-editor-filters">{!forcePage&&<select aria-label="Choose page" value={page} onChange={e=>{setPage(e.target.value);setSelected(null);}}>{pages.map(p=><option key={p}>{p}</option>)}</select>}<input placeholder="Find a heading, photo or field…" value={term} onChange={e=>setTerm(e.target.value)}/></div><ErrorMessage message={error}/>{loading?<Loading/>:<div className="miih-slot-list">{filtered.map(s=><button className={`miih-slot-row ${selected?.id===s.id?'selected':''}`} type="button" key={s.id} onClick={()=>setSelected(s)}><small>{s.section_key} / {s.slot_type}</small><strong>{s.editor_label}</strong><span>{s.published_revision?'Published v'+s.published_revision:'Not published'}{s.latest_draft_revision?' · Draft':''}</span></button>)}</div>}</Panel>
 <Panel title={selected?selected.editor_label:'Select content to edit'}>{selected?<div className="miih-editor-form"><p className="miih-muted-admin">{selected.editor_help||'Existing site styling and layout will not be changed.'}</p><div className="miih-admin-tally"><Badge value={revision?.status||'NO REVISION'}/><span>{selected.slot_key}</span></div><div className="miih-picker-widget"><label>Target on existing site (CSS selector)<input value={selector} onChange={e=>setSelector(e.target.value)} placeholder="Pick a visible element below"/></label><p className="miih-muted-admin">Click “Pick element”, then click any text, image or video in the preview. This binds the CMS slot without editing the original page component.</p><button className="miih-admin-outline" type="button" onClick={pickElement}>{pickerOn?'Choose an element…':'◉ Pick element from page'}</button><iframe ref={pickerFrame} title="Choose website content element" src={selected.page_key==='HOME'?'/':selected.page_key==='GLOBAL'?'/':`/${selected.page_key.toLowerCase()}`}/></div>
 {['TEXT','JSON','LINK'].includes(selected.slot_type)&&<label>{selected.slot_type==='JSON'?'JSON content':'Text content'}{selected.slot_type==='JSON'?<textarea rows={9} spellCheck={false} value={jsonText} onChange={e=>setJsonText(e.target.value)}/>:<textarea rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder="Enter replacement text"/>}</label>}
 {(['LINK','TEXT','JSON','IMAGE','VIDEO','GALLERY_ITEM','BANNER'].includes(selected.slot_type))&&<label>Link URL (optional)<input type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://..."/></label>}
 {(['IMAGE','VIDEO','GALLERY_ITEM','BANNER'].includes(selected.slot_type))&&<><label>Upload {selected.slot_type==='VIDEO'?'MP4/WebM video':'image, video or document'}<input type="file" accept={selected.slot_type==='VIDEO'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp,video/mp4,video/webm,application/pdf'} disabled={busy||!can(selected.page_key==='GALLERY'?'GALLERY_EDIT':'SITE_CONTENT_EDIT')} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadCms(f);}}/></label><label>Asset ID (from upload)<input value={assetId} readOnly placeholder="Upload an asset"/></label><label>Alt text or caption<input value={alt} onChange={e=>setAlt(e.target.value)}/></label><small className="miih-muted-admin">Uploads use Supabase Storage. MP4/WebM requires the optional Storage bucket migration and project upload limits.</small></>}
 <label>Display order (gallery/media and lists)<input type="number" value={position} onChange={e=>setPosition(Number(e.target.value))}/></label><label className="miih-toggle-label"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Visible when published</label>
 <div className="miih-admin-row"><button className="miih-admin-primary" disabled={busy||!can(selected.page_key==='GALLERY'?'GALLERY_EDIT':'SITE_CONTENT_EDIT')} onClick={saveDraft}>Save new draft</button>{superAdmin&&revision?.status==='DRAFT'&&<button className="miih-admin-outline" disabled={busy} onClick={publish}>Publish draft</button>}</div><small className="miih-muted-admin">Published changes are stored in Supabase. Only supported bound site elements are replaced visually; unbound slots remain editable records until mapped.</small></div>:<Empty message="Choose a content slot on the left to edit. All registered text, image, video and gallery items are listed."/>}</Panel></div></>}
export function FrontendPreviewPage(){
 const [page,setPage]=useState('HOME');const [showDrafts,setShowDrafts]=useState(true);const [screen,setScreen]=useState<'desktop'|'mobile'>('desktop');const [generation,setGeneration]=useState(0);const [frameLoaded,setFrameLoaded]=useState(0);
 const frame=useRef<HTMLIFrameElement|null>(null);
 const preview=useResource<CmsRevision[]>(`/admin/cms/preview/${page}`,[]);
 const route:Record<string,string>={HOME:'/',ABOUT:'/about',GALLERY:'/gallery',REGISTER:'/register',GLOBAL:'/'};
 // Draft canvas disables the public CMS bridge in its own iframe. Published canvas uses the real published page.
 const src=route[page]+(showDrafts?'?miih_preview=1':'');
 useEffect(()=>{
   if(!showDrafts||preview.loading||preview.error)return;
   const documentInFrame=frame.current?.contentDocument;if(!documentInFrame)return;
   let pending=false;
   const apply=()=>{pending=false;for(const r of preview.data){if(!r.revision_id)continue;applyCmsItem({section_key:r.section_key,slot_key:r.slot_key,slot_type:r.slot_type,text_value:r.text_value,asset_url:r.asset_url,link_url:r.link_url,alt_text:r.alt_text,content_json:r.content_json},page,documentInFrame);}};
   const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(apply);};
   const observer=new MutationObserver(schedule);
   observer.observe(documentInFrame.documentElement,{subtree:true,childList:true});
   schedule();
   const timer=window.setTimeout(()=>observer.disconnect(),5000);
   return()=>{window.clearTimeout(timer);observer.disconnect();};
 },[page,showDrafts,preview.data,preview.loading,preview.error,generation,frameLoaded]);
 return <><PageHeader eyebrow="PREVIEW / NON-PUBLIC" title="Frontend Preview" description="Review the actual website. Toggle between unpublished draft content and the public published page." actions={<div className="miih-admin-row"><a className="miih-admin-primary" href={`/admin/editor?page=${page}`}>✎ Edit this page</a><a className="miih-admin-outline" href={route[page]} target="_blank" rel="noopener noreferrer">Open public page ↗</a></div>}/>
 <Panel title="Website canvas" toolbar={<div className="miih-admin-row"><select aria-label="Preview page" value={page} onChange={e=>setPage(e.target.value)}>{pages.map(p=><option key={p}>{p}</option>)}</select><label className="miih-toggle-label"><input type="checkbox" checked={showDrafts} onChange={e=>setShowDrafts(e.target.checked)}/> Preview drafts</label><button className="miih-admin-outline" type="button" aria-pressed={screen==='mobile'} onClick={()=>setScreen(s=>s==='desktop'?'mobile':'desktop')}>{screen==='mobile'?'Desktop view':'Mobile view'}</button><button type="button" className="miih-admin-outline" onClick={()=>{preview.reload();setGeneration(v=>v+1);}}>Refresh ↻</button></div>}>
  {preview.error&&<ErrorMessage message={preview.error}/>}
  <p className="miih-muted-admin">{showDrafts?'Draft preview: visible only to approved administrators.':'Published view: shows what the live website currently renders.'}</p>
  <div className={`miih-preview-frame miih-preview-${screen}`}><iframe ref={frame} onLoad={()=>setFrameLoaded(v=>v+1)} key={`${page}-${showDrafts}-${generation}`} title={`${page} ${showDrafts?'draft':'published'} website preview`} src={src}/></div>
 </Panel><details className="miih-admin-changes"><summary>Unpublished changes ({preview.data.filter(p=>p.status==='DRAFT').length})</summary><p>Content without a bound target selector remains in the editor and cannot visually change the page until mapped.</p>{preview.loading?<Loading/>:<div className="miih-preview-change-list">{preview.data.filter(p=>p.status==='DRAFT').map(p=><div className="miih-preview-change" key={p.slot_id}><b>{p.editor_label}</b><span>{p.text_value||p.asset_url||'Media or visibility change'}</span><a href={`/admin/editor?page=${page}`}>Edit ↗</a></div>)}{!preview.data.some(p=>p.status==='DRAFT')&&<Empty message="No unpublished changes for this page."/>}</div>}</details></>;
}
/** Visual-only preview of the selected form version; does not create registration drafts. */
function FormVersionPreview({sections}:{sections:FormSection[]}){
 const clean=(label:string)=>label.replace(/^\s*(?:Q(?:uestion)?\s*)?\d+\s*[.):-]\s*/i,'').trim();
 return <details className="miih-form-preview"><summary>Preview participant questions as a form</summary>
  <p className="miih-muted-admin">Read-only preview; registration validation and payment are tested through the protected registration flow.</p>
  <div className="miih-form-preview-content"><fieldset disabled>{sections.filter(s=>s.questions.some(q=>q.is_active!==false)).map(s=><section className="miih-form-preview-section" key={s.id}><h3>{s.title}</h3><p>{s.description}</p>
  {s.questions.filter(q=>q.is_active!==false&&q.input_type!=='DERIVED'&&!['participant_category','source_team_id','payment_transaction_id','payment_proof'].includes(q.field_key)).map(q=><div className="miih-form-preview-field" key={q.id}><label>{clean(q.question_label)}{q.is_required&&<span aria-label="required"> *</span>}</label>
    {q.input_type==='BOOLEAN'?<div className="miih-admin-row"><label><input type="radio" name={q.id}/> Yes</label><label><input type="radio" name={q.id}/> No</label></div>:
     q.input_type==='TEXTAREA'?<textarea placeholder={q.placeholder||'Your answer'} rows={3}/>:
     q.input_type==='SINGLE_SELECT'?<select defaultValue=""><option value="">Select one</option>{q.options?.map(o=><option key={o.option_value} value={o.option_value}>{o.option_label}</option>)}</select>:
     q.input_type==='MULTI_SELECT'?<div className="miih-admin-row">{q.options?.map(o=><label key={o.option_value}><input type="checkbox"/> {o.option_label}</label>)}</div>:
     <input type={q.input_type==='EMAIL'?'email':q.input_type==='DATE'?'date':q.input_type==='NUMBER'?'number':q.input_type==='URL'?'url':q.input_type==='IMAGE'||q.input_type==='FILE'?'file':'text'} accept={q.input_type==='IMAGE'?'image/*':undefined} placeholder={q.placeholder||'Your answer'}/>}
    <small>{answerScopes.find(scope=>scope.value===q.answer_scope)?.label||q.answer_scope}</small>
  </div>)}</section>)}</fieldset></div></details>;
}
export function FormEditorPage(){const {can,superAdmin,notify}=useAdmin();const {editions,editionId,setEditionId}=useEditions();const versions=useResource<{id:string;status:string;version_number:number;name:string}[]>(editionId?`/admin/forms/editions/${editionId}/versions`:null,[]);const [versionId,setVersionId]=useState('');useEffect(()=>{if(versions.data.length&&!versions.data.some(v=>v.id===versionId))setVersionId(versions.data[0].id);},[versions.data,versionId]);const form=useResource<{id:string;status:string;sections:FormSection[]}>(versionId?`/admin/forms/versions/${versionId}`:null,{id:'',status:'DRAFT',sections:[]});const [selected,setSelected]=useState<Question|null>(null);const [label,setLabel]=useState('');const [placeholder,setPlaceholder]=useState('');const [description,setDescription]=useState('');const [inputType,setInputType]=useState<Question['input_type']>('TEXT');const [answerScope,setAnswerScope]=useState<Question['answer_scope']>('TEAM');const [required,setRequired]=useState(true);const [active,setActive]=useState(true);const [order,setOrder]=useState(0);const [busy,setBusy]=useState(false);const [optionLabel,setOptionLabel]=useState('');
 useEffect(()=>{if(selected){setLabel(selected.question_label);setPlaceholder(selected.placeholder||'');setDescription(selected.description||'');setInputType(selected.input_type);setAnswerScope(selected.answer_scope);setRequired(selected.is_required);setActive(selected.is_active!==false);setOrder(selected.display_order);}},[selected]);const editable=form.data.status==='DRAFT';
 const pendingQuestionKey=useRef<string|null>(null);
 useEffect(()=>{if(form.data.id===versionId&&pendingQuestionKey.current){const question=form.data.sections.flatMap(s=>s.questions).find(q=>q.field_key===pendingQuestionKey.current);if(question){setSelected(question);pendingQuestionKey.current=null;}}},[form.data,versionId]);
 async function clone(){if(!editionId||busy)return;pendingQuestionKey.current=selected?.field_key||null;setBusy(true);try{const r=await post<{id:string;version_number:number;status:string}>(`/admin/forms/editions/${editionId}/clone`,{},true);versions.setData(items=>[{...r,name:`MIIH Form v${r.version_number}`},...items]);setVersionId(r.id);setSelected(null);versions.reload();notify('Editable draft created. Save your question changes, then publish this form.');}catch(e){notify(e instanceof Error?e.message:'Could not clone form');}finally{setBusy(false);}}
 function editQuestions(){const draft=versions.data.find(v=>v.status==='DRAFT');if(draft){pendingQuestionKey.current=selected?.field_key||null;setVersionId(draft.id);setSelected(null);}else void clone();}
 async function saveQuestion(){if(!selected||busy)return;setBusy(true);try{const changes={question_label:label,placeholder,description,input_type:inputType,answer_scope:answerScope,is_required:required,is_active:active,display_order:order};await patch(`/admin/forms/questions/${selected.id}`,changes,true);setSelected(current=>current?{...current,...changes}:current);form.reload();notify('Question saved in draft version.');}catch(e){notify(e instanceof Error?e.message:'Could not edit question');}finally{setBusy(false);}}
 async function addOption(){if(!selected||!optionLabel.trim()||busy)return;const base=optionLabel.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,145)||'option';const values=new Set(selected.options.map(option=>option.option_value));let value=base;for(let suffix=2;values.has(value);suffix++)value=`${base.slice(0,145-String(suffix).length)}_${suffix}`;setBusy(true);try{const saved=await put<{option_value:string;option_label:string;display_order:number;is_active:boolean}>(`/admin/forms/questions/${selected.id}/options`,{option_value:value,option_label:optionLabel.trim(),display_order:selected.options?.length||0,is_active:true},true);setSelected(current=>current?{...current,options:[...current.options.filter(option=>option.option_value!==saved.option_value),saved]}:current);form.reload();setOptionLabel('');notify('Answer choice saved.');}catch(e){notify(e instanceof Error?e.message:'Answer choice could not be saved.');}finally{setBusy(false);}}
 async function changeOption(option:{option_value:string;option_label:string;display_order?:number;is_active?:boolean},enabled:boolean){if(!selected||busy)return;setBusy(true);try{await put(`/admin/forms/questions/${selected.id}/options`,{...option,display_order:option.display_order||0,is_active:enabled},true);setSelected(current=>current?{...current,options:current.options.map(item=>item.option_value===option.option_value?{...item,is_active:enabled}:item)}:current);form.reload();notify('Option updated.');}catch(e){notify(e instanceof Error?e.message:'Option update failed');}finally{setBusy(false);}}
 async function deleteQuestion(){if(!selected||busy||!await adminConfirm(`Remove “${selected.question_label}” from this draft? It will be hidden after you publish the draft. Existing registrations can still submit without answering it once the updated form is published.`, 'Delete question', true))return;setBusy(true);try{await patch(`/admin/forms/questions/${selected.id}`,{is_active:false},true);form.reload();setSelected(null);notify('Question removed from the draft. Publish the draft to apply this change.');}catch(e){notify(e instanceof Error?e.message:'Could not delete question');}finally{setBusy(false);}}
 async function deleteOption(option:{option_value:string;option_label:string;display_order?:number;is_active?:boolean}){if(!selected||busy||!await adminConfirm(`Remove “${option.option_label}” from this draft?`, 'Delete option', true))return;setBusy(true);try{await put(`/admin/forms/questions/${selected.id}/options`,{...option,display_order:option.display_order||0,is_active:false},true);setSelected(current=>current?{...current,options:current.options.map(item=>item.option_value===option.option_value?{...item,is_active:false}:item)}:current);form.reload();notify('Option removed from the draft.');}catch(e){notify(e instanceof Error?e.message:'Could not delete option');}finally{setBusy(false);}}
 async function addQuestion(sectionId:string){
  const values=await adminFormDialog('Add a registration question',[
    {key:'question_label',label:'What should participants be asked?',required:true},
    {key:'description',label:'Help text shown under the question (optional)',multiline:true},
    {key:'input_type',label:'How should they answer?',value:'Short answer',options:questionTypes.filter(type=>type.value!=='DERIVED').map(type=>type.label),required:true},
    {key:'answer_scope',label:'Who should answer?',value:'Whole team',options:answerScopes.map(scope=>scope.label),required:true},
    {key:'required',label:'Is an answer required?',value:'Required',options:['Required','Optional'],required:true},
  ]);
  if(!values)return;
  const type=questionTypes.find(item=>item.label===values.input_type);
  const scope=answerScopes.find(item=>item.label===values.answer_scope);
  if(!type||!scope){notify('Choose a valid answer format and audience.');return;}
  const rawKey=values.question_label.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,89);
  const baseKey=rawKey.length<2?`${rawKey||'question'}_q`:rawKey;
  const keys=new Set(form.data.sections.flatMap(section=>section.questions.map(question=>question.field_key)));
  let fieldKey=baseKey;
  for(let suffix=2;keys.has(fieldKey);suffix++)fieldKey=`${baseKey.slice(0,88-String(suffix).length)}_${suffix}`;
  setBusy(true);
  try{await post(`/admin/forms/sections/${sectionId}/questions`,{field_key:fieldKey,question_label:values.question_label,description:values.description||null,input_type:type.value,answer_scope:scope.value,is_required:values.required!=='Optional',display_order:999},true);form.reload();notify('Question added to the draft.');}
  catch(e){notify(e instanceof Error?e.message:'Cannot add question');}
  finally{setBusy(false);}
 }
  async function renameVersion(){
  const current=versions.data.find(v=>v.id===versionId);
  if(!current||!(current.status==='DRAFT'?can('FORM_EDIT'):superAdmin))return;
  const name=await adminPrompt('Rename registration form version',current.name,true);
  if(name===null)return;
  const trimmed=name.trim();
  if(trimmed.length<2||trimmed.length>150){notify('Form name must be between 2 and 150 characters.');return;}
  setBusy(true);
  try{
    const updated=await patch<{id:string;name:string;status:string;version_number:number}>(`/admin/forms/versions/${versionId}/name`,{name:trimmed},true);
    versions.setData(items=>items.map(item=>item.id===updated.id?{...item,name:updated.name}:item));
    versions.reload();
    notify('Version name saved. The form and publication state are unchanged.');
  }catch(e){notify(e instanceof Error?e.message:'Version rename failed');}
  finally{setBusy(false);}
 }
async function publishForm(){if(!versionId||!await adminConfirm('Publish this form version? New registrations will use it. Existing registrations keep their saved form version, but questions removed or made optional in this version will no longer block their submission.', 'Publish form'))return;try{await post(`/admin/forms/versions/${versionId}/publish`,{},true);form.reload();versions.reload();notify('Form version published. Removed and optional questions will no longer block existing registrations.');}catch(e){notify(e instanceof Error?e.message:'Publish failed');}}
 return <>
  <PageHeader eyebrow="MADE IN INDIA HACKATHON / FORM BUILDER" title="Registration Form" description="Build and preview the questions participants see. Changes stay in a draft until a Super Admin publishes them."/>
  {versions.data.some(v=>v.status==='DRAFT')&&<Panel title="Your draft is not live yet">
    <p>The published form stays live until you publish this draft. Publishing updates the questions shown to new registrations. Existing registrations keep their saved form version, but questions removed or made optional here will no longer block their submission.</p>
    <p className="miih-muted-admin">{versions.data.filter(v=>v.status==='PUBLISHED').map(v=>`Live form: v${v.version_number} — ${v.name}`).join(' · ')}</p>
    <div className="miih-admin-row">{versions.data.filter(v=>v.status==='DRAFT').map(v=><button key={v.id} className="miih-admin-outline" type="button" onClick={()=>{setVersionId(v.id);setSelected(null);}}>Open draft v{v.version_number} — {v.name}</button>)}</div>
  </Panel>}
  <Panel title="Form version" toolbar={<div className="miih-admin-row">
    <EditionSelect editions={editions} editionId={editionId} onChange={value=>{setEditionId(value);setSelected(null);}}/>
    <label className="miih-admin-inline-label">Version<select aria-label="Select form version" value={versionId} onChange={event=>{setVersionId(event.target.value);setSelected(null);}}>{versions.data.map(version=><option value={version.id} key={version.id}>v{version.version_number} — {version.name} ({version.status==='DRAFT'?'Draft':version.status==='PUBLISHED'?'Live':'Archived'})</option>)}</select></label>
    {can('FORM_EDIT')&&<AdminIconButton icon="add" label="Create new version" disabled={busy||!editionId} onClick={()=>void clone()}/>}
    {(editable?can('FORM_EDIT'):superAdmin)&&<AdminIconButton icon="edit" label="Rename version" disabled={busy||!versionId} onClick={()=>void renameVersion()}/>}
    {superAdmin&&editable&&<button className="miih-admin-primary" type="button" disabled={busy||form.loading} onClick={()=>void publishForm()}>Publish form</button>}
  </div>}>
    <p className="miih-muted-admin">Choose the version to review. A draft can be edited; the live version is read-only and can be copied into a new draft.</p>
  </Panel>
  <FormVersionPreview sections={form.data.sections}/>
  <div className="miih-admin-editor-layout miih-form-editor">
    <div className="miih-form-index">
    <Panel title="Questions and sections">
      <p className="miih-muted-admin">Select a question to edit it. Use the plus button to add a question to its section.</p>
      <ErrorMessage message={form.error}/>
      <div className="miih-form-question-index">
      {form.loading?<Loading/>:form.data.sections.map(section=><section className="miih-form-section-list" key={section.id}>
        <div className="miih-form-section-heading"><div><h3>{section.title}</h3><span>{section.questions.length} {section.questions.length===1?'question':'questions'}</span></div>
          {editable&&can('FORM_EDIT')&&<AdminIconButton icon="add" label={`Add question to ${section.title}`} disabled={busy} onClick={()=>void addQuestion(section.id)}/>}
        </div>
        {section.questions.map(question=><button className={`miih-slot-row ${selected?.id===question.id?'selected':''}`} type="button" key={question.id} onClick={()=>setSelected(question)}>
          <small>{questionTypes.find(type=>type.value===question.input_type)?.label||question.input_type} · {answerScopes.find(scope=>scope.value===question.answer_scope)?.label||question.answer_scope}</small>
          <strong>{question.question_label}</strong>
          <span>{question.is_required?'Required':'Optional'}{question.is_active===false?' · Hidden':''}</span>
        </button>)}
      </section>)}
      </div>
    </Panel>
    </div>
    <div className="miih-form-detail">
    <Panel title={selected?`Question details`:'Edit a question'}>
      {selected?<div className="miih-editor-form">
        <div className="miih-form-editor-heading"><div><p className="miih-muted-admin">{selected.question_label}</p><Badge value={form.data.status}/></div>{editable&&can('FORM_EDIT')&&active&&<AdminIconButton icon="delete" label="Delete question" disabled={busy} onClick={()=>void deleteQuestion()}/>}</div>
        {!editable&&<p className="miih-muted-admin">This form version is read-only. Create or select a draft to make changes.</p>}
        {!editable&&can('FORM_EDIT')&&<button className="miih-admin-outline" type="button" disabled={busy||form.loading} onClick={editQuestions}>Create or open an editable draft</button>}
        <div className="miih-form-question-grid">
          <label className="miih-admin-wide">Question text<textarea value={label} disabled={!editable||busy} onChange={event=>setLabel(event.target.value)}/></label>
          <label>Answer format<select value={inputType} disabled={!editable||busy} onChange={event=>setInputType(event.target.value)}>{questionTypes.map(type=><option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
          <label>Who answers?<select value={answerScope} disabled={!editable||busy} onChange={event=>setAnswerScope(event.target.value as Question['answer_scope'])}>{answerScopes.map(scope=><option value={scope.value} key={scope.value}>{scope.label}</option>)}</select></label>
          <label className="miih-admin-wide">Help text (optional)<textarea value={description} disabled={!editable||busy} onChange={event=>setDescription(event.target.value)} placeholder="Explain what a useful answer should include."/></label>
          <label>Placeholder text<input value={placeholder} disabled={!editable||busy} onChange={event=>setPlaceholder(event.target.value)} placeholder="Optional hint inside the answer box"/></label>
          <label>Display position<input type="number" min="0" value={order} disabled={!editable||busy} onChange={event=>setOrder(Number(event.target.value))}/></label>
          <label className="miih-toggle-label"><input type="checkbox" disabled={!editable||busy} checked={required} onChange={event=>setRequired(event.target.checked)}/> Require an answer</label>
          <label className="miih-toggle-label"><input type="checkbox" disabled={!editable||busy} checked={active} onChange={event=>setActive(event.target.checked)}/> Show on registration form</label>
        </div>
        {(inputType==='IMAGE'||inputType==='FILE')&&<p className="miih-muted-admin">{inputType==='IMAGE'?'Participants can upload a JPG, PNG or WebP image.':'Participants can upload a JPG, PNG, WebP image or PDF file.'} Uploads are stored securely with the registration.</p>}
        {editable&&can('FORM_EDIT')&&<div className="miih-form-editor-actions"><button className="miih-admin-primary" type="button" disabled={busy||!label.trim()} onClick={()=>void saveQuestion()}><Icon name="save"/> Save question</button></div>}
        {(inputType==='SINGLE_SELECT'||inputType==='MULTI_SELECT'||selected.options.length>0)&&<section className="miih-form-options">
          <div className="miih-form-section-heading"><div><h3>Answer choices</h3><span>Choices are shown in the order listed.</span></div></div>
          {selected.options.map(option=><div className="miih-admin-option" key={option.option_value}>
            <span>{option.option_label}{option.is_active===false?' · Removed':''}</span>
            <div className="miih-admin-row"><label className="miih-toggle-label"><input type="checkbox" disabled={!editable||busy} checked={option.is_active!==false} onChange={event=>void changeOption(option,event.target.checked)}/> Available</label>
              {editable&&can('FORM_EDIT')&&option.is_active!==false&&<AdminIconButton icon="delete" label={`Delete choice: ${option.option_label}`} disabled={busy} onClick={()=>void deleteOption(option)}/>}
            </div>
          </div>)}
          {editable&&can('FORM_EDIT')&&(inputType==='SINGLE_SELECT'||inputType==='MULTI_SELECT')&&<div className="miih-form-add-option">
            <label>New choice<input value={optionLabel} onChange={event=>setOptionLabel(event.target.value)} placeholder="For example: Artificial Intelligence"/></label>
            <AdminIconButton icon="add" label="Add answer choice" disabled={busy||!optionLabel.trim()} onClick={()=>void addOption()}/>
          </div>}
        </section>}
      </div>:<Empty message="Choose a question on the left to review or edit it."/>}
    </Panel>
    </div>
  </div>
 </>}
type ReadinessCheck = {key:string;label:string;ok:boolean;fix:string};
type Readiness = {edition_code:string;is_internal_test:boolean;ready:boolean;checks:ReadinessCheck[];enabled_domains:number;published_form_version:number|null;note:string};
function RegistrationReadiness({editionId,refresh}:{editionId:string;refresh:number}){
 const {data,loading,error,reload}=useResource<Readiness>(editionId?`/admin/editions/${editionId}/readiness`:null,{edition_code:'',is_internal_test:false,ready:false,checks:[],enabled_domains:0,published_form_version:null,note:''},[refresh]);
 const url=data.is_internal_test?'/register?miih_test=1':'/register';
 return <Panel title="Registration readiness" toolbar={<div className="miih-admin-row"><Badge value={data.ready?'READY':'NEEDS ATTENTION'}/><AdminIconButton icon="refresh" label="Recheck registration readiness" disabled={loading} onClick={reload}/></div>}>
   <p className="miih-muted-admin">Follow the checklist to open registration. Publishing the event alone does not publish the registration form or activate payments.</p>
   {error&&<ErrorMessage message={error}/>}{loading&&!data.checks.length&&<Loading/>}
   <div className="miih-readiness-list">{data.checks.map(c=><div className={`miih-readiness-item ${c.ok?'ok':'issue'}`} key={c.key}><span aria-hidden="true">{c.ok?'✓':'!'}</span><div><b>{c.label}</b>{!c.ok&&<small>{c.fix}</small>}</div></div>)}</div>
   {data.is_internal_test?<p className="miih-muted-admin">Private test preview uses an approved Super Admin session in the same browser. Do not share its URL publicly.</p>:<p className="miih-muted-admin">Public registration stays unavailable until each prerequisite passes. This check does not publish anything.</p>}
   <div className="miih-admin-row"><a className="miih-admin-outline" href={url}>Open {data.is_internal_test?'private test':'public register'} page ↗</a></div>
 </Panel>;
}
export function SettingsPage(){const {can,superAdmin,notify}=useAdmin();const {editions,setEditions,editionId,setEditionId,edition,reload}=useEditions();const [fields,setFields]=useState<Partial<Edition>>({});const [formDirty,setFormDirty]=useState(false);const [fieldsEditionId,setFieldsEditionId]=useState('');const [busy,setBusy]=useState(false);const [readinessRefresh,setReadinessRefresh]=useState(0);const isInternalTest=edition?.edition_code==='MIIH_TEST_48H';const domains=useResource<Domain[]>(editionId?`/admin/editions/${editionId}/domains`:null,[]);const [domainOverrides,setDomainOverrides]=useState<Record<string,boolean>>({});const [changingDomains,setChangingDomains]=useState<string[]>([]);
 useEffect(()=>{if(edition&&!formDirty){setFieldsEditionId(edition.id);setFields({title:edition.title,tagline:edition.tagline,description:edition.description,venue:edition.venue,location:edition.location,event_mode:edition.event_mode,eligibility_text:edition.eligibility_text,guidelines_text:edition.guidelines_text,min_team_size:edition.min_team_size,max_team_size:edition.max_team_size,default_team_size:edition.default_team_size,starts_at:edition.starts_at,ends_at:edition.ends_at,registration_opens_at:edition.registration_opens_at,registration_closes_at:edition.registration_closes_at});}},[edition,formDirty]);
 async function persistEdition(){const payload=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v===''?null:v]));const saved=await patch<Edition>(`/admin/editions/${editionId}`,payload,true);setEditions(items=>items.map(item=>item.id===saved.id?saved:item));setFormDirty(false);}
 async function saveEdition(){if(!editionId)return;setBusy(true);try{await persistEdition();reload();setReadinessRefresh(n=>n+1);notify(isInternalTest?'Private test details saved. View them in the private test preview; the public event is unchanged.':'Public event details saved. View them at /register.');}catch(e){notify(e instanceof Error?e.message:'Could not update edition');}finally{setBusy(false);}}
 async function publishEdition(openRegistration:boolean){if(!editionId||!await adminConfirm(openRegistration?isInternalTest?'Open restricted, zero-fee test registration?':'Open real registration? This requires a published form, approved registration fee and a genuine Razorpay link.':'Save these details and publish event information? The current registration status will be kept.',openRegistration?'Open registration':'Publish event information'))return;setBusy(true);try{await persistEdition();await post(`/admin/editions/${editionId}/publish${qs({open_registration:openRegistration})}`,{},true);reload();setReadinessRefresh(n=>n+1);notify('Edition updated.');}catch(e){notify(e instanceof Error?e.message:'Could not publish edition');}finally{setBusy(false);}}
 async function toggleDomain(d:Domain){
   if(!editionId||changingDomains.includes(d.id))return;
   const key=`${editionId}:${d.id}`;
   const before=domainOverrides[key]??(d.is_enabled!==false);
   const next=!before;
   setDomainOverrides(old=>({...old,[key]:next}));
   setChangingDomains(old=>[...old,d.id]);
   try{
     const saved=await patch<{is_enabled:boolean}>(`/admin/editions/${editionId}/domains/${d.id}${qs({enabled:next})}`,{},true);
     setDomainOverrides(old=>({...old,[key]:saved.is_enabled}));
     domains.reload();setReadinessRefresh(n=>n+1);
     notify(`${d.domain_name} ${saved.is_enabled?'enabled':'disabled'} for this event.`);
   }catch(err){
     setDomainOverrides(old=>({...old,[key]:before}));
     notify(err instanceof Error?err.message:'Domain update failed.');
   }finally{setChangingDomains(old=>old.filter(id=>id!==d.id));}
 }
 const update=(k:keyof Edition,v:unknown)=>{setFormDirty(true);setFields(old=>({...old,[k]:v}));};
 const inputGroups:{title:string;description:string;fields:[keyof Edition,string,string][]}[]=[
  {title:'Event information',description:'The event name, format and location shown to participants.',fields:[['title','Event title','text'],['tagline','Tagline','text'],['venue','Venue','text'],['location','City or location','text'],['event_mode','Event format','text']]},
  {title:'Dates and registration window',description:'Set when the event happens and when participants can register.',fields:[['starts_at','Event starts','datetime-local'],['ends_at','Event ends','datetime-local'],['registration_opens_at','Registration opens','datetime-local'],['registration_closes_at','Registration closes','datetime-local']]},
  {title:'Team size',description:'Choose the allowed team size and the suggested starting size.',fields:[['min_team_size','Minimum members','number'],['max_team_size','Maximum members','number'],['default_team_size','Suggested members','number']]},
 ];
 return <><PageHeader eyebrow="EVENT CONFIGURATION" title="Hackathon Settings" description="Edit the event title, dates, venue and eligibility shown to visitors. Save to update the registration page without reloading." actions={<EditionSelect editions={editions} editionId={editionId} onChange={value=>{setFormDirty(false);setEditionId(value);}}/>}/>
 <p className="miih-muted-admin">{isInternalTest?'You are editing the private test event. These changes appear only in the private test preview.':'You are editing the public event shown on the registration page.'} <a href={isInternalTest?'/register?miih_test=1':'/register'} target="_blank" rel="noopener noreferrer">View this event</a></p>
 <RegistrationReadiness editionId={editionId} refresh={readinessRefresh}/>
 <ProblemStatementsPanel key={editionId} editionId={editionId}/>
 <Panel title={isInternalTest?'Private Test Event Details':'Public Registration Page Details'} toolbar={<Badge value={edition?.status||'DRAFT'}/>}><p role="status"><strong>{edition?.edition_code}</strong> - {isInternalTest?'These fields belong to the private test event. They do not appear on /register.':'These fields appear on /register after saving.'} <a href={isInternalTest?'/register?miih_test=1':'/register'} target="_blank" rel="noopener noreferrer">View saved details</a></p>
 {isInternalTest&&<AdminIconButton icon="edit" label="Switch to public event" disabled={busy} onClick={()=>{const publicEdition=editions.find(e=>e.edition_code==='MIIH_UPCOMING');if(publicEdition){setFormDirty(false);setEditionId(publicEdition.id);}}}/>}
 <div className="miih-settings-sections">{inputGroups.map(group=><section className="miih-settings-section" key={group.title}><div><h3>{group.title}</h3><p className="miih-muted-admin">{group.description}</p></div><div className="miih-admin-form-grid">{group.fields.map(([key,label,type])=><label key={key}>{label}{type==='datetime-local'?<ThemedDateTime withTime disabled={!can('EVENT_EDIT')||busy||!editionId||fieldsEditionId!==editionId} value={localDateTime(fields[key])} onChange={value=>update(key,value?new Date(value).toISOString():null)}/>:<input type={type} disabled={!can('EVENT_EDIT')||busy||!editionId||fieldsEditionId!==editionId} value={first(fields[key])} onChange={event=>update(key,type==='number'?Number(event.target.value):event.target.value)}/>}</label>)}</div></section>)}
  <section className="miih-settings-section"><div><h3>Information for participants</h3><p className="miih-muted-admin">These details explain the event, who can join, and the participation guidelines.</p></div><div className="miih-admin-form-grid">{(['description','eligibility_text','guidelines_text'] as const).map(key=><label className="miih-admin-wide" key={key}>{key==='description'?'Event description':key==='eligibility_text'?'Who can participate?':'Participation guidelines'}<textarea rows={3} disabled={!can('EVENT_EDIT')||busy||!editionId||fieldsEditionId!==editionId} value={first(fields[key])} onChange={event=>update(key,event.target.value)}/></label>)}</div></section>
 </div>
 <div className="miih-settings-actions">{can('EVENT_EDIT')&&<button className="miih-admin-primary" disabled={busy||!editionId||fieldsEditionId!==editionId||!formDirty} onClick={saveEdition}><Icon name="save"/>{busy?'Saving…':'Save event details'}</button>}{superAdmin&&<><button className="miih-admin-outline" disabled={busy||!editionId||fieldsEditionId!==editionId} onClick={()=>publishEdition(false)}>Publish event information</button><button className="miih-admin-outline" disabled={busy||!editionId||fieldsEditionId!==editionId} onClick={()=>publishEdition(true)}>Open registration</button></>}</div>
 <p className="miih-muted-admin">Saving {edition?.edition_code}: {isInternalTest?'private test preview only':'public /register page'}. Publishing a registration form is managed separately under Registration Form.</p></Panel>
 <Panel title="Hackathon domains"><p className="miih-muted-admin">Click a domain to enable or disable it for the selected event. Changes save immediately; no page refresh needed.</p><ErrorMessage message={domains.error}/><div className="miih-domain-grid">{domains.data.map(d=>{
    const enabled=domainOverrides[`${editionId}:${d.id}`]??(d.is_enabled!==false);
    return <label className={`miih-domain-toggle miih-domain-card ${enabled?'enabled':'disabled'}`} key={d.id}>
      <input type="checkbox" checked={enabled} disabled={!can('DOMAIN_EDIT')||changingDomains.includes(d.id)} onChange={()=>void toggleDomain(d)}/>
      <span><strong>{d.domain_name}</strong><small>{changingDomains.includes(d.id)?'Saving…':enabled?'Included in this event':'Not offered in this event'}</small></span>
      <span className="miih-domain-indicator" aria-hidden="true">{enabled?'✓':'+'}</span>
    </label>;
   })}</div></Panel>

 {superAdmin&&<Panel title="Payment settings"><p className="miih-muted-admin">The Razorpay payment URL and team registration fee are managed centrally in Admin Configuration. They are saved to Supabase for the selected event and can be changed later.</p><a href="/admin/admins#payment" className="miih-admin-outline">Open Admin Configuration →</a></Panel>}</>}
export function AdminPermissionsPage(){const {notify}=useAdmin();const {data:admins,reload,error:adminsError,loading:adminsLoading}=useResource<Row[]>('/admin/admins',[]);const {data:catalog}=useResource<Row[]>('/admin/permission-catalog',[]);const pending=useResource<Row[]>('/admin/applications/pending',[]);const [target,setTarget]=useState('');const grants=useResource<Row[]>(target?`/admin/admins/${target}/grants`:null,[]);const [draftKeys,setDraftKeys]=useState<string[]>([]);const [roleChoice,setRoleChoice]=useState<'ADMIN'|'SUPER_ADMIN'>('ADMIN');const [savingAccess,setSavingAccess]=useState(false);const [dirtyAccess,setDirtyAccess]=useState(false);const availableKeys=catalog.filter(p=>p.assignable_to_admin===true).map(p=>first(p.permission_key));useEffect(()=>{if(!dirtyAccess){setDraftKeys(grants.data.filter(x=>x.is_granted===true).map(x=>first(x.permission_key)));setRoleChoice('ADMIN');}},[target,grants.data,dirtyAccess]);
 async function decide(adminId:string,decision:'APPROVED'|'REJECTED'|'SUSPENDED'){
  const reason=decision==='APPROVED'?null:await adminPrompt(`Reason for ${decision.toLowerCase()} (saved with the decision)`, '', true);
  if(decision!=='APPROVED'&&(!reason||!reason.trim()))return;
  if(!await adminConfirm(`Confirm ${decision.toLowerCase()} for this account?`,'Admin access decision',decision!=='APPROVED'))return;
  try{await patch(`/admin/applications/${adminId}`,{decision,reason:reason?.trim()||null},true);pending.reload();reload();notify('Admin status updated.');}
  catch(e){notify(e instanceof Error?e.message:'Could not update admin');}
 }
 function toggleDraft(permissionKey:string,checked:boolean){
   const next=checked?[...draftKeys,permissionKey]:draftKeys.filter(k=>k!==permissionKey);
   setDirtyAccess(true);setDraftKeys(next);setRoleChoice(availableKeys.length>0&&availableKeys.every(k=>next.includes(k))?'SUPER_ADMIN':'ADMIN');
 }
 async function saveAccess(){if(!target||savingAccess)return;
   const isPromotion=roleChoice==='SUPER_ADMIN';
   if(!await adminConfirm(isPromotion?'Promote this Admin to Super Admin with unrestricted access? This is a high-privilege permanent role change.':'Save the selected permissions for this Admin?', 'Confirm admin access',isPromotion))return;
   setSavingAccess(true);
   try{await put(`/admin/${target}/access`,{permission_keys:draftKeys,role:roleChoice},true);
     setDirtyAccess(false);grants.reload();reload();notify(isPromotion?'Super Admin promotion saved.':'All selected permissions saved.');
     if(isPromotion)setTarget('');
   }catch(e){notify(e instanceof Error?e.message:'Could not save permissions');}finally{setSavingAccess(false);}
 }
 const eligible=admins.filter(a=>a.role==='ADMIN'&&a.approval_status==='APPROVED');
 return <><PageHeader eyebrow="SUPER ADMIN / ACCESS CONTROL" title="Admin Configuration" description="Approve access requests, manage administrators and assign permissions. Super Admin retains full control."/>
 <Panel title={`Access requests awaiting approval (${pending.data.length})`} toolbar={<a href="/admin/request-access" className="miih-admin-primary" target="_blank" rel="noopener noreferrer">＋ Add Admin</a>}><ErrorMessage message={pending.error}/><button className="miih-admin-outline" type="button" onClick={()=>{pending.reload();reload();}}>Refresh requests</button>{pending.loading?<Loading/>:pending.error?null:pending.data.length===0?<Empty message="No pending admin applications."/>:<DataTable rows={pending.data.map(p=>p as Row)} columns={[{key:'full_name',label:'Name'},{key:'email',label:'Email'},{key:'approval_status',label:'Status',render:v=><Badge value={v}/>},{key:'id',label:'Decision',render:v=><div className="miih-admin-row"><button className="miih-admin-outline" onClick={()=>decide(first(v),'APPROVED')}>Approve</button><button className="miih-admin-outline" onClick={()=>decide(first(v),'REJECTED')}>Reject</button></div>}]}/>}</Panel>
 <Panel title="Manage admin accounts"><ErrorMessage message={adminsError}/>{adminsLoading&&<Loading/>}<DataTable rows={admins} columns={[{key:'full_name',label:'Name'},{key:'email',label:'Email'},{key:'role',label:'Role',render:v=><Badge value={v}/>},{key:'approval_status',label:'Approval',render:v=><Badge value={v}/>},{key:'id',label:'Access',render:(_v,r)=>r.role==='SUPER_ADMIN'?'Protected Super Admin':r.approval_status==='APPROVED'?<button className="miih-admin-link" onClick={()=>decide(first(r.id),'SUSPENDED')}>Suspend</button>:'—'}]}/></Panel>
 <Panel title="Permission configuration"><label className="miih-admin-inline-label">Regular Admin <select value={target} onChange={e=>{setTarget(e.target.value);setDirtyAccess(false);}}><option value="">Select an approved Admin</option>{eligible.map(a=><option key={first(a.id)} value={first(a.id)}>{first(a.full_name)} ({first(a.email)})</option>)}</select></label>
 {target&&<><p className="miih-muted-admin">Choose the permissions, then confirm once. Nothing is saved until you click Confirm access.</p>
 <div className="miih-admin-row"><button type="button" className="miih-admin-outline" onClick={()=>{setDirtyAccess(true);setDraftKeys([...availableKeys]);setRoleChoice('SUPER_ADMIN');}}>Select all</button><button type="button" className="miih-admin-outline" onClick={()=>{setDirtyAccess(true);setDraftKeys([]);setRoleChoice('ADMIN');}}>Clear all</button><span>{draftKeys.length} of {availableKeys.length} selected</span></div>
 <div className="miih-admin-inline-label"><label>Role <select value={roleChoice} onChange={e=>{const r=e.target.value as 'ADMIN'|'SUPER_ADMIN';setDirtyAccess(true);setRoleChoice(r);if(r==='SUPER_ADMIN')setDraftKeys([...availableKeys]);}}><option value="ADMIN">Regular Admin</option><option value="SUPER_ADMIN">Promote to Super Admin</option></select></label></div>
 <div className="miih-permission-matrix miih-permission-compact">{catalog.filter(p=>p.assignable_to_admin===true).map(p=>{const key=first(p.permission_key);return <label key={key}><input type="checkbox" checked={draftKeys.includes(key)} onChange={e=>toggleDraft(key,e.target.checked)}/><span><b>{first(p.display_name)}</b></span></label>})}</div>
 {roleChoice==='SUPER_ADMIN'&&<p className="miih-admin-error">All available permissions selected. Confirming will promote this account to Super Admin.</p>}
 <button type="button" className="miih-admin-primary" disabled={savingAccess||grants.loading} onClick={()=>void saveAccess()}>{savingAccess?'Saving…':'Confirm access & save permissions'}</button></>}
 </Panel><RazorpayAdminConfiguration/></>}

/** Super Admin-only Razorpay configuration, inside Admin Configuration. */
function RazorpayAdminConfiguration(){
 const {superAdmin,notify}=useAdmin();
 const {data:editions}=useResource<Edition[]>('/admin/editions',[]);
 const [editionId,setEditionId]=useState('');
 useEffect(()=>{if(!editions.length)return;if(!editions.some(e=>e.id===editionId))setEditionId((editions.find(e=>e.edition_code==='MIIH_UPCOMING')||editions[0]).id);},[editions,editionId]);
 const edition=editions.find(e=>e.id===editionId);
 const payment=useResource<Row[]>(superAdmin&&editionId?`/admin/editions/${editionId}/payments/config`:null,[]);
 const [url,setUrl]=useState('https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view');
 const [label,setLabel]=useState('Secure Your Spot - Pay Now');
 const [fee,setFee]=useState('');
 const [enabled,setEnabled]=useState(false);
 const [saving,setSaving]=useState(false);
 const isTest=edition?.edition_code==='MIIH_TEST_48H';
 useEffect(()=>{
   const p=payment.data[0];
   if(!p){setUrl('https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view');setLabel('Secure Your Spot - Pay Now');setFee('');setEnabled(false);return;}
   const stored=first(p.razorpay_payment_url);
   setUrl(stored.includes('example.com')||!stored?'https://pages.razorpay.com/pl_Tq7ND79LNPZBUt/view':stored);
   setLabel(first(p.button_label)||'Secure Your Spot - Pay Now');
   setFee(first(p.fee_amount??''));
   setEnabled(p.is_active===true);
 },[editionId,payment.data]);
 async function save(event:FormEvent){
   event.preventDefault();if(!superAdmin||!editionId||saving)return;
   if(!isTest && enabled && Number(fee)<=0){notify('Set the confirmed registration fee before activating real payments.');return;}
   if(!isTest && !/^https:\/\/(?:[a-z0-9-]+\.)*(?:razorpay\.com|rzp\.io|rzp\.link)\//i.test(url)){notify('Enter a genuine HTTPS Razorpay payment URL.');return;}
   if(!await adminConfirm(isTest?'Save the private payment-free test configuration?':enabled?'Activate real Razorpay payments for this edition?':'Save the Razorpay URL without activating payments?', 'Confirm payment configuration'))return;
   setSaving(true);
   try{
     await post(`/admin/editions/${editionId}/payments/config`,{
       button_label:isTest?'Complete test registration':label.trim(),
       razorpay_payment_url:isTest?null:url.trim(),
       fee_amount:isTest?0:Number(fee||0),
       payment_required:!isTest,proof_required:!isTest,
       activate:isTest?true:enabled,
       instructions:isTest?'Test Hackathon: registration testing only, with no payment.':'Use the official hosted Razorpay page, then submit transaction ID and screenshot to complete registration.'
     },true);
     payment.reload();notify(isTest?'Test payment-free configuration saved.':'Razorpay configuration saved.');
   }catch(error){notify(error instanceof Error?error.message:'Unable to save Razorpay configuration');}
   finally{setSaving(false);}
 }
 if(!superAdmin)return null;
 return <div id="payment"><Panel title="Razorpay & payment configuration">
  <p className="miih-muted-admin">The official payment link is saved in Supabase for each event. Choose the real event, edit the URL or fee, and save. Payment activation is a separate choice; a private test event never needs Razorpay.</p>
  <form className="miih-editor-form" onSubmit={save}>
   <div className="miih-admin-form-grid">
    <EditionSelect editions={editions} editionId={editionId} onChange={setEditionId}/>
    <label>Payment button text<input value={isTest?'Complete test registration':label} disabled={isTest} onChange={e=>setLabel(e.target.value)} required /></label>
    <label>Team registration fee (₹)<input type="number" min="0" step="0.01" disabled={isTest} value={isTest?'0':fee} onChange={e=>setFee(e.target.value)} required={enabled&&!isTest} placeholder="Enter when confirmed" /></label>
    <label className="miih-admin-wide">Razorpay Payment Page URL<input type="url" disabled={isTest} value={isTest?'':url} onChange={e=>setUrl(e.target.value)} required={!isTest} /></label>
   </div>
   <label className="miih-toggle-label"><input type="checkbox" checked={isTest||enabled} disabled={isTest} onChange={e=>setEnabled(e.target.checked)} />{isTest?'Test Hackathon — ₹0, no payment':'Activate real payments for this edition'}</label>
   <div className="miih-admin-row"><button type="submit" className="miih-admin-primary" disabled={saving||!editionId||(!isTest&&enabled&&!(Number(fee)>0))}>{saving?'Saving…':'Save payment configuration'}</button><Badge value={isTest?'TEST HACKATHON':enabled?'ACTIVE':'INACTIVE'}/>{!isTest&&<a href={url} target="_blank" rel="noopener noreferrer" className="miih-admin-outline">Review payment page ↗</a>}</div>
  </form>
 </Panel></div>;
}

export function EditionHighlightsEditor({selectedEditionId}:{selectedEditionId?:string}){const {can,notify}=useAdmin();const {editions,editionId:chosenEditionId,setEditionId}=useEditions();const editionId=selectedEditionId||chosenEditionId;const {data,reload}=useResource<Row[]>(editionId?`/admin/editions/${editionId}/highlights`:null,[]);const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [date,setDate]=useState('');
 async function add(){if(!editionId||!title.trim())return;try{await post(`/admin/editions/${editionId}/highlights`,{title,description,highlight_date:date||null,media_file_id:null,metrics_json:{},display_order:0,is_visible:true},true);setTitle('');setDescription('');setDate('');reload();notify('Hackathon highlight saved');}catch(e){notify(e instanceof Error?e.message:'Could not add highlight');}}
 return <Panel title="Edit hackathon highlights" toolbar={!selectedEditionId&&<EditionSelect editions={editions} editionId={editionId} onChange={setEditionId}/>}><DataTable rows={data} columns={[{key:'title',label:'Title'},{key:'description',label:'Description'},{key:'highlight_date',label:'Date'}]}/>{can('EVENT_EDIT')&&<div className="miih-editor-form"><div className="miih-admin-form-grid"><label>Title<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Date<ThemedDateTime value={date} onChange={setDate}/></label><label className="miih-admin-wide">Description<textarea value={description} onChange={e=>setDescription(e.target.value)}/></label></div><button className="miih-admin-primary" onClick={add} disabled={!title.trim()}>Add highlight</button></div>}</Panel>
}
