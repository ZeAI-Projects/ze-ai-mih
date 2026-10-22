import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { applyCmsItem, getCmsSelector } from '@/features/cms/PublishedContentBridge';
import {
  post, qs, upload,
  type CmsRevision, type CmsSlot, type JsonRecord,
} from '@/lib/miihApi';
import { Badge, ErrorMessage, Loading, useAdmin, useResource } from './AdminPortal';
import './styles/websiteStudio.css';

const ROUTES: Record<string,string> = { HOME:'/', ABOUT:'/about', GALLERY:'/gallery', REGISTER:'/register', GLOBAL:'/' };
const PAGES = ['HOME','ABOUT','GALLERY','REGISTER','GLOBAL'];
const MEDIA_TYPES = ['IMAGE','VIDEO','GALLERY_ITEM','BANNER'];

function cssPath(element:Element):string {
  const segments:string[]=[];
  let current:Element|null=element;
  while(current&&current.tagName.toLowerCase()!=='html'){
    if(current.id){segments.unshift(`#${CSS.escape(current.id)}`);break;}
    const parent:Element|null=current.parentElement;
    if(!parent)break;
    const same=Array.from(parent.children).filter(x=>x.tagName===current?.tagName);
    const nth=same.length>1?`:nth-of-type(${same.indexOf(current)+1})`:'';
    segments.unshift(current.tagName.toLowerCase()+nth);
    current=parent;
  }
  return segments.join(' > ');
}

