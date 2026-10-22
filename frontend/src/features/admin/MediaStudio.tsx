import { useEffect, useMemo, useState } from 'react';
import { post, upload } from '@/lib/miihApi';
import { ErrorMessage, Loading, useAdmin, useResource } from './AdminPortal';
import { adminConfirm } from './AdminDialogs';
import './styles/mediaStudio.css';

type MediaItem = {
  key:string; original_src:string; label:string; kind:'IMAGE'|'VIDEO';group:string;is_new?:boolean;
  published_revision_id?:string|null;published_url?:string|null;published_alt?:string|null;
  draft_revision_id?:string|null;draft_url?:string|null;draft_alt?:string|null;
};

/** One simple media-editing page, with no website iframe or developer selectors. */
export function MediaStudio(){
  const {can, superAdmin, notify}=useAdmin();
  const media=useResource<MediaItem[]>('/admin/media/library',[]);
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('ALL');const [adding,setAdding]=useState(false);const [newLabel,setNewLabel]=useState('');const [newCategory,setNewCategory]=useState('Hackathon Photos');const [newKind,setNewKind]=useState<'IMAGE'|'VIDEO'>('IMAGE');
  const [filter,setFilter]=useState<'ALL'|'IMAGE'|'VIDEO'>('ALL');
  const [selectedKey,setSelectedKey]=useState('');
  const [uploadedId,setUploadedId]=useState('');
  const [previewUrl,setPreviewUrl]=useState('');
  const [alt,setAlt]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const canEdit=can('GALLERY_EDIT');
  const item=media.data.find(x=>x.key===selectedKey)||null;
  const categories=Array.from(new Set(['Hackathon Photos','Hackathon Videos','Afterparty','Highlights','Other',...media.data.map(x=>x.group)]));
  const items=useMemo(()=>media.data.filter(x=>(category==='ALL'||x.group===category)&&(filter==='ALL'||x.kind===filter) &&
      (x.label+' '+x.original_src+' '+x.group).toLowerCase().includes(search.toLowerCase())),[media.data,filter,search,category]);

  useEffect(()=>{if(!selectedKey&&media.data.length)setSelectedKey(media.data[0].key);},[media.data,selectedKey]);
  useEffect(()=>{
    setUploadedId('');setPreviewUrl('');setAlt(item?.draft_alt||item?.published_alt||item?.label||'');setError('');
  },[selectedKey,item?.draft_revision_id,item?.published_revision_id]);
  useEffect(()=>()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);},[previewUrl]);
  const activeUrl=previewUrl||item?.draft_url||item?.published_url||item?.original_src||'';

  async function addNew(file:File){
    if(!canEdit||!newLabel.trim()){setError('Enter a title for the new media.');return;}
    setBusy(true);setError('');
    try{const uploaded=await upload<{id:string}>('/admin/cms/upload',file,true);
      const result=await post<{key:string}>(`/admin/media/library/add`,{
        label:newLabel.trim(),category:newCategory,kind:newKind,asset_file_id:uploaded.id,alt_text:newLabel.trim()},true);
      setAdding(false);setNewLabel('');media.reload();setSelectedKey(result.key);
      notify('New media saved as a draft. Click Publish Change to show it in the gallery.');
    }catch(e){setError(e instanceof Error?e.message:'Could not add media');}finally{setBusy(false);}
  }
  async function chooseFile(file:File){
    if(!item||!canEdit)return;
    if(!file.type.startsWith(item.kind==='VIDEO'?'video/':'image/')){
      setError(item.kind==='VIDEO'?'Choose a video (MP4 or WebM).':'Choose an image (JPG, PNG or WebP).');return;
    }
    setBusy(true);setError('');
    try{
      const result=await upload<{id:string}>('/admin/cms/upload',file,true);
      setUploadedId(result.id);setPreviewUrl(URL.createObjectURL(file));
      notify('Upload complete. Click Save Draft, then publish to make it public.');
    }catch(e){setError(e instanceof Error?e.message:'Media upload failed. Check server-side Storage configuration.');}
    finally{setBusy(false);}
  }
  async function saveDraft(){
    if(!item||!uploadedId||!canEdit)return;
    setBusy(true);setError('');
    try{
      await post(`/admin/media/library/${item.key}/replacement`,{asset_file_id:uploadedId,alt_text:alt.trim()||item.label},true);
      notify('Replacement draft saved. The public image stays unchanged until published.');
      setUploadedId('');setPreviewUrl('');media.reload();
    }catch(e){setError(e instanceof Error?e.message:'Could not save replacement.');}
    finally{setBusy(false);}
  }
  async function restore(){
    if(!item||!superAdmin||!await adminConfirm('Restore the original website asset and archive its replacements?','Restore original'))return;
    setBusy(true);setError('');
    try{await post(`/admin/media/library/${item.key}/restore`,{},true);setUploadedId('');setPreviewUrl('');media.reload();notify('Original media restored.');}
    catch(e){setError(e instanceof Error?e.message:'Restore failed.');}finally{setBusy(false);}
  }
  async function publish(){
    if(!item?.draft_revision_id||!superAdmin)return;
    const yes=await adminConfirm(`Publish the new ${item.kind==='VIDEO'?'video':'image'} for “${item.label}”? Visitors will see this replacement.`, 'Publish media');
    if(!yes)return;
    setBusy(true);setError('');
    try{
      await post(`/admin/media/revisions/${item.draft_revision_id}/publish`,{},true);
      media.reload();notify('Published. Website images and videos will update automatically.');
    }catch(e){setError(e instanceof Error?e.message:'Publish failed.');}
    finally{setBusy(false);}
  }
  return <main className="miih-media-studio">
    <header className="miih-media-header"><div><p className="miih-media-eyebrow">WEBSITE CONTENT</p><h1>Studio</h1>
      <p>Manage the website's images and videos. Select an item, upload a replacement, and publish. No coding required.</p></div>
      <div className="miih-admin-row"><span className="miih-media-counter">{media.data.length} media files</span>{canEdit&&<button type="button" className="miih-admin-primary" onClick={()=>{setAdding(v=>!v);setError('');}}>＋ Add Media</button>}</div>
    </header>
    {media.error&&<ErrorMessage message={media.error}/>}
    {media.loading&&!media.data.length&&<Loading message="Loading website images and videos…"/>}
    {adding&&<section className="miih-media-new"><h2>Add image or video</h2><div className="miih-admin-form-grid"><label>Media title<input value={newLabel} onChange={e=>setNewLabel(e.target.value)} maxLength={120} placeholder="e.g. Hackathon Final Arena"/></label><label>Category<select value={newCategory} onChange={e=>setNewCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Type<select value={newKind} onChange={e=>setNewKind(e.target.value as 'IMAGE'|'VIDEO')}><option value="IMAGE">Image</option><option value="VIDEO">Video</option></select></label><label>Choose file<input type="file" key={newKind} disabled={busy||!newLabel.trim()} accept={newKind==='VIDEO'?'video/mp4,video/webm':'image/jpeg,image/png,image/webp'} onChange={e=>{const f=e.target.files?.[0];if(f)void addNew(f);}}/></label></div><p className="miih-media-hint">After upload, publish the draft to add it to the public gallery.</p>{error&&<div className="miih-admin-error" role="alert">{error}</div>}</section>}
    <div className="miih-media-layout">
      <section className="miih-media-library" aria-label="Website media library">
        <div className="miih-media-filter"><label>Find an image or video<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search images, videos or filenames…"/></label>
          <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="ALL">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></label><div className="miih-media-filter-actions">{(['ALL','IMAGE','VIDEO'] as const).map(t=><button key={t} className={filter===t?'active':''} type="button" onClick={()=>setFilter(t)}>{t==='ALL'?'All':t==='IMAGE'?'Images':'Videos'}</button>)}</div></div>
        <div className="miih-media-grid">{items.map(row=><button className={`miih-media-tile ${selectedKey===row.key?'selected':''}`} type="button" key={row.key} disabled={busy} onClick={()=>setSelectedKey(row.key)}>
          <div className="miih-media-thumb">{row.kind==='VIDEO'?<span aria-hidden="true">▶</span>:<img src={row.published_url||row.original_src} alt="" loading="lazy"/>}
            {row.draft_revision_id&&<span className="miih-media-draft">Draft</span>}</div>
          <strong>{row.label}</strong><small>{row.group} · {row.kind==='VIDEO'?'Video':'Image'}</small>
        </button>)}</div>
        {!items.length&&!media.loading&&<p className="miih-media-empty">No media matches your search.</p>}
      </section>
      <aside className="miih-media-editor" aria-label="Selected media editor">
        {!item?<p>Choose an image or video from the list.</p>:<>
          <div className="miih-media-edit-header"><div><small>SELECTED MEDIA</small><h2>{item.label}</h2></div><span>{item.draft_revision_id?'Draft ready':'Published / original'}</span></div>
          <div className="miih-media-large-preview">{item.kind==='VIDEO'?<video key={activeUrl} src={activeUrl} controls preload="metadata" playsInline/>:<img src={activeUrl} alt={alt||item.label}/>}</div>
          <p className="miih-media-hint">This is the {previewUrl?'new uploaded':item.draft_url?'saved draft':item.published_url?'published replacement':'original'} {item.kind==='VIDEO'?'video':'image'}.</p>
          <label className="miih-media-edit-field">Image description / alternative text<input value={alt} disabled={!canEdit||busy} onChange={e=>setAlt(e.target.value)} placeholder="Describe this media for visitors"/></label>
          {canEdit?<label className="miih-media-file-button">＋ Choose replacement {item.kind==='VIDEO'?'video':'image'}
            <input type="file" hidden disabled={busy} accept={item.kind==='VIDEO'?'video/mp4,video/webm':'image/png,image/jpeg,image/webp'} onChange={e=>{const f=e.target.files?.[0];if(f)void chooseFile(f);e.currentTarget.value='';}}/></label>
            :<p className="miih-media-hint">You have viewing access. Ask Super Admin for media-edit permissions.</p>}
          <div className="miih-media-actions"><button type="button" disabled={!uploadedId||busy||!canEdit} onClick={()=>void saveDraft()} className="miih-admin-primary">{busy?'Working…':'Save Draft'}</button>
            {superAdmin&&<button type="button" disabled={!item.draft_revision_id||busy} onClick={()=>void publish()} className="miih-admin-outline">Publish Change</button>}{superAdmin&&!item.is_new&&<button type="button" disabled={busy||(!item.published_revision_id&&!item.draft_revision_id)} onClick={()=>void restore()} className="miih-admin-outline">Restore original</button>}</div>
          {error&&<div className="miih-admin-error" role="alert">{error}</div>}
          <p className="miih-media-hint">The original file is retained. Only a published replacement changes the public website.</p>
        </>}
      </aside>
    </div>
  </main>;
}
