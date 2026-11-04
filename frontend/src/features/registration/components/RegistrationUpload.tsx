import { useEffect, useId, useState } from 'react';

export type UploadState = {file:File; status:'uploading'|'success'|'error'; error?:string};

/** A branded, accessible file picker that keeps the native input available to keyboard and screen readers. */
export function RegistrationUpload({state, stored, photo, disabled, onSelect, onRemove, purpose='photo', inputId}:{
  state?:UploadState;
  stored:boolean;
  photo:boolean;
  disabled:boolean;
  purpose?:'photo'|'payment';
  inputId?:string;
  onSelect:(file:File)=>void;
  onRemove:()=>void;
}) {
  const generatedId=useId();
  const id=inputId||generatedId;
  const [preview,setPreview]=useState('');
  useEffect(()=>{
    if(!state?.file.type.startsWith('image/')){setPreview('');return;}
    const url=URL.createObjectURL(state.file);
    setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[state?.file]);
  const isUploading=state?.status==='uploading';
  const hasFile=Boolean(state || stored);
  const isReady=stored && !isUploading && state?.status!=='error';
  const fileDescription=purpose==='payment'?'payment screenshot':'profile photograph';
  return <div className={`miih-upload-control${state?.status==='error'?' miih-upload-has-error':''}${isReady?' miih-upload-is-ready':''}`}>
    <div className="miih-upload-picker-row">
      <input
        id={id}
        className="miih-upload-native"
        type="file"
        accept={photo?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,application/pdf'}
        disabled={disabled || isUploading}
        aria-label={`Choose ${fileDescription}`}
        onChange={e=>{
          const file=e.currentTarget.files?.[0];
          // Reset only the hidden native control so choosing the same file twice works.
          // The selected filename and preview are displayed from React state below.
          e.currentTarget.value='';
          if(file)onSelect(file);
        }}
      />
      <label htmlFor={id} className={`miih-upload-pick-button${disabled||isUploading?' is-disabled':''}`}>
        <span className="miih-upload-pick-icon" aria-hidden="true">↑</span>
        {hasFile?`Replace ${purpose==='payment'?'screenshot':'photograph'}`:`Choose ${purpose==='payment'?'screenshot':'photograph'}`}
      </label>
      <span className="miih-upload-hint">JPG, PNG or WebP · Max 10 MB</span>
    </div>
    {hasFile&&<div className="miih-upload-file-card">
      {preview?<img src={preview} alt={`Selected ${fileDescription} preview`} className="miih-upload-thumbnail"/>:
        <span className="miih-upload-placeholder" aria-hidden="true">{purpose==='payment'?'▤':'▧'}</span>}
      <div className="miih-upload-file-meta">
        <strong title={state?.file.name||fileDescription}>{state?.file.name||'Previously uploaded file'}</strong>
        <span className={`miih-upload-status${state?.status==='error'?' is-error':isReady?' is-ready':''}`} role="status" aria-live="polite">
          {isUploading?'Uploading securely…':state?.status==='error'?'Upload failed':isReady?'✓ Upload successful':'Waiting for upload'}
        </span>
      </div>
      <div className="miih-upload-actions">
        {state?.status==='error'&&<button className="miih-upload-retry" type="button" disabled={disabled} onClick={()=>onSelect(state.file)}>Retry</button>}
        <button className="miih-upload-remove" type="button" disabled={disabled||isUploading} onClick={onRemove}>Remove</button>
      </div>
    </div>}
    {isUploading&&<div className="miih-upload-progress" role="progressbar" aria-label={`${fileDescription} uploading`} aria-valuetext="Uploading"><span/></div>}
    {state?.status==='error'&&<p role="alert" className="miih-upload-error">{state.error||'Upload failed. Check the file and try again.'}</p>}
    {!hasFile&&<p className="miih-upload-empty">No {fileDescription} selected yet.</p>}
  </div>;
}