/** An integrated preview-and-editing workspace. Uses the existing CMS APIs; no demo content. */
export function WebsiteStudio({initialPage}:{initialPage?:'GALLERY'}){
  const {can,superAdmin,notify}=useAdmin();
  const [page,setPage]=useState(initialPage||'HOME');
  const [screen,setScreen]=useState<'desktop'|'mobile'>('desktop');
  const [draftMode,setDraftMode]=useState(true);
  const [search,setSearch]=useState('');
  const [selectedId,setSelectedId]=useState<string>('');
  const [text,setText]=useState('');
  const [link,setLink]=useState('');
  const [alt,setAlt]=useState('');
  const [assetId,setAssetId]=useState('');
  const [localPreview,setLocalPreview]=useState('');
  const [visible,setVisible]=useState(true);
  const [position,setPosition]=useState(0);
  const [jsonText,setJsonText]=useState('{}');
  const [selector,setSelector]=useState('');
  const [picking,setPicking]=useState(false);
  const [busy,setBusy]=useState(false);
  const [frameLoad,setFrameLoad]=useState(0);
  const [revisionKey,setRevisionKey]=useState(0);
  const frameRef=useRef<HTMLIFrameElement>(null);
  const slots=useResource<CmsSlot[]>(`/admin/cms/slots${qs({page})}`,[]);
  const preview=useResource<CmsRevision[]>(`/admin/cms/preview/${page}`,[]);
  const selected=slots.data.find(item=>item.id===selectedId)||null;
  const current=preview.data.find(item=>item.slot_id===selectedId)||null;
  const canEdit=can(page==='GALLERY'?'GALLERY_EDIT':'SITE_CONTENT_EDIT');
  const filtered=useMemo(()=>slots.data.filter(item=>(item.editor_label+' '+item.section_key).toLowerCase().includes(search.toLowerCase())),[slots.data,search]);
  const frameUrl=ROUTES[page]+(draftMode?'?miih_preview=1':'');

  useEffect(()=>{ if(initialPage)setPage(initialPage); },[initialPage]);
  useEffect(()=>()=>{if(localPreview)URL.revokeObjectURL(localPreview);},[localPreview]);
  useEffect(()=>{setSelectedId('');setPicking(false);setSearch('');},[page]);
  useEffect(()=>{
    setText(current?.text_value||'');setLink(current?.link_url||'');setAlt(current?.alt_text||'');
    setAssetId(current?.asset_file_id||'');setLocalPreview('');setVisible(current?.is_visible!==false);
    setPosition(current?.display_order||0);
    setJsonText(JSON.stringify(current?.content_json||{},null,2));
    setSelector(typeof current?.content_json?.target_selector==='string'?current.content_json.target_selector:'');
  },[selectedId,current?.revision_id]);

  // Display draft content directly in the real website canvas, without page navigation.
  useEffect(()=>{
    if(!draftMode||preview.error)return;
    const documentInFrame=frameRef.current?.contentDocument;
    if(!documentInFrame)return;
    const render=()=>{
      for(const item of preview.data){
        if(!item.revision_id)continue;
        applyCmsItem({section_key:item.section_key,slot_key:item.slot_key,slot_type:item.slot_type,
          text_value:item.text_value,asset_url:item.asset_url,link_url:item.link_url,
          alt_text:item.alt_text,content_json:item.content_json},page,documentInFrame);
      }
    };
    const timers=[100,450,1200].map(delay=>window.setTimeout(render,delay));
    return()=>timers.forEach(window.clearTimeout);
  },[draftMode,page,frameLoad,revisionKey,preview.data,preview.error]);

  // Let a nontechnical editor click a heading or image in the preview.
  useEffect(()=>{
    if(!picking)return;
    const frameDocument=frameRef.current?.contentDocument;
    if(!frameDocument)return;
    const onClick=(event:MouseEvent)=>{
      event.preventDefault();event.stopPropagation();
      const clicked=event.target as Element;
      const element=clicked.closest('h1,h2,h3,h4,p,a,img,video,button,li,span')||clicked;
      const path=cssPath(element);
      setSelector(path);setPicking(false);
      const bound=preview.data.find(item=>item.content_json?.target_selector===path);
      if(bound)setSelectedId(bound.slot_id);
      else if(!selectedId)notify('Element selected. Choose a content item to edit on the right.');
    };
    frameDocument.addEventListener('click',onClick,true);
    return()=>frameDocument.removeEventListener('click',onClick,true);
  },[picking,frameLoad,preview.data,selectedId,notify]);

  async function uploadMedia(file:File){
    if(!selected)return;
    setBusy(true);
    try{
      const result=await upload<{id:string}>('/admin/cms/upload',file,true);
      setAssetId(result.id);
      if(file.type.startsWith('image/')||file.type.startsWith('video/'))setLocalPreview(URL.createObjectURL(file));
      notify('Image uploaded. Click Save Draft to attach it.');
    }catch(err){notify(err instanceof Error?err.message:'Upload failed.');}
    finally{setBusy(false);}
  }
  async function save(event:FormEvent){
    event.preventDefault();if(!selected||!canEdit)return;
    setBusy(true);
    try{
      const content_json:JsonRecord=selected.slot_type==='JSON'?JSON.parse(jsonText) as JsonRecord:{...(current?.content_json||{})};
      if(selector.trim())content_json.target_selector=selector.trim();
      await post(`/admin/cms/slots/${selected.id}/revisions`,{
        text_value:text||null,link_url:link||null,alt_text:alt||null,
        asset_file_id:assetId||null,content_json,display_order:position,is_visible:visible,
      },true);
      preview.reload();slots.reload();setRevisionKey(value=>value+1);
      notify('Draft saved. The draft website preview updates automatically.');
      setLocalPreview('');
    }catch(err){notify(err instanceof Error?err.message:'Could not save draft.');}
    finally{setBusy(false);}
  }
  async function publish(){
    if(!current?.revision_id||current.status!=='DRAFT'||!superAdmin)return;
    setBusy(true);
    try{
      await post(`/admin/cms/revisions/${current.revision_id}/publish`,{},true);
      preview.reload();slots.reload();setRevisionKey(value=>value+1);
      notify('Content published to the public website.');
    }catch(err){notify(err instanceof Error?err.message:'Could not publish content.');}
    finally{setBusy(false);}
  }
  const draftCount=preview.data.filter(item=>item.status==='DRAFT').length;
  const effectiveSelector=selector.trim()|| (selected?getCmsSelector(page,selected.section_key,selected.slot_key):null);
  let targetInPreview=false;
  try {targetInPreview=Boolean(effectiveSelector&&frameRef.current?.contentDocument?.querySelector(effectiveSelector));}catch{/* Invalid selector is shown as not connected, not a crash. */}
  return <main className="miih-studio">
    <header className="miih-studio-head">
      <div><span className="miih-studio-kicker">WEBSITE MANAGEMENT</span><h1>{initialPage?'Gallery & Media':'Website Studio'}</h1>
      <p>See the website and update its words, images and links in the same place.</p></div>
      <a href={ROUTES[page]} target="_blank" rel="noopener noreferrer" className="miih-admin-outline">Visit live website ↗</a>
    </header>
    {!initialPage&&<div className="miih-studio-page-tabs" role="tablist" aria-label="Website page">
      {PAGES.map(item=><button key={item} role="tab" aria-selected={page===item} className={page===item?'active':''} onClick={()=>setPage(item)} type="button">{item==='GLOBAL'?'Shared areas':item.charAt(0)+item.slice(1).toLowerCase()}</button>)}
    </div>}
    <div className="miih-studio-main">
      <section className="miih-studio-preview" aria-label="Website preview">
        <div className="miih-studio-preview-top">
          <div className="miih-studio-url"><span className="miih-studio-dots">● ● ●</span><span>{ROUTES[page]}</span></div>
          <div className="miih-studio-controls">
            <label className="miih-studio-switch"><input type="checkbox" checked={draftMode} onChange={e=>setDraftMode(e.target.checked)}/>Draft preview</label>
            <button type="button" className="miih-admin-outline" onClick={()=>setScreen(s=>s==='desktop'?'mobile':'desktop')}>{screen==='desktop'?'◧ Mobile':'▣ Desktop'}</button>
            <button type="button" className="miih-admin-outline" onClick={()=>{preview.reload();setRevisionKey(v=>v+1);}}>↻ Update</button>
          </div>
        </div>
        <div className="miih-studio-preview-meta"><span>{draftMode?'Only admins can see draft changes':'Showing published website'}</span><span>{draftCount} unpublished change{draftCount===1?'':'s'}</span></div>
        {preview.error&&<ErrorMessage message={preview.error}/>}
        <div className={`miih-studio-viewport ${screen==='mobile'?'mobile':''}`}>
          <iframe key={`${page}-${draftMode}`} ref={frameRef} src={frameUrl} title={`${page} website preview`} onLoad={()=>setFrameLoad(i=>i+1)} />
        </div>
      </section>
      <aside className="miih-studio-sidebar" aria-label="Website content editor">
        <div className="miih-studio-sidebar-header"><strong>Edit page content</strong><small>Select an item, then update it. No coding required.</small></div>
        <div className="miih-studio-sidebar-scroll">
          <div className="miih-studio-finder">
            <label className="miih-studio-search-label">Find text or image<input type="search" placeholder="Search sections…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
            <button type="button" className={`miih-admin-outline ${picking?'active':''}`} onClick={()=>{setPicking(v=>!v);setDraftMode(true);}}>{picking?'Cancel picking':'◎ Select from website'}</button>
            {picking&&<p className="miih-studio-help">Click a heading, photo or button in the website preview.</p>}
          </div>
          {slots.error&&<ErrorMessage message={slots.error}/>}
          {slots.loading&&!slots.data.length?<Loading/>:<div className="miih-studio-item-list">
            {filtered.map(item=><button type="button" key={item.id} className={`miih-studio-item ${selectedId===item.id?'selected':''}`} onClick={()=>setSelectedId(item.id)}>
              <span className="miih-studio-item-icon">{MEDIA_TYPES.includes(item.slot_type)?'▧':'T'}</span><span><strong>{item.editor_label}</strong><small>{item.section_key.replaceAll('_',' ').toLowerCase()}{item.latest_draft_revision?' · Draft saved':''}</small></span><span aria-hidden="true">›</span>
            </button>)}
            {!filtered.length&&<p className="miih-studio-help">No matching items. Try a different search.</p>}
          </div>}
          {selected&&<form className="miih-studio-inspector" onSubmit={save}>
            <div className="miih-studio-inspector-head"><strong>{selected.editor_label}</strong><Badge value={current?.status||'NOT SAVED'}/></div>
            {selected.editor_help&&<p className="miih-studio-help">{selected.editor_help}</p>}
            {['TEXT','LINK','JSON'].includes(selected.slot_type)&&<label>{selected.slot_type==='JSON'?'Structured content':'Content'}
              {selected.slot_type==='JSON'?<textarea rows={7} value={jsonText} onChange={e=>setJsonText(e.target.value)}/>:<textarea rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="Type the new text here"/>}
            </label>}
            {MEDIA_TYPES.includes(selected.slot_type)&&<div className="miih-studio-upload"><strong>Image or video</strong>
              {(localPreview||current?.asset_url)&& (selected.slot_type==='VIDEO'?<video controls src={localPreview||current?.asset_url||undefined} className="miih-studio-media-preview"/>:<img src={localPreview||current?.asset_url||undefined} alt={alt||current?.alt_text||'Current website image'}/>)}
              <label className="miih-admin-outline">Choose file<input type="file" hidden disabled={busy||!canEdit} accept={selected.slot_type==='VIDEO'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp,video/mp4,video/webm'} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadMedia(file);e.target.value='';}}/></label>
              {assetId&&<small>✓ Media attached to this draft</small>}
              <label>Image description / caption<input value={alt} onChange={e=>setAlt(e.target.value)}/></label>
            </div>}
            <label>Button or destination link (optional)<input type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://…"/></label>
            <label className="miih-studio-checkbox"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>Show this item on the website</label>
            <details className="miih-studio-advanced"><summary>Advanced placement (optional)</summary>
              <p className="miih-studio-help">Pick an element from the preview to connect this content to the visible website.</p>
              <label>Connected element<input value={selector} onChange={e=>setSelector(e.target.value)} placeholder="Use Select from website"/></label>
              <label>Display order<input type="number" value={position} onChange={e=>setPosition(Number(e.target.value))}/></label>
            </details>
            {!effectiveSelector&&<p className="miih-studio-help">This item needs a visible page element. Select the item on the preview before publishing.</p>}
            {effectiveSelector&&<p className="miih-studio-help">{targetInPreview?'✓ Connected to the website preview':'Placement saved; verify the element in the website preview before publishing.'}</p>}
            <button className="miih-admin-primary" type="submit" disabled={!canEdit||busy}>{busy?'Saving…':'Save Draft'}</button>
            {superAdmin&&current?.status==='DRAFT'&&<button className="miih-admin-outline" type="button" disabled={busy||!effectiveSelector||!targetInPreview} onClick={publish}>Publish to website</button>}
          </form>}
        </div>
      </aside>
    </div>
  </main>;
}
