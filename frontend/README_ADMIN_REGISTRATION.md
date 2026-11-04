# ZeAI #MadeInIndia — Registration Popup + Full Admin Frontend

## Integration target

This package extends the **existing** React 19 + TypeScript + Vite project. It is **not** a redesign.

- Public Home, About and Gallery React components, CSS, images, videos and fonts are copied unchanged from your supplied MIIH.zip.
- The Register page keeps its existing sections/theme and replaces only the previous informational dialog with the actual team registration popup. Published event details flow into the existing event panel.
- A separate `/admin` route runs the admin application, without the site's public header/footer. A single app-level content adapter, `PublishedContentBridge`, reads published CMS slots without requiring edits to the other public page source files.
- The existing **complete FastAPI backend** is required; this ZIP contains no backend DB credentials or new SQL migration.

## Install on Windows — Command Prompt

From `N:\WORK\ZEAI\made in india hackathon`:

```bat
cd /d "N:\WORK\ZEAI\made in india hackathon"
```

1. Back up your existing frontend and commit your work first.
2. **For the patch ZIP:** extract `frontend_patch/` and merge **its contents** into your existing frontend project root (the folder holding package.json). Do not delete existing files, media, or `.env.local`.
   **For the full frontend ZIP:** use the contents of `MIIH/` as a complete frontend checkout; it already contains the original public assets.
3. In the React project folder:

```bat
npm install
if not exist .env.local copy .env.example .env.local
notepad .env.local
```

Set **only the browser-safe API URL**:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000/api/v1
```

4. Keep the separate FastAPI backend running on port 5000 in another CMD terminal. Its own backend `.env` must have `SUPABASE_URL`, `DATABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (private uploads), and `FRONTEND_ORIGINS` for your dev/deployed frontend.
5. Start Vite:

```bat
npm run check
npm run dev
```

The existing Vite config uses **http://127.0.0.1:4173** (different from localhost; both origins should be in backend CORS).

- Site: `http://127.0.0.1:4173/`
- Team registration: `http://127.0.0.1:4173/register`
- Admin sign in: `http://127.0.0.1:4173/admin`

**Never put the service-role key or `DATABASE_URL` in frontend environment variables.** Only the FastAPI backend may use them. Do not commit `.env` or `.env.local` to Git.

## Admin navigation / permissions

Separate sidebar pages: Dashboard, Teams, Participants, Revenue, Statistics, History, Website Editor, Frontend Preview, Gallery & Media, Registration Form, Hackathon Settings, Exports, Admin Permissions, My Profile.

- Super Admin: all 24 active permissions, manages payment URL/fee/button, publishes forms/site/editions, approves admins and grants permissions.
- Regular Admin: only pages enabled through `admin_permission_assignments`. Default = **no grants**; Super Admin enables allowed ones.
- `SITE_PREVIEW` allows view-only CMS; `SITE_CONTENT_EDIT`/`GALLERY_EDIT` are required to save revisions; site publish requires SUPER_ADMIN.
- Existing server-side guards are **authoritative**. Hiding a sidebar item is UI convenience, not security.

### Signing in

Use the Supabase Auth email/password for the already-bootstrapped approved Super Admin. New admins sign up, confirm their email, apply for approval, and wait for Super Admin to approve them. Their passwords are handled by Supabase Auth.

## Content editing with no redesign

1. Go to **Website Editor** or **Gallery & Media**; select a page and one of the existing **165 CMS slots**.
2. For a slot not yet mapped to a visible page element, press **Pick element from page**, then click the desired text/image/video in the embedded same-origin preview. The selector is stored as `content_json.target_selector` with the revision. This is how the admin can bind remaining sites without changing Home/About/Gallery component files.
3. Edit text, link, JSON, alt text, visibility, order, or upload a file to Supabase Storage; then **Save new draft**.
4. Use **Frontend Preview** to see draft overlays in a private admin iframe. Only Super Admin can **Publish**.
5. Published values are read from `/api/v1/public/site-content/{page}`. If FastAPI is offline or there is no published value, the original page remains visually unchanged.

**Important boundaries:** Slot records existing in Supabase do not automatically make all original DOM elements editable; every unbound slot must be mapped using Pick Element or an explicit selector. JSON slots are stored but complex array-driven React widgets need additional code binding if their interactions must change. Display-order values are stored but DOM reordering is not globally automatic. An editor can save all 165 slot records, but claim of complete live visual coverage requires mapping and testing each element. Avoid misleading production claims until this is verified.

For gallery video replacement, first review and (if appropriate) execute the optional backend migration `10_OPTIONAL_ENABLE_CMS_VIDEO_UPLOADS.sql`. Your existing public Storage bucket otherwise may reject MP4/WebM. The uploaded file-size limit also depends on your Supabase plan.

