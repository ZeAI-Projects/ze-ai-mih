import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { get } from '@/lib/miihApi';

type Content = {
  slot_key:string; section_key:string;slot_type:string;text_value?:string|null;link_url?:string|null;
  alt_text?:string|null;asset_url?:string|null;poster_url?:string|null;
  content_json?:Record<string,unknown>;
};
const paths:Record<string,string>={'/':'HOME','/about':'ABOUT','/gallery':'GALLERY','/register':'REGISTER'};
const primarySelectors:Record<string,Record<string,string>>={
  HOME:{'HERO.eyebrow':'.hero .hero-copy .eyebrow','HERO.headline':'.hero-title','HERO.headline_emphasis':'.hero-title span','HERO.description':'.hero-description','HERO.primary_cta_label':'.hero .button-primary','PURPOSE.eyebrow':'#about-the-hackathon .eyebrow','PURPOSE.headline':'#purpose-title','PURPOSE.description':'#about-the-hackathon .section-copy','DOMAINS.headline':'#domains-title','DOMAINS.description':'.domain-section .section-copy','UPCOMING_EVENT.headline':'#upcoming-title','UPCOMING_EVENT.description':'.upcoming .section-copy','UPCOMING_EVENT.preview_title':'.event-preview h3','PAST_EDITION.headline':'#past-edition-title'},
  ABOUT:{'HERO.eyebrow':'.about-opening .eyebrow','HERO.headline':'.about-opening .page-title','HERO.headline_emphasis':'.about-opening .page-title span'},
  GALLERY:{'INTRO.eyebrow':'.gallery-opening .eyebrow','PHOTOS.headline':'#gallery-photos-title','VIDEOS.headline':'#gallery-videos-title','AFTERPARTY.headline':'#gallery-afterparty-title'},
  REGISTER:{'HERO.eyebrow':'.page-hero .eyebrow','HERO.headline':'.page-hero .page-title','HERO.description':'.page-hero .page-intro','EVENT.title':'#event-title','REGISTRATION.headline':'#registration-title','FAQ.headline':'#participation-faq-title'},
  GLOBAL:{'FOOTER.intro':'.footer-brand p','FOOTER.office_address':'.footer-office .contact-list a[href^="https:"]','FOOTER.email':'.footer-office a[href^="mailto:"]','FOOTER.phone':'.footer-office a[href^="tel:"]','FOOTER.closing_line':'.footer-bottom span'},
};
export function getCmsSelector(page:string,sectionKey:string,slotKey:string):string|null {
 return primarySelectors[page]?.[`${sectionKey}.${slotKey}`]||null;
}
function safeUrl(raw:string|null|undefined) {if(!raw)return null;try{const u=new URL(raw,window.location.origin);return ['https:','http:','mailto:','tel:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function updateText(node:Element,raw:string){
  // Preserve inline spans/icons and their CSS. The first direct text node is editable.
  const texts=Array.from(node.childNodes).filter((v):v is Text=>v.nodeType===Node.TEXT_NODE && !!v.textContent?.trim());
  if(texts.length){if(texts[0].textContent!==raw) texts[0].textContent=raw;for(const n of texts.slice(1)){if(n.textContent)n.textContent='';}}
  else if(node.childElementCount===0 && node.textContent!==raw)node.textContent=raw;
}
export function applyCmsItem(item:Content, page:string, doc:Document=document) {
  // Site media replacements are addressed by original file URL, not a CSS selector.
  // This updates images/videos wherever React renders them (including the gallery).
  if(item.section_key==='MEDIA_LIBRARY'){
    const original=typeof item.content_json?.original_src==='string'?item.content_json.original_src:null;
    const resource=safeUrl(item.asset_url||null);
    if(!original||!resource||!original.startsWith('/media/'))return false;
    let updated=false;
    for(const element of Array.from(doc.querySelectorAll<HTMLImageElement|HTMLVideoElement|HTMLSourceElement>('img[src],video[src],source[src],video[poster]'))){
      const isPoster:boolean=element.tagName.toLowerCase()==='video' && (element.getAttribute('data-miih-original-poster')||element.getAttribute('poster'))===original;
      const attr:string=isPoster?'poster':'src';
      const current=element.getAttribute(attr);
      const initial:string|null=element.getAttribute('data-miih-original-'+attr)||current;
      if(initial!==original)continue;
      if(!element.hasAttribute('data-miih-original-'+attr))element.setAttribute('data-miih-original-'+attr,original);
      if(current!==resource){
        if(element.tagName.toLowerCase()==='img' && element.hasAttribute('srcset')) {
          element.setAttribute('data-miih-original-srcset',element.getAttribute('srcset')||'');
          element.removeAttribute('srcset');
        }
        element.setAttribute(attr,resource);
        if(element.tagName.toLowerCase()==='source')element.closest('video')?.load();
        else if(element.tagName.toLowerCase()==='video'&&attr==='src')(element as HTMLVideoElement).load();
        updated=true;
      }
    }
    return updated;
  }
  const key=`${item.section_key}.${item.slot_key}`;
  const selector=typeof item.content_json?.target_selector==='string'?item.content_json.target_selector:(primarySelectors[page]?.[key]);
  if(!selector)return false;
  let target:Element|null;try{target=doc.querySelector(selector);}catch{return false;}
  if(!target)return false;
  // Event details and registration status are owned by Hackathon Settings.
  if(target.closest('[data-event-managed]'))return false;
  const resource=safeUrl(item.asset_url||item.link_url||null);
  if(['IMAGE','BANNER','GALLERY_ITEM'].includes(item.slot_type)&&resource){const media=target.matches('img')?target:target.querySelector('img');if(media && media.tagName.toLowerCase()==='img' && media.getAttribute('src')!==resource){media.removeAttribute('srcset');media.setAttribute('src',resource);}}
  else if(item.slot_type==='VIDEO'&&resource){const media=target.matches('video')?target:target.querySelector('video');if(media && media.tagName.toLowerCase()==='video' && media.getAttribute('src')!==resource){media.setAttribute('src',resource);(media as HTMLVideoElement).load();}}
  else if(item.slot_type==='LINK'&&resource && target.tagName.toLowerCase()==='a'){if(target.getAttribute('href')!==resource)target.setAttribute('href',resource);}
  if(item.text_value && item.slot_type!=='JSON')updateText(target,item.text_value);
  if(item.alt_text){const img=target.matches('img')?target:target.querySelector('img');if(img && img.tagName.toLowerCase()==='img' && img.getAttribute('alt')!==item.alt_text)img.setAttribute('alt',item.alt_text);}
  return true;
}
/** Reads only PUBLISHED content. Drafts never render on the public site. */
export function PublishedContentBridge(){const location=useLocation();useEffect(()=>{
  const page=paths[location.pathname.replace(/\/$/,'')||'/'];if(!page||window.location.search.includes('miih_preview=1'))return;
  let alive=true;let content:Array<Content & {sourcePage?:string}>=[];let scheduled=false;
  function applyAll(){if(!alive)return;scheduled=false;for(const x of content)applyCmsItem(x,x.sourcePage||page);}
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(applyAll);}}
  let revision=0;
  async function refreshPublished(){
    const request=++revision;
    try{
      const sourcePages=page==='HOME'?['HOME','ABOUT','GALLERY','REGISTER','GLOBAL']:[page,'GLOBAL','GALLERY'];
      const groups=await Promise.all(sourcePages.map(async sourcePage=>(await get<Content[]>(`/public/site-content/${sourcePage}`)).map(item=>({...item,sourcePage}))));
      if(!alive || request!==revision)return;
      content=groups.flat();
      const replaced=new Set(content.filter(x=>x.section_key==='MEDIA_LIBRARY').map(x=>x.content_json?.original_src));
      for(const attr of ['src','poster']){
        for(const element of document.querySelectorAll(`[data-miih-original-${attr}]`)){
          const original=element.getAttribute(`data-miih-original-${attr}`);
          if(original&&!replaced.has(original)&&element.getAttribute(attr)!==original){
            element.setAttribute(attr,original);
            if(attr==='src' && element.hasAttribute('data-miih-original-srcset')) element.setAttribute('srcset',element.getAttribute('data-miih-original-srcset')||'');
            if(attr==='src')element.closest('video')?.load();
          }
        }
      }
      schedule();
    }catch{/* Keep the current content if FastAPI is temporarily unreachable. */}
  }
  void refreshPublished();
  const onRefresh=()=>{void refreshPublished();};
  const onVisible=()=>{if(document.visibilityState==='visible')void refreshPublished();};
  window.addEventListener('miih:data-updated',onRefresh);
  const crossTab=(event:StorageEvent)=>{if(event.key==='miih:last-update')onRefresh();};
  window.addEventListener('storage',crossTab);
  window.addEventListener('focus',onRefresh);
  document.addEventListener('visibilitychange',onVisible);
  const interval=window.setInterval(onVisible,30000);
  const watcher=new MutationObserver(()=>{if(content.length)schedule();});
  watcher.observe(document.body,{childList:true,subtree:true,characterData:true});
  return()=>{alive=false;watcher.disconnect();window.clearInterval(interval);window.removeEventListener('miih:data-updated',onRefresh);window.removeEventListener('storage',crossTab);window.removeEventListener('focus',onRefresh);document.removeEventListener('visibilitychange',onVisible);};
 },[location.pathname]);return null;}
