import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import './styles/adminDialogs.css';

type DialogField = {
  key: string;
  label: string;
  value?: string;
  required?: boolean;
  options?: string[];
  multiline?: boolean;
};
type DialogValues = Record<string, string>;
type DialogRequest = {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  fields: DialogField[];
  resolve: (result: DialogValues | null) => void;
};
const EVENT = 'miih:admin-dialog';
function requestDialog(options: Omit<DialogRequest, 'resolve'>): Promise<DialogValues | null> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<DialogRequest>(EVENT, { detail: { ...options, resolve } }));
  });
}
export async function adminConfirm(message: string, title = 'Confirm action', destructive = false): Promise<boolean> {
  return (await requestDialog({ title, message, confirmLabel: 'Confirm', destructive, fields: [] })) !== null;
}
export async function adminPrompt(message: string, initial = '', required = true): Promise<string | null> {
  const result = await requestDialog({ title: message, confirmLabel: 'Continue', fields: [{ key: 'value', label: message, value: initial, required }] });
  return result === null ? null : result.value;
}
export function adminFormDialog(title: string, fields: DialogField[], message?: string): Promise<DialogValues | null> {
  return requestDialog({ title, fields, message, confirmLabel: 'Continue' });
}

export function AdminDialogHost() {
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [values, setValues] = useState<DialogValues>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const current = useRef<DialogRequest | null>(null);

  useEffect(() => {
    function onRequest(event: Event) {
      const next = (event as CustomEvent<DialogRequest>).detail;
      if (current.current) {
        next.resolve(null);
        return;
      }
      current.current = next;
      previousFocus.current = document.activeElement as HTMLElement | null;
      setValues(Object.fromEntries(next.fields.map((f) => [f.key, f.value ?? ''])));
      setDialog(next);
    }
    window.addEventListener(EVENT, onRequest);
    return () => {
      window.removeEventListener(EVENT, onRequest);
      current.current?.resolve(null);
      current.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const app = document.querySelector<HTMLElement>('.miih-admin');
    const wasInert = app?.inert ?? false;
    const originalOverflow = document.documentElement.style.overflow;
    if (app) app.inert = true;
    document.documentElement.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])')?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey, true);
      if (app) app.inert = wasInert;
      document.documentElement.style.overflow = originalOverflow;
      previousFocus.current?.focus();
    };
    // finish resolves the promise and closes the modal immediately.
    function finish(result: DialogValues | null) {
      current.current?.resolve(result);
      current.current = null;
      setDialog(null);
    }
  }, [dialog]);

  function finish(result: DialogValues | null) {
    current.current?.resolve(result);
    current.current = null;
    setDialog(null);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    if (dialog.fields.some((f) => f.required && !values[f.key]?.trim())) return;
    finish(values);
  }
  if (!dialog) return null;
  return createPortal(
    <div className="miih-app-dialog-overlay" role="presentation">
      <div ref={dialogRef} className="miih-app-dialog" role="dialog" aria-modal="true" aria-labelledby="miih-dialog-title" aria-describedby={dialog.message ? 'miih-dialog-description' : undefined}>
        <div className="miih-app-dialog-heading">
          <div><span>ZEAI · ADMIN WORKSPACE</span><h2 id="miih-dialog-title">{dialog.title}</h2></div>
          <button type="button" className="miih-app-dialog-close" aria-label="Cancel and close" onClick={() => finish(null)}>×</button>
        </div>
        {dialog.message && <p className="miih-app-dialog-description" id="miih-dialog-description">{dialog.message}</p>}
        <form onSubmit={submit}>
          <div className="miih-app-dialog-fields">
            {dialog.fields.map((field) => <label key={field.key}>
              <span>{field.label}{field.required && ' *'}</span>
              {field.options ? <select value={values[field.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} required={field.required}>
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select> : field.multiline ? <textarea rows={3} value={values[field.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} required={field.required}/>
                : <input value={values[field.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} required={field.required}/>}
            </label>)}
          </div>
          <div className="miih-app-dialog-actions">
            <button className="miih-app-dialog-cancel" type="button" onClick={() => finish(null)}>Cancel</button>
            <button className={dialog.destructive ? 'miih-app-dialog-danger' : 'miih-app-dialog-confirm'} type="submit">{dialog.confirmLabel ?? 'Confirm'}</button>
          </div>
        </form>
      </div>
    </div>, document.body
  );
}