## Registration popup

- One **leader** registers a team of **four people by default (including the leader)**. Admin may change min/default/max team size through Hackathon Settings.
- Exactly the **12 configured domains** come from `edition_domains` when the edition is published.
- The source form questions come from the **published form version**, not hardcoded browser questions. Q25 is the Boolean investor-pitch question. Other member/team/pitch fields are dynamically generated; required, options, and conditional pitch rules come from the published form.
- Any photo or document is uploaded privately to Supabase Storage through FastAPI; PostgreSQL holds its file record/Storage path, not private public URLs.
- Razorpay is an **external hosted page**. Pay Now uses the **Super Admin-controlled URL** and stays disabled with the dummy placeholder. No payment processing or proof auto-verification happens in the browser.
- After payment, leader enters transaction ID, uploads a screenshot, saves evidence, and can submit only after mandatory browser checks. The **backend/DB independently revalidates** and keeps payment verification pending for staff review.
- When the edition/form/payment configuration is not published and enabled, the popup shows a **coming soon / preview-only** state; it will never collect fake/live payment details.

**Core team identity fields still have backend constraints regardless of form required flags.** Making them optional in a form draft does not change FastAPI's mandatory `TeamUpdate` validation. This should be resolved through an approved backend/data-model change if the business truly needs optional core identity data.

## Existing backend endpoints consumed

- `/api/v1/auth/signup`, `/login`, `/refresh`, `/admin/profile`
- `/api/v1/admin/me`, `/permissions`, `/apply`, `/application-status`, `/applications/pending`, `/applications/{id}`, `/{id}/permissions/{key}`
- `/api/v1/admin/dashboard`, `/teams`, `/participants`, `/revenue`, `/statistics`, `/history`, `/audit-logs`, `/exports`, `/exports/history`
- `/api/v1/admin/editions`, `/editions/{id}`, `/editions/{id}/domains`, `/editions/{id}/payments/config`
- `/api/v1/admin/forms/editions/{id}/versions`, `/forms/versions/{id}`, `/forms/editions/{id}/clone`, `/forms/questions/{id}`, `/forms/questions/{id}/options`, `/forms/versions/{id}/publish`
- `/api/v1/admin/cms/slots`, `/cms/preview/{page}`, `/cms/slots/{id}/revisions`, `/cms/revisions/{id}/publish`, `/cms/upload`
- `/api/v1/public/editions`, `/public/editions/{code}/registration-config`, `/public/site-content/{page}`
- `/api/v1/registrations/{code}/start`, `/{id}/team`, `/{id}/answers`, `/{id}/upload`, `/{id}/payment-evidence`, `/{id}/validation`, `/{id}/submit`

## Deploy frontend on Vercel

- Root directory is the React project folder containing package.json.
- Build command `npm run build`, output `dist`.
- Set `VITE_API_BASE_URL=https://YOUR-DEPLOYED-FASTAPI-HOST/api/v1` in Vercel's **frontend** Environment Variables.
- Keep `vercel.json` so direct `/admin/*` deep links load the React app.
- Deploy FastAPI separately, set server-only secrets there, and add your actual Vercel HTTPS origin to backend `FRONTEND_ORIGINS`.
- The Vite project requires Node 22.13+ or another package.json-supported Node version.

## Validation and rollout checklist

The source files passed an **offline TypeScript source-level check with local interface stubs**, not a real dependency-backed Vite build (the environment could not download npm packages). There is **no live Supabase integration test or user acceptance test** in this release.

Before launch, verify:

1. `npm install`, `npm run check`, `npm run build`, and browser tests on your workstation.
2. Real Super Admin and regular Admin logins, pending-account denial, RLS & Storage negative tests, and permission grants.
3. All 35 questions across four members, dynamic mandatory rules, uploads, Q25 conditions, team-size changes, double submits, and refresh scenarios.
4. Mapping each of the 165 content slots to the correct public DOM element, including media, alt text and responsive behavior; test public fallback and draft preview.
5. Real hosted Razorpay link with a **controlled test event**, manual proof verification, private signed URLs, exports and audit logs.
6. No publication to public registration until event, published form, official rules and payment are approved. Add CAPTCHA, rate limiting, malware/file scanning, and error monitoring before accepting public traffic.

**Other pages preserved**: `HomePage.tsx`, `AboutPage.tsx`, `GalleryPage.tsx`, all their original CSS/components, public media and fonts are untouched. The only existing React files edited are `src/features/registration/pages/RegisterPage.tsx`, `src/app/router.tsx`, and `src/app/App.tsx` (to load published CMS content without touching other pages).
