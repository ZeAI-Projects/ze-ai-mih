# Theme, flight and UI corrections

Implemented directly in the existing frontend. No backend, database schema, migration, authentication, payment, or permission logic was changed.

## Completed

- System-only light/dark tokens and shared surface, text, form, border, and interaction styling across public pages and Admin. No theme toggle or stored manual preference.
- Boarding pass: Grand Winner — ₹1,00,000; Ticket for 3; ZeAI #MadeInIndia; original completed-journey stamp retained. Souvenir disclaimer removed. Prize-pool and individual-award amounts remain distinct.
- Existing transparent official LabX artwork reused in the header.
- Continuous left-to-right climbing flight spline, tangent orientation, subtle banking and perspective. Model-attached red port, green starboard and restrained white lights respond to the system theme.
- Owner-supplied tower1/tower2 photographs, decoded before launch, composed without stretching or cropping tower tips, with feathered sky/city edges. tower1.png contains WebP data and is served unchanged with a .webp extension.
- No initial domain selection. Changing domains clears the previous challenge content while the real API request runs. Existing unpublished/empty and service-error states remain.
- Hover, focus, press and reduced-motion styling; reward reveal remains gated by completion, with existing explicit-skip and reduced-motion fallbacks retained.

## Verification

- npm.cmd run check: passed.
- npm.cmd run build: passed. Vite reports the existing lazy Three.js chunk above 500 kB (about 572 kB minified).
- Playwright: 36 distinct desktop/mobile cases verified. The full run passed 33; two legacy cleanup assertions incorrectly navigated to /about (which redirects back to the same home page), and the 18-visit admin screenshot audit exceeded its 30-second budget. The cleanup destination now genuinely unmounts the flight (/admin/login), and the admin audit has a 60-second budget. All three affected mobile cases passed on the targeted rerun (50.9 seconds, exit code 0).
- Rendered screenshots reviewed for light/dark public sections, boarding pass, flight, admin login and admin routes.
- Responsive coverage: 390, 768, 1440 and 1920 px, plus existing 360 and 1024 px flight checks.
- System color-scheme changes were emulated in Chromium; Windows settings were not changed.
- Admin route checks use isolated test-only API responses with empty datasets and no live writes. Live sign-in, published registration submission, payment completion, populated admin records and server-side permission enforcement were not exercised. Their application logic is unchanged.
- The Windows test runner's spawned-preview cleanup stalled after successful assertions. PLAYWRIGHT_EXTERNAL_SERVER=1 now allows testing against an explicitly managed preview; the final suite uses this mode on port 4187.

## Modified and added files

- frontend/VERIFICATION.md
- frontend/playwright.config.ts
- frontend/public/media/flight/CREDITS.md
- frontend/public/media/flight/tower1.webp
- frontend/public/media/flight/tower2.png
- frontend/src/assets/images/labx-transparent.png
- frontend/src/components/common/hackathon_benefits.css
- frontend/src/components/common/HeaderBrand.tsx
- frontend/src/components/layout/mobile_action_bar.css
- frontend/src/features/about/styles/about.css
- frontend/src/features/admin/styles/admin.css
- frontend/src/features/admin/styles/adminDialogs.css
- frontend/src/features/admin/styles/mediaStudio.css
- frontend/src/features/admin/styles/websiteStudio.css
- frontend/src/features/gallery/components/autoplay_video.css
- frontend/src/features/gallery/components/gallery_preview.css
- frontend/src/features/gallery/components/gallery_spotlight.css
- frontend/src/features/gallery/components/media_viewer.css
- frontend/src/features/gallery/components/photo_rail.css
- frontend/src/features/gallery/styles/gallery.css
- frontend/src/features/home/components/Challenges.tsx
- frontend/src/features/home/components/DomainExplorer.tsx
- frontend/src/features/home/components/flight_experience.css
- frontend/src/features/home/components/flight3d.ts
- frontend/src/features/home/components/flightEnvironment.ts
- frontend/src/features/home/components/FlightExperience.tsx
- frontend/src/features/home/components/hero_visual.css
- frontend/src/features/home/components/next_chapter.css
- frontend/src/features/home/components/SeasonReplay.tsx
- frontend/src/features/home/styles/game.css
- frontend/src/features/home/styles/home.css
- frontend/src/features/home/styles/season.css
- frontend/src/features/registration/components/teamRegistrationDialog.css
- frontend/src/features/registration/styles/registration.css
- frontend/src/main.tsx
- frontend/src/styles/experience.css
- frontend/src/styles/globals.css
- frontend/src/styles/selects.css
- frontend/src/styles/system-theme.css
- frontend/src/styles/variables.css
- frontend/tests/admin_theme.spec.ts
- frontend/tests/flight_environment.spec.ts
- frontend/tests/flight_regression.spec.ts
- frontend/tests/system_theme.spec.ts
