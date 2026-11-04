ZeAI × LabX — Made in India Hackathon
Official project repository for the Made in India Hackathon website, team registration experience, and administration platform.

Built for the ZeAI #MadeInIndia initiative, this application combines a public event website with challenge discovery, a gamified 2026-to-2027 experience, team registration, and permission-controlled event management.
Development branch: feature-mih-2027
Repository: https://github.com/ZeAI-Projects/ze-ai-mih
Status: Active development. Event content, challenge publication, and payment availability are controlled by the backend and admin configuration.

Features
Public website
- Responsive landing page with the ZeAI, LabX, and #MadeInIndia branding.
- Interactive 2026 → 2027 year transition and 2026 event replay.
- Three.js-powered cinematic flight experience featuring the Kuala Lumpur / Petronas skyline, swipe-to-launch controls, and an animated 2027 prize-pool reveal.
- Light/dark presentation that follows the device's system preference; no manual theme switch.
- Rising Builders and Next-Level Builders tracks, with domain-based challenge discovery and published problem-statement details.
- About Us, event memories, photo/video gallery, FAQs, and registration calls to action.
- Responsive layouts, keyboard-friendly interactions, and reduced-motion support.
Team registration
- Edition-aware event details and registration availability.
- Team and participant details, configurable form questions, and conditional inputs.
- Supporting uploads and payment-evidence workflow where enabled.
- Server-side validation and admin review of submissions.
Admin portal
- Protected sign-in and role/permission-based access.
- Dashboard, teams, participants, statistics, revenue, and audit activity.
- Event settings, registration form management, and problem-statement authoring/publishing.
- CMS/media management, content publishing, and export tools.
Note: Public registration, challenge listings, and payments depend on the active edition, published content, database schema, and approved admin configuration. Payment evidence and verification should not be confused with automated payment processing.

Technology stack
Layer	Technology
Frontend	React 19, TypeScript, Vite 8, React Router
3D experience	Three.js
Frontend testing	Playwright, ESLint, TypeScript
Backend	Python, FastAPI, Uvicorn
Data access	SQLAlchemy (async), Psycopg
Database/auth/storage	PostgreSQL and Supabase
Export support	OpenPyXL, ReportLab


Repository structure
ze-ai-mih/
├── frontend/
│   ├── public/                # Website images, video, flight assets, fonts
│   ├── src/
│   │   ├── app/               # App layout and route definitions
│   │   ├── components/        # Shared UI and layout
│   │   ├── features/          # Home, About, Gallery, Registration, Admin
│   │   ├── hooks/             # Shared React hooks
│   │   ├── lib/               # API utilities
│   │   └── styles/            # Global styles and system themes
│   ├── tests/                 # Browser tests
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/            # Public, registration, auth, and admin routes
│   │   ├── controllers/
│   │   ├── service/           # Business logic and access control
│   │   ├── repository/        # Database queries
│   │   ├── models/            # Request/response models
│   │   └── validators/
│   ├── sql/                   # Reviewed SQL scripts; not applied automatically
│   ├── tests/
│   ├── .env.example
│   ├── requirements.txt
│   └── main.py
└── README.md
Prerequisites
- Node.js: ^20.19.0 or >=22.13.0 (see frontend/package.json).
- Python: 3.12 recommended for the current Windows development setup.
- PostgreSQL/Supabase: Credentials for the project's configured backend database and Auth/Storage services.
- Git: To clone and collaborate on the repository.
Getting started (Windows)
1. Clone the feature branch
git clone --branch feature-mih-2027 https://github.com/ZeAI-Projects/ze-ai-mih.git
cd ze-ai-mih
2. Configure and start the backend
Open Terminal 1 in Command Prompt:
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
copy .env.example .env
Fill in backend/.env with your project's real server-side values (never commit it):
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
DATABASE_URL=postgresql+psycopg://USER:URL_ENCODED_PASSWORD@DB_HOST:5432/postgres?sslmode=require
SUPABASE_SERVICE_ROLE_KEY=YOUR_BACKEND_ONLY_SECRET
FRONTEND_ORIGINS=http://127.0.0.1:4173,http://localhost:4173
Then start the API:
python -m uvicorn main:app --host 127.0.0.1 --port 5000 --reload
- Health check: http://127.0.0.1:5000/health
- OpenAPI documentation: http://127.0.0.1:5000/docs
- API prefix: http://127.0.0.1:5000/api/v1
3. Configure and start the frontend
Open Terminal 2 from the repository root:
cd frontend
npm install
copy .env.example .env.local
npm run dev
In frontend/.env.local, use the browser-safe API URL:
VITE_API_BASE_URL=http://127.0.0.1:5000/api/v1
Open http://127.0.0.1:4173.
The frontend uses Vite port 4173 and expects the API on port 5000 by default. Start the backend before testing database-backed features.

Routes
URL	Purpose
/	Public website with anchored sections
/#about, /#gallery, /#register	Public section navigation
/admin	Protected admin application
/admin/dashboard	Admin dashboard (permission required)
/admin/teams	Team submissions and review
/admin/statistics	Event statistics
/admin/studio	Website content/media studio
/admin/form	Registration form management
/admin/settings	Event configuration


Legacy /about, /gallery, and /register paths redirect to their corresponding homepage sections.
Development commands
From frontend/:
npm run check
npm run lint
npm run build
npm test
From backend/ with the Python environment activated:
python -m pytest -q
Build output is generated in frontend/dist/. Do not edit that folder directly.
Configuration and publishing
- Frontend content and admin tools read data through the backend API.
- Public challenges must be created and published by authorized staff before they appear to visitors.
- Registration requires a valid active/published edition and correctly configured form rules.
- Sensitive operations such as publishing, payments, and permissions require the appropriate administrative access.
- SQL changes under backend/sql/ should be reviewed and applied only with project-owner approval. Do not run migrations automatically against a live database.
- For production, update VITE_API_BASE_URL to the deployed HTTPS backend URL and configure FRONTEND_ORIGINS for the deployed frontend domain.
Security guidelines
- Never commit .env, .env.local, database passwords, Supabase service-role/secret keys, or payment credentials.
- Only expose VITE_ values intended for the browser; backend secrets remain server-side.
- Review uploaded files, access permissions, and payment settings before a public launch.
- Use separate test and production environments, and back up the database before schema changes.
Troubleshooting
Problem	What to check
Frontend says the backend did not respond	Confirm /health responds on port 5000 and verify VITE_API_BASE_URL and CORS origins.
Challenge catalogue is unavailable	Check the backend response and whether required problem-statement tables/migrations are installed; do not apply SQL without approval.
Registration is unavailable	Verify the edition is published/open and its form and payment configuration are ready.
Port 4173 or 5000 is occupied	Stop the old local process before starting another server.
Frontend changes are not visible	Restart Vite after changing .env.local; check browser caching and console errors.


Collaboration
Development happens on feature branches. For the current MIIH work:
git switch feature-mih-2027
git pull origin feature-mih-2027
# After reviewing your changes:
git add -A
git commit -m "Describe your change"
git push origin feature-mih-2027
Create a pull request for review before merging into main.
Additional documentation
- [`frontend/README.md`](frontend/README.md) — Frontend details and media notes (some older sections may describe previous site iterations).
- [`frontend/README_ADMIN_REGISTRATION.md`](frontend/README_ADMIN_REGISTRATION.md) — Admin and registration integration notes.
- [`backend/README.md`](backend/README.md) — Backend setup, APIs, authorization, and safety notes.
Developed for ZeAI Soft × LabX × #MadeInIndia.
