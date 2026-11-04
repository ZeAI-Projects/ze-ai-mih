import { useEffect, useState, type FormEvent } from 'react';
import { api, post, ApiError, type Session } from '@/lib/miihApi';
import './styles/admin.css';

type Application = { approval_status: string };
type Stage = 'create' | 'complete' | 'done';
type Draft = { email: string; name: string };
const DRAFT_KEY = 'miih.admin.pending-access-draft';

function unwrap(value: Application | { data: Application }): Application {
  return 'data' in value ? value.data : value;
}

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const draft = data as Record<string, unknown>;
    if (typeof draft.email !== 'string' || typeof draft.name !== 'string') return null;
    return { email: draft.email, name: draft.name };
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Browsers with disabled storage can still finish the flow in one session.
  }
}

/**
 * A staff applicant uses a short-lived login token ONLY for /admin/apply.
 * This never replaces an existing Super Admin session in the same browser.
 */
export function AdminRequestAccessPage() {
  const [initialDraft] = useState(readDraft);
  const [email, setEmail] = useState(initialDraft?.email || '');
  const [name, setName] = useState(initialDraft?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stage, setStage] = useState<Stage>(initialDraft ? 'complete' : 'create');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (stage === 'done') return;
    if (stage === 'complete') saveDraft({ name: name.trim(), email: email.trim() });
  }, [stage, name, email]);

  async function submitApplication(accountEmail: string, accountPassword: string, applicantName: string) {
    // Sign-in on this page is deliberately separate from the admin portal session.
    const session = await post<Session>('/auth/login', {
      email: accountEmail,
      password: accountPassword,
    });
    if (!session.access_token) {
      throw new Error('No login session was returned. Confirm your email and try again.');
    }
    const headers = { Authorization: `Bearer ${session.access_token}` };
    let application = unwrap(await api<Application | { data: Application }>(
      '/admin/application-status', { headers },
    ));
    if (application.approval_status === 'NOT_APPLIED') {
      try {
        application = unwrap(await api<Application | { data: Application }>(
          '/admin/apply', {
            method: 'POST',
            headers,
            body: JSON.stringify({ full_name: applicantName }),
          },
        ));
      } catch (requestError) {
        // A retry or a second tab may have submitted it already.
        if (!(requestError instanceof ApiError) || requestError.status !== 409) {
          throw requestError;
        }
        application = unwrap(await api<Application | { data: Application }>(
          '/admin/application-status', { headers },
        ));
        if (application.approval_status === 'NOT_APPLIED') throw requestError;
      }
    }
    return application.approval_status;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setMessage('');
    const userEmail = email.trim().toLowerCase();
    const userName = name.trim();
    if (userName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (stage === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (stage === 'create') {
        await post('/auth/signup', { email: userEmail, password });
        // When email confirmation is disabled, complete both steps automatically.
        // If confirmation is required, keep the application pending locally until
        // the applicant verifies their email and submits it here.
        try {
          const nextStatus = await submitApplication(userEmail, password, userName);
          setStatus(nextStatus);
          setStage('done');
          saveDraft(null);
          setMessage(nextStatus === 'PENDING'
            ? 'Your access request is submitted and is awaiting Super Admin approval.'
            : `Application status: ${nextStatus}.`);
        } catch (signInError) {
          setStage('complete');
          saveDraft({ email: userEmail, name: userName });
          setMessage('Account created. If Supabase sent a confirmation email, verify it first. Then enter your password here to submit the admin application.');
          if (signInError instanceof ApiError && signInError.status !== 400 && signInError.status !== 401 && signInError.status !== 403) {
            setError(`Automatic application submission was unavailable: ${signInError.message}`);
          }
        }
      } else {
        const nextStatus = await submitApplication(userEmail, password, userName);
        setStatus(nextStatus);
        setStage('done');
        saveDraft(null);
        setMessage(nextStatus === 'PENDING'
          ? 'Your application has been submitted. The Super Admin can now see it in Admin Configuration.'
          : `Your existing application status is ${nextStatus}.`);
      }
      setPassword('');
      setConfirmPassword('');
    } catch (failure) {
      const text = failure instanceof Error ? failure.message : 'Unable to complete the request.';
      setError(
        stage === 'complete' && /authentication request rejected|invalid login credentials/i.test(text)
          ? 'Sign-in failed. Check your password and confirm your email if required, then try again.'
          : text,
      );
    } finally {
      setBusy(false);
    }
  }

  function chooseExistingAccount() {
    setStage('complete');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setMessage('Enter your existing account credentials to submit or check the approval request.');
    saveDraft({ email: email.trim(), name: name.trim() });
  }

  return (
    <div className="miih-admin miih-access-screen">
      <div className="miih-access-card">
        <a className="miih-access-brand" href="/"># Made in India <span> - ZeAI</span></a>
        <p className="miih-kicker">ADMIN ACCESS REQUEST</p>
        <h1>{stage === 'done' ? 'Request status' : stage === 'complete' ? 'Complete your access request.' : 'Request access to the team.'}</h1>
        <p className="miih-access-intro">
          {stage === 'done'
            ? 'Your request and account status are shown below.'
            : 'Create an account, confirm your email when required, and submit your name for Super Admin review. Creating an account alone does not submit the application.'}
        </p>
        {message && <div className="miih-admin-good" role="status">{message}</div>}
        {stage === 'done' ? (
          <div className="miih-admin-callout" role="status">
            <strong>{status === 'PENDING' ? 'Awaiting approval' : `Status: ${status}`}</strong>
            <p>{status === 'PENDING'
              ? 'The Super Admin can review this request under Admin Configuration. You will not receive admin access until approved.'
              : status === 'APPROVED'
                ? 'You can sign in to the admin dashboard.'
                : 'Check with your Super Admin before attempting another request.'}</p>
          </div>
        ) : (
          <>
            {stage === 'complete' && (
              <div className="miih-admin-callout" role="status">
                <strong>Step 2 of 2 — Submit your admin application</strong>
                <p>If you received a verification email, confirm it before proceeding. Then sign in below so the application appears in Admin Configuration.</p>
              </div>
            )}
            <form onSubmit={submit} className="miih-access-form">
              <label>Full name
                <input required minLength={2} maxLength={200} autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
              </label>
              <label>Work email
                <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@zeaisoft.com" />
              </label>
              <label>{stage === 'create' ? 'Create password' : 'Account password'}
                <input required type="password" autoComplete={stage === 'create' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
              </label>
              {stage === 'create' && (
                <label>Confirm password
                  <input required type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </label>
              )}
              {error && <p className="miih-admin-error" role="alert">{error}</p>}
              <button className="miih-admin-primary" disabled={busy} type="submit">
                {busy ? 'Please wait…' : stage === 'create' ? 'Create account and request access' : 'Sign in & submit approval request'}
              </button>
            </form>
            {stage === 'create' && (
              <button className="miih-admin-outline" type="button" onClick={chooseExistingAccount}>
                Already created an account? Complete request
              </button>
            )}
          </>
        )}
        <a className="miih-admin-outline" href="/admin/login">Go to Admin sign in</a>
        <div className="miih-access-steps"><span>1 · Create account</span><span>2 · Submit request</span><span>3 · Super Admin approval</span></div>
      </div>
    </div>
  );
}
