# ZeAI #MadeInIndia Hackathon — Consolidated FastAPI Backend

This package **replaces Modules 01 and 02 plus the remaining backend modules**. It is intended to be merged into the existing working `backend/` folder. It does **not** include the React/Vite admin panel or registration popup; the public website remains unchanged.

## Status and safety

- Built for the existing **28-table Supabase schema** (migrations 01–09, including 165 CMS slots).
- The 12 domains and 35 registration questions remain in the database; no schema resets.
- Automated local tests cover routes, Super Admin safeguards, placeholder payment links, token checks, formatting, and existing Module 02 functionality. **They do not test your live Supabase account**. A real, isolated integration test is mandatory before deployment.
- Existing registration edition/form/payment config starts **unpublished/inactive**. No public registrations can be submitted until the real Razorpay URL, fee, published form, and published/open edition are configured.
- Never put a service-role key or PostgreSQL password in React or Git. Keep backend `.env` local and deploy secrets only to a protected backend host.

## Installation — Windows Command Prompt

1. Stop your currently running Uvicorn process (`Ctrl+C`).
2. Back up/commit your existing `backend/` folder, including the already working Module 02 files.
3. **Extract the contents of the ZIP's `backend/` directory into your existing `backend/` folder.** Merge/replace only source files. Do not replace your `.env`, `.venv`, or existing Git configuration.
4. Activate your venv and run:

```bat
cd /d "N:\WORK\ZEAI\made in india hackathon\backend"
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
python -m pytest -q
python -m uvicorn main:app --reload --port 5000
```

Expected: the test suite completes and Uvicorn prints `Application startup complete.` A `404` on `/` is normal; `/health` responds with `{"status":"ok"}`. You do **not** need Swagger.

## Environment variables

Keep the existing values in your `.env` file:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
DATABASE_URL=postgresql+psycopg://YOUR_USER:YOUR_URL_ENCODED_PASSWORD@YOUR_SUPABASE_POOLER_HOST:5432/postgres?sslmode=require
FRONTEND_ORIGINS=http://localhost:4173,http://localhost:5173
SUPABASE_SERVICE_ROLE_KEY=YOUR_BACKEND_ONLY_SECRET_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is an additional server-only secret required for file uploads and signed URLs. It is the **secret/service-role key for the same MIIH project**, not the publishable browser key. The backend never returns this key. Treat it as fully privileged. If you do not want to introduce that key yet, all non-upload endpoints can still be developed, but file uploads and exports will return a configuration error.

For Vercel: the React frontend can be hosted there; the FastAPI backend **must be deployed separately** or via a consciously configured Python runtime, not through `npm run dev`. Add the actual HTTPS frontend URL to `FRONTEND_ORIGINS` when deployed.

## Current Pay Now behavior — deliberately inactive

- The configured button label defaults to **Secure Your Spot - Pay Now**.
- The dummy URL is `https://example.com/miih-payment-placeholder`. It is **not** a working Razorpay payment page.
- The public configuration endpoint returns `payment_enabled: false`, `payment_url: null`, and a `placeholder_url`. The registration UI must render **Pay Now as disabled / Coming Soon**, not redirect to the dummy URL.
- Only the **approved Super Admin** can call `POST /api/v1/admin/editions/{edition_id}/payments/config` to save a new version of the Razorpay URL and payment fee, and activate it later.
- Valid active payment URLs must use HTTPS and recognized Razorpay hostnames (`rzp.io`, `rzp.link`, or `razorpay.com` subdomains).
- The original payment URL/amount referenced by submitted registrations is never edited in place; a new `payment_settings` version is created instead.
- A screenshot/transaction ID creates a **PENDING** payment submission. Only Super Admin can manually verify it. **No live payment integration, webhook, automatic transfer, or claim of paid status** is implemented.

**Optional SQL** (not automatically run): `sql/11_OPTIONAL_STORE_DUMMY_PAYMENT_URL.sql` stores the dummy link in the *existing inactive* configuration **only if the URL is currently NULL**. This does not activate payments. You can skip it: the application has the same safe placeholder fallback.

**Optional video Storage SQL**: `sql/10_OPTIONAL_ENABLE_CMS_VIDEO_UPLOADS.sql` permits MP4/WebM files up to 50 MB in the existing `miih-event-public` bucket. The original bucket only allows images/PDFs. Apply only after review and if your Supabase project supports that upload size.

## Main endpoints (prefixed `/api/v1`)

