# Made in India

The Made in India hackathon website, organised by ZeAI Soft. This project uses React, TypeScript, and Vite, following the frontend layout in the supplied `Sample Test Code/react.md` reference.

## Run locally

Use Node.js 22.13 or newer within the Node 22 series (or another version supported by `package.json`). From this folder:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. Editing a source file refreshes the local preview automatically. `npm start` also starts this development server.

## Structure

```text
made in india hackathon/
├── public/
│   ├── favicon.svg
│   ├── fonts/                     # Local Manrope variable font and OFL license
│   └── media/                     # Photos, posters, and local MP4 clips
├── src/
│   ├── app/
│   │   ├── App.tsx                 # Shared page layout and metadata
│   │   └── router.tsx              # Home, About Us, Gallery, Register routes
│   ├── assets/
│   │   └── images/                 # Supplied header logo and transparent footer variant
│   ├── components/
│   │   ├── common/                 # Logo, shared hackathon benefits, and not-found page
│   │   ├── layout/                 # Header and footer
│   │   └── ui/                     # Shared icons
│   ├── features/
│   │   ├── home/pages/HomePage.tsx
│   │   ├── about/pages/AboutPage.tsx
│   │   ├── gallery/                # Gallery page, media data, viewer, and preview
│   │   └── registration/pages/RegisterPage.tsx
│   ├── hooks/                      # Reusable mobile-menu behaviour
│   ├── constants/                  # Site details, domains, confirmed benefits, and routes
│   ├── types/                      # Shared TypeScript types
│   ├── styles/
│   │   ├── globals.css
│   │   ├── experience.css         # Responsive typography and visual refinements
│   │   └── variables.css
│   └── main.tsx
├── scripts/create_static_routes.mjs
├── tests/                         # Browser regression checks
├── index.html
├── .env.example
├── eslint.config.js
├── prettier.config.js
├── playwright.config.ts
├── tsconfig.json
├── vite.config.ts
├── package.json
└── README.md
```

The reference's feature folders are adapted to Home, About, Gallery, and Registration. Add services, providers, a store, or additional feature folders only when the site needs them. The Python employee API and database example are separate from this frontend and are not part of the website.

## Edit content

