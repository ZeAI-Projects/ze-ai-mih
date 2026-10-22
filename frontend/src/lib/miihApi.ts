/** Typed transport for the existing MIIH FastAPI backend. No database secrets in React. */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v1').replace(/\/$/, '');
const AUTH_KEY = 'miih.admin.session';
export type JsonRecord = Record<string, unknown>;
export interface Session { access_token: string; refresh_token: string; expires_in?: number }
export interface Edition { id: string; edition_code: string; title: string; year?: number; status?: string; is_published?: boolean; description?: string; tagline?: string; starts_at?: string | null; ends_at?: string | null; registration_opens_at?: string | null; registration_closes_at?: string | null; venue?: string; location?: string; event_mode?: string; eligibility_text?: string; guidelines_text?: string; min_team_size?: number; max_team_size?: number; default_team_size?: number }
export interface Domain { id: string; domain_name: string; domain_code?: string; is_enabled?: boolean }
export interface QuestionOption { option_value: string; option_label: string; display_order?: number; is_active?: boolean }
export interface Question { id: string; field_key: string; legacy_question_number?: number | null; question_label: string; description?: string | null; placeholder?: string | null; input_type: string; answer_scope: 'TEAM'|'MEMBER'|'LEADER'|'PITCH'; is_required: boolean; is_active?: boolean; display_order: number; options: QuestionOption[]; validation_rules?: JsonRecord; visibility_rules?: JsonRecord; default_value?: unknown }
export interface FormSection { id: string; section_key: string; title: string; description?: string | null; display_order: number; questions: Question[] }
export interface PaymentConfig { button_label: string; payment_url: string | null; payment_enabled: boolean; placeholder_url?: string; fee_amount?: number; currency?: string; payment_required?: boolean }
export interface RegistrationConfig { edition: Edition; domains: Domain[]; form?: {id:string;version_number:number;name:string} | null; sections: FormSection[]; payment: PaymentConfig; registration_enabled: boolean }
export interface AdminProfile { id: string; full_name: string; email: string; role: 'SUPER_ADMIN'|'ADMIN'; approval_status: string }
export interface CmsSlot { id: string; page_key: string; section_key: string; slot_key: string; slot_type: string; editor_label: string; editor_help?: string; is_editable?: boolean; published_revision?: number | null; latest_draft_revision?: number | null }
export interface CmsRevision { slot_id: string; section_key: string; slot_key: string; slot_type: string; editor_label: string; revision_id: string | null; status: string | null; text_value?: string | null; link_url?: string | null; alt_text?: string | null; asset_file_id?: string | null; poster_file_id?: string | null; asset_url?: string | null; content_json?: JsonRecord; is_visible?: boolean; display_order?: number }

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; } }
export function getSession(): Session | null { try { const s = sessionStorage.getItem(AUTH_KEY); return s ? JSON.parse(s) as Session : null; } catch { return null; } }
export function setSession(s: Session | null) { if (s) sessionStorage.setItem(AUTH_KEY, JSON.stringify(s)); else sessionStorage.removeItem(AUTH_KEY); }
let refreshPromise: Promise<Session | null> | null = null;
async function refreshSession(): Promise<Session | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const s = getSession(); if (!s?.refresh_token) return null;
    try {
      const r = await fetch(API_BASE + '/auth/refresh', { method:'POST', signal:AbortSignal.timeout(20000), headers:{'Content-Type':'application/json'}, body:JSON.stringify({refresh_token:s.refresh_token}) });
      if (!r.ok) throw new Error('Session expired');
      const updated = await r.json() as Session; setSession(updated); return updated;
    } catch { setSession(null); return null; }
  })();
  try { return await refreshPromise; } finally { refreshPromise = null; }
}
function getError(detail: unknown): string {
  if(typeof detail==='string')return detail;
  if(Array.isArray(detail))return detail.map((entry:unknown)=>getError(entry)).join('; ');
  if(detail && typeof detail==='object'){
    const item=detail as Record<string,unknown>;
    const heading=typeof item.message==='string'?item.message:typeof item.msg==='string'?item.msg:'';
    const problems=Array.isArray(item.blockers)?item.blockers.map(String).join(' • '):'';
    const issues=Array.isArray(item.validation_errors)?item.validation_errors.map(String).join(' • '):'';
    return [heading,problems,issues].filter(Boolean).join(': ') || JSON.stringify(item);
  }
  return 'Request failed. Please try again.';
}
export async function apiResponse(path: string, init: RequestInit = {}, auth = false, retry = true): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!(init.body instanceof FormData) && init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (auth) { const session = getSession(); if (session?.access_token) headers.set('Authorization', 'Bearer ' + session.access_token); }
  let response: Response;
  try { response = await fetch(API_BASE + path, { ...init, headers, signal:init.signal || AbortSignal.timeout(60000) }); }
  catch { throw new ApiError(0, 'The backend did not respond. Check that it is running and reachable, then try again.'); }
  if (response.status === 401 && auth && retry && getSession()?.refresh_token) { const s = await refreshSession(); if (s) return apiResponse(path, init, true, false); }
  if (!response.ok) {
    const content = await response.text();
    let detail:unknown=content;
    try{const parsed=JSON.parse(content);detail=parsed.detail??parsed;}catch{/* Plain-text server error. */}
    throw new ApiError(response.status, response.status===401?'Your admin session has expired. Please sign in again.':getError(detail));
  }
  return response;
}
export async function api<T = unknown>(path: string, init: RequestInit = {}, auth = false, retry = true): Promise<T> {
  const response=await apiResponse(path,init,auth,retry);
  const contentType = response.headers.get('content-type') || '';
  const content = contentType.includes('json') ? await response.json() as unknown : await response.text();
  if (!response.ok) throw new ApiError(response.status, getError(typeof content === 'object' && content && 'detail' in content ? content.detail : content));
  // Admin mutations invalidate visible resources without browser refresh.
  const verb=(init.method || 'GET').toUpperCase();
  if (['POST','PUT','PATCH','DELETE'].includes(verb) && (path.startsWith('/admin/') || path.startsWith('/auth/admin/'))) {
    window.dispatchEvent(new CustomEvent('miih:data-updated', {detail:{path}}));
    try{localStorage.setItem('miih:last-update',String(Date.now()));}catch{/* Storage unavailable; local refresh still works. */}
  }
  return content as T;
}
export function get<T>(path: string, auth = false) { return api<T>(path, {}, auth); }
export function post<T>(path: string, data: unknown, auth = false) { return api<T>(path, { method:'POST', body:JSON.stringify(data) }, auth); }
export function put<T>(path: string, data: unknown, auth = false) { return api<T>(path, { method:'PUT', body:JSON.stringify(data) }, auth); }
export function patch<T>(path: string, data: unknown, auth = false) { return api<T>(path, { method:'PATCH', body:JSON.stringify(data) }, auth); }
export function upload<T>(path: string, file: File, auth = false, token?: string) {
  const data = new FormData(); data.append('file', file);
  return api<T>(path, { method:'POST', headers: token ? {'X-Registration-Token':token} : {}, body:data }, auth);
}
export function registrationRequest<T>(id:string, token:string, path:string, method:'GET'|'POST'|'PUT'='GET', data?:unknown, auth=false) {
  return api<T>(`/registrations/${id}${path}`, {method, headers:{'X-Registration-Token':token}, ...(data===undefined ? {} : {body:JSON.stringify(data)})}, auth);
}
export function qs(filters: Record<string, string|number|boolean|null|undefined>) { const s=new URLSearchParams(); Object.entries(filters).forEach(([k,v])=>{if(v!==undefined && v!==null && v!== '')s.set(k,String(v));}); return s.size?'?'+s.toString():''; }