| Feature | Main routes | Access |
| --- | --- | --- |
| Authentication | `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh` | Public; Supabase Auth processes passwords |
| Admin applications | `POST /admin/apply`, `GET /admin/application-status` | Logged-in Supabase identity |
| Admin management | `GET /admin/me`, `GET /admin/permissions`, `GET /admin/applications/pending`, `PATCH /admin/applications/{id}`, `PUT /admin/{id}/permissions/{key}` | Approved admin / Super Admin |
| Admin profile | `PATCH /auth/admin/profile` | Approved admin |
| Permission configuration | `GET /admin/permission-catalog`, `GET /admin/admins`, `GET /admin/admins/{id}/grants` | Super Admin |
| Home dashboard | `GET /admin/dashboard` | `DASHBOARD_VIEW` |
| Teams | `GET /admin/teams`, `GET /admin/teams/{id}`, `PATCH /admin/teams/{id}/review` | `TEAMS_VIEW` / `REGISTRATION_REVIEW` |
| Participants | `GET /admin/participants`, `GET /admin/participants/{id}` | `PARTICIPANTS_VIEW` |
| Revenue | `GET /admin/revenue`, `PATCH /admin/revenue/payments/{id}` | Super Admin |
| Statistics | `GET /admin/statistics` | `STATISTICS_VIEW` |
| History | `GET /admin/history`, `GET /admin/audit-logs` | `HISTORY_VIEW` / Super Admin |
| Editions/settings | `GET /admin/editions`, `PATCH /admin/editions/{id}`, `POST /admin/editions/{id}/publish` | Event permissions; publish Super Admin |
| Domains | `GET /admin/editions/{id}/domains`, `PATCH /admin/editions/{id}/domains/{domain_id}?enabled=...` | Domain permissions |
| Pay Now configuration | `GET/POST /admin/editions/{id}/payments/config` | **Super Admin exclusively** |
| Form versions | `GET /admin/forms/editions/{id}/versions`, `GET /admin/forms/versions/{version_id}`, `POST /admin/forms/editions/{id}/clone` | Form permissions |
| Edit questions/options | `PATCH /admin/forms/questions/{id}`, `POST /admin/forms/sections/{id}/questions`, `PUT /admin/forms/questions/{id}/options` | `FORM_EDIT`, draft versions only |
| Publish form | `POST /admin/forms/versions/{id}/publish` | Super Admin |
| CMS editor | `GET /admin/cms/slots`, `POST /admin/cms/slots/{id}/revisions`, `POST /admin/cms/upload` | Content/Gallery edit |
| CMS preview | `GET /admin/cms/preview/{page_key}` | `SITE_PREVIEW` |
| CMS publish | `POST /admin/cms/revisions/{id}/publish` | Super Admin |
| Event content and highlights | `GET/PUT /admin/editions/{id}/blocks`, `GET/POST /admin/editions/{id}/highlights` | Event/History permissions |
| Exports | `POST /admin/exports`, `GET /admin/exports/history`, `GET/POST /admin/export-presets` | Export plus dataset permission; revenue Super Admin |
| Download private admin assets | `GET /admin/files/{asset_id}/signed-url` | Super Admin for private records |
| Public edition and CMS | `GET /public/editions`, `GET /public/editions/{code}/registration-config`, `GET /public/site-content/{page_key}` | Public |
| Team leader draft | `POST /registrations/{code}/start` | Public while registration open |
| Team draft updates | `GET /registrations/{id}`, `PUT /registrations/{id}/team`, `PUT /registrations/{id}/answers` | Secret `X-Registration-Token` header |
| Registrant private upload | `POST /registrations/{id}/upload` | Draft + token; multipart image/PDF |
| Payment proof | `POST /registrations/{id}/payment-evidence` | Draft + token; requires actual active Razorpay configuration |
| Submission check | `GET /registrations/{id}/validation`, `POST /registrations/{id}/submit` | Draft + token; checks database required fields |

`GET /admin/teams`, `/admin/participants` support edition/search/pagination, and teams support domain/status filters. Exports support edition/domain/status/date ranges, a chosen dataset and columns, and saved filter presets. XLSX uses **purple `#8C52FF` headers**, whitespace-aware widths, wrapped cells, frozen top row, and AutoFilter. CSV cannot preserve colors.

## How the registration process will work in the later React UI

1. Public registration popup fetches the **published** edition's form sections, options, 12 selectable domains, active rules, and Pay Now status.
2. Team leader creates a draft (receives a long random secret token). Leader enters the team and **four total members by default**, including themselves. The size limits are configurable in `hackathon_editions`.
3. Dynamic answers are saved with the form version and question IDs. Member names/emails/phones and team/domain fields are mirrored to answer rows so the user doesn't enter them twice.
4. Participant photos and documents upload to `miih-registration-private`. A private **Storage path** is retained in PostgreSQL, not a publicly usable URL.
5. Once Super Admin enables real payment, Pay Now opens the genuine Razorpay link; the leader uploads a screenshot and transaction ID; payment remains `PENDING` until verified.
6. The final submit control should call `/validation` and stay disabled while required fields are invalid; `/submit` revalidates everything in PostgreSQL so browser bypasses fail.
7. Question 25 remains an editable **Boolean** Yes/No field. Investor pitch details are conditionally required when selected.

## Technical architecture

```
backend/
├── main.py, config.py, database.py, requirements.txt, .env.example, .gitignore
├── design/api.yaml, design/er.puml
├── sql/ (OPTIONAL reviewed migrations only)
├── src/
│   ├── routes/ (FastAPI endpoint registration)
│   ├── controllers/ (existing controllers + HTTP coordination)
│   ├── service/ (authorization, validation, business logic)
│   ├── repository/ (parameterized SQL/SQLAlchemy access)
│   ├── models/ (Pydantic API payloads / existing SQLAlchemy models)
│   ├── utils/ (Supabase user-token validation / JSON formatting)
│   └── validators/
└── tests/
```

## Integration testing required before deployment

1. Sign in with actual Supabase Auth Super Admin; ensure only they can configure Pay Now, approve admins, grant permissions and publish content.
2. Sign in with a second regular Admin and with a pending Admin; check all 24 permission definitions against backend routes and **real Supabase RLS**.
3. Test team registration on an unpublished edition (must reject), then on a separate published test edition with a test payment link and no financial activity; verify all 35 questions and 4 members.
4. Check storage MIME and maximum sizes with actual Supabase project; video requires the optional Storage setting change.
5. Check anonymous uploads and private file requests fail without proper authorization. Test Supabase signed URLs expire.
6. Test duplicate transaction IDs, rejected payments, refunds, role suspension, CMS publish and rollback, high-volume pagination, Excel exports, concurrent form-version publication, and malicious form inputs.
7. Add abuse controls (rate limiting and CAPTCHA), operational monitoring, backup/restore, logging, and file malware screening before opening the public registration popup.
8. Build the **React admin panel** and connect the **existing** registration popup. This package includes backend routes only; no website theme/layout changes.

No live migrations or payments have been executed as part of building this ZIP.