- Home purpose, hackathon domains, participant benefits, and past-edition context: `src/features/home/pages/HomePage.tsx`.
- Interactive home photo stack: `src/features/home/components/HeroVisual.tsx` and `hero_visual.css`.
- Domain buttons and example questions: `src/features/home/components/DomainExplorer.tsx`.
- Shared domain and benefit content: `DOMAINS` and `CONFIRMED_BENEFITS` in `src/constants/hackathon.ts`. Update these shared values to keep Home and Registration consistent.
- Reusable participant-benefits section: `src/components/common/HackathonBenefits.tsx`.
- Company introduction and leadership: `src/features/about/pages/AboutPage.tsx`. ZeAI Soft is a product company, as confirmed by the project owner. The company story, mission, vision, values, and strengths use original copy centred on building useful AI products. The leadership section highlights Kirthika only. Describe LabX's intended role without presenting planned activities as already live.
- LabX's Develop, Connect, and Grow controls: `src/features/about/components/LabXFocus.tsx`.
- Upcoming event, registration notice, and FAQs: `src/features/registration/pages/RegisterPage.tsx`. Eligibility remains to be announced.
- Contact information and logo: `src/constants/app.ts` and `src/assets/images/`. Email and telephone details were checked against [ZeAI Soft's official contact page](https://www.zeaisoft.com/get-in-touch.php). The displayed office address was supplied by the project owner; see the asset and contact notes below.
- Shared navigation and footer: `src/components/layout/`.
- Colours and responsive styles: `src/styles/`; `experience.css` applies the shared responsive typography and current visual treatment.
- Gallery page: `src/features/gallery/pages/GalleryPage.tsx` and `src/features/gallery/styles/gallery.css`.
- Gallery media, hero photos, and video selections: `src/features/gallery/data/media.ts`, with local assets in `public/media/`. See [media credits](MEDIA_CREDITS.md) for the original sources.

### Interactive sections

The home memory book (`GalleryPreview.tsx`) lets visitors select five event moments using thumbnail buttons or previous/next arrows. The next-edition card (`NextChapter.tsx`) offers three themes with three inspiration prompts each, alongside the upcoming-event link. These prompts are explicitly examples, not official challenges. Both interactions work with keyboard and touch, without timers or extra animation dependencies.

About Us has a photographic introduction, a three-step interactive story (`AboutJourney.tsx`), separate mission and vision cards, and a dedicated founder portrait feature. Values, LabX, and strengths retain the confirmed content. The nineteen gallery photo titles and captions use short editorial lines about building, teamwork, and the shared event experience. Alternative text retains accurate visual descriptions for accessibility. The same titles and captions appear wherever those images are reused in the home Polaroids, memory book, and About story.

The home hero is a vintage Polaroid stack using the nine hackathon photos. Clicking the stack, tapping it, or activating its button with Enter or Space drops the next photo onto the previous cards and wraps after photo nine. At most three photo cards remain mounted. Images use CSS grayscale and contrast filters; their original files are unchanged. A live counter announces the current photo, and the separate “Explore the moments” link opens the gallery. The approximately 400 ms drop animation becomes an immediate update when reduced motion is preferred.

The twelve domain buttons each select an example starting question. These questions are sample ideas, not official challenge briefs. The selected button exposes its pressed state and updates a live status region. About's LabX controls similarly select Develop, Connect, or Grow and explain the initiative's intended areas of focus; selecting one does not claim that the corresponding service is live.

The separate `/gallery` page shows Photos, Videos, and Afterparty as three sequential sections, with no category tabs:

- **Photos** (`#gallery-photos`): 9 distinct photos with captions overlaid on the images. The horizontal strip advances every four seconds while active, with Pause/Resume and Previous/Next controls. Hovering or focusing the strip pauses movement; swiping, scrolling, or using the arrows stops automatic movement until Play slideshow is selected again. It also pauses off-screen, while a viewer is open, or when the page is hidden.
- **Videos** (`#gallery-videos`): 5 locally stored event films include both supplied edited videos in full, a project discussion, an award moment, and the afterparty. Portrait footage is shown without cropping. They request muted, looping playback as they enter view. Click or tap a film to toggle playback, or use its accessible Play/Pause button with the keyboard. The browser's native controls bar is hidden. Clips pause off-screen, when the page is hidden, or while a photo viewer is open. A deliberate pause persists when the visitor returns to the clip; an explicit play action resumes it. Files load on demand, and browser autoplay restrictions show a manual-play message.
- **Afterparty** (`#gallery-afterparty`): 10 distinct DJ, dance-floor, and celebration photos with overlaid captions in a manually scrollable strip, with swipe and arrow controls.

Reduced-motion preferences start photo and video autoplay paused. Photos and afterparty images open in separate viewer collections with keyboard navigation. Header, footer, and home-page previews link to the gallery. Photos, posters, and videos are served with the website, without a third-party video player or a backend. All displayed media now comes from the project owner's 2026 event collection. Source filenames, Drive links, and editing details are in [media credits](MEDIA_CREDITS.md). Older stock assets and their credit documents are retained for reference but are no longer displayed.

The past-edition card displays Bengaluru, Karnataka without a campus image. About Us features the Grand Winner board photo, also retained in the gallery. The group-stage photo and college photo have been removed from the website assets. The founder profile uses the owner-provided `1782155451259.png`, copied unchanged to `public/media/made-in-india-2026/kirthika-founder-portrait.png`. This 800 × 800 portrait retains its original beige background; no retouching or background removal has been applied. Earlier transparent cutout and retouched portraits are retained as inactive backups; their editing history is recorded in [media credits](MEDIA_CREDITS.md).

### Typography, logo, and office address

The responsive type system uses the locally hosted Manrope variable font at `public/fonts/manrope-variable.ttf`. Its license is included at `public/fonts/OFL-Manrope.txt`. `src/styles/experience.css` loads the font and adjusts text sizes across screen widths. Noneditable page content uses a transparent text caret; inputs, textareas, and editable content retain their normal caret. Keyboard focus indicators remain visible.

The header uses the original full-colour logo at `src/assets/images/made-in-india-logo.png`. The footer uses the transparent variant at `src/assets/images/made-in-india-logo-footer.png` with a CSS off-white monochrome treatment directly on charcoal. There is no panel, border, or shadow around it. The transparent asset's generation prompt is recorded below for provenance; its pixels are unchanged by this styling.

The final image-edit prompt was:

> Use case: background-extraction. Edit target: supplied ZeAI Soft #MadeInIndia logo. Produce a clean transparent PNG logo for a dark charcoal website footer. Remove ALL white background including white gaps and counters, preserve precise original letter shapes, layout, full spelling, textured purple Ze, orange #Made, outlined blue In, green India, purple vertical SOFT and small EMPOWERING YOU tagline. For legibility on charcoal, change only the black AI letters to white/light silver and the dark blue outline of In to a pale blue-white outline. Keep all other brand colors and typography unchanged. No new text, no replacement font, no shadow, no white rectangle, no surrounding decoration. Crop the transparent canvas closely around the complete horizontal logo with a small transparent margin. Very wide horizontal composition, same proportions as original wordmark. Must have genuine alpha transparency.

The project owner supplied the current footer address: **8th floor Kosmo one Tower C, Ambattur Industrial Estate, Ambattur, Chennai, Tamil Nadu 600058**. Its location link opens a [Google Maps search for that address](https://www.google.com/maps/search/?api=1&query=8th%20floor%20Kosmo%20one%20Tower%20C%2C%20Ambattur%20Industrial%20Estate%2C%20Ambattur%2C%20Chennai%2C%20Tamil%20Nadu%20600058). Update `SITE.ADDRESS` and `SITE.MAP_URL` together when the office information changes.

### Confirmed next-edition content

The project owner confirmed these benefits for the next edition:

- Certificates.
- Structured workshops.
- Guaranteed mentorship.
- Networking programmes.
- Games.

Keep these in `CONFIRMED_BENEFITS` and use the shared benefits component wherever they appear. Event dates, venue, eligibility, and the official Microsoft Forms URL remain pending. Registration currently opens an informational dialog. Microsoft Forms remains the planned registration destination; replace the dialog action with the official form link opening in a new tab when it is supplied. Do not promise school or college eligibility before the participation rules are finalised.

### Historical content and source boundaries

The project owner supplied the 2026 edition's dates of **3–4 October 2026**, its displayed location of **Bengaluru, Karnataka**, and **offline finals with online participation available only for the Investor Pitch component**. These details have not been independently verified against public web sources. Keep them explicitly associated with the past 2026 edition, separate from the upcoming event.

Prizes, travel support, internships, and hiring opportunities were promoted for the 2026 edition. They are historical promotional details, not confirmed benefits of the next edition. Do not imply that advertised opportunities were awarded or that they will recur.

The supplied figures of **600+ teams** and **100 finalists** are excluded from public pages pending supporting records. Do not invent participant counts, winners, dates, or outcomes. Official company pages support company and contact information; they do not independently establish the supplied event history or upcoming benefits.

## Build and check

The gallery uses varied desktop photo sizes with full-width Grand Winner and DJ spotlights. Each spotlight opens its matching gallery collection; arrow navigation follows each card's actual position. Photos, videos, and afterparty remain sequential on one page.

Buttons have subtle press and arrow feedback, and gallery sections reveal once as they enter view. Reduced-motion changes take effect without reloading. On phones, a compact Gallery / Next edition shortcut bar appears after the intro, hides near the footer and while menus or dialogs are open, and accounts for the device's bottom safe area. On Gallery and Register, the corresponding shortcut links to the relevant section on that page.

```powershell
npm run check
npm run build
npm run preview
```

`dist/` contains the generated static website. Edit `src/`, not `dist/`. The build creates HTML entry points for `/`, `/about`, `/gallery`, and `/register`, so those pages can be opened directly on a static host. React Router handles navigation in the browser. There is no application backend, database, or required environment secret.

```powershell
npm run build
npm test
```

Browser tests use Google Chrome installed on the computer and check the built website on desktop and mobile. They start and stop their own local preview server. Stop any other process using port 4173 before running them, or use another port with `$env:PLAYWRIGHT_PORT = '4181'` in PowerShell. Media tests check real local MP4 decoding and advancing playback, as well as gallery navigation, controls, reduced motion, and player lifecycle. Optional code-quality commands are `npm run lint` and `npm run format`.

The previous plain-JavaScript source is retained in `.archive/plain-javascript/`. The earlier nested preview checkout is retained in `.archive/initial-preview/`. Both are backups, not the active source.

The existing `.openai/hosting.json` keeps the same Sites identity and `dist` output directory. This restructuring is local; publishing is a separate action.
