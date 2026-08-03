# hoodflylog
all things flyfishing I've created.
# HoodFlyLog

HoodFlyLog is a fly fishing catch log website/app.

## What we built today

- Created the React app with Vite
- Installed Node.js, Git, and VS Code
- Created the GitHub repo
- Connected the project to Cloudflare
- Deployed the app online
- Built the first HoodFlyLog dashboard
- Added working bottom navigation
- Created separate pages for:
  - Home
  - Log Catch
  - Journal
  - Knots
  - Fly Tying
- Built the Log Catch form
- Connected Supabase
- Created the `catches` table
- Added Supabase policies so the app can write catches
- Got the Save Catch button working with Supabase

## Current status

The app can save a catch to Supabase.

Current pages:
- Dashboard
- Log Catch
- Journal
- Knots
- Fly Tying

## Next steps

- Prevent blank catches from saving
- Load saved catches from Supabase when the app opens
- Show saved catches in the Journal after refresh
- Update dashboard stats from real catch data
- Add catch photos
- Add maps
- Add weather
- Build out Knots and Fly Tying libraries

## Tech stack

- React
- Vite
- Supabase
- Cloudflare
- GitHub
# 🎣 HoodFlyLog Roadmap

## Phase 1 - Core Catch Logging

### Completed
- [x] React app created
- [x] Cloudflare deployment
- [x] GitHub integration
- [x] Supabase integration
- [x] Dashboard page
- [x] Log Catch page
- [x] Journal page
- [x] Navigation system
- [x] Save catches to database

### Next
- [ ] Prevent blank catches from saving
- [ ] Load catches from Supabase on startup
- [ ] Display catches after page refresh
- [ ] Edit catches
- [ ] Delete catches

---

## Phase 2 - Dashboard Statistics

### Planned
- [ ] Total catches
- [ ] Biggest fish
- [ ] Favorite fly
- [ ] Favorite location
- [ ] Most productive water
- [ ] Catch history timeline
- [ ] Monthly catch statistics

---

## Phase 3 - Catch Photos

### Planned
- [ ] Upload fish photos
- [ ] Store photos in Supabase Storage
- [ ] Display photos in Journal
- [ ] Display latest catch photo on Dashboard
- [ ] Photo gallery

---

## Phase 4 - Mapping

### Planned
- [ ] GPS coordinates
- [ ] Interactive map
- [ ] Saved fishing locations
- [ ] River markers
- [ ] Catch heat map
- [ ] Favorite fishing spots

---

## Phase 5 - Weather

### Planned
- [ ] Current weather
- [ ] Water conditions
- [ ] Wind speed
- [ ] Temperature
- [ ] Barometric pressure
- [ ] Historical weather on catch entries

---

## Phase 6 - Knots Library

### Planned
- [ ] Improved Clinch Knot
- [ ] Perfection Loop
- [ ] Double Surgeon's Loop
- [ ] Nail Knot
- [ ] Blood Knot
- [ ] Loop-to-Loop Connection
- [ ] Images for each knot
- [ ] YouTube tutorials

---

## Phase 7 - Fly Tying Library

### Planned
- [ ] Woolly Bugger
- [ ] Clouser Minnow
- [ ] San Juan Worm
- [ ] Pheasant Tail Nymph
- [ ] Elk Hair Caddis
- [ ] Materials lists
- [ ] Step-by-step instructions
- [ ] YouTube videos

---

## Phase 8 - Reports

### Planned
- [ ] Fishing reports
- [ ] Catch trends
- [ ] Export to CSV
- [ ] Export to PDF
- [ ] Yearly summaries

---

## Phase 9 - Mobile App

### Planned
- [ ] Progressive Web App (PWA)
- [ ] Install on Android
- [ ] Install on iPhone
- [ ] Offline catch logging
- [ ] Offline map caching

---

## Phase 10 - User Accounts

### Planned
- [ ] Login system
- [ ] Personal profiles
- [ ] Multiple users
- [ ] Private catches
- [ ] Shared fishing reports

---
## Phase 11 - Smart Fly Advisor (Next Priority)

### Goal
First, enhance Log Catch so an uploaded photo plus GPS and weather can suggest catch details while keeping every value editable. Then use those conditions to recommend practical flies, colors, sizes, and presentations.


### Planned
- [x] Add an Analyze Photo action to the Log Catch workflow
- [x] Analyze the uploaded photo for likely fish species and visible characteristics
- [x] Combine photo analysis with permission-based GPS and an optional nearby place name instead of guessing location from the image
- [x] Load current weather and conditions for the captured GPS coordinates
- [x] Suggest useful catch fields such as species, location, weather notes, and confidence
- [x] Show which values were suggested by AI
- [x] Keep every suggested field editable before the angler saves the catch
- [x] Preserve manual entry when photo analysis is skipped or unavailable
- [ ] Compare Hugging Face vision models with Cloudflare Workers AI
- [x] Optimize for low-volume friends-and-family usage and minimal cost
- [x] Capture GPS coordinates with user permission
- [x] Load current weather for the selected location
- [x] Ask for water clarity: clear, stained, or muddy
- [ ] Ask for target species and water type
- [ ] Build a curated rules-based fly recommendation engine
- [ ] Evaluate Hugging Face models and inference providers
- [ ] Use Hugging Face to rank and explain rule-selected flies
- [ ] Return three recommendations with fly, size, color, presentation, and reasoning
- [ ] Cache recommendations by approximate location and conditions
- [x] Add per-user AI usage limits to control cost
- [x] Fall back to rules-only recommendations when AI is unavailable
- [x] Label results as AI-enhanced or rules-only
- [x] Keep all provider credentials in encrypted server-side secrets
- [ ] Test recommendation quality against real catch history

### Provider strategy
- Initial hosted provider: Cloudflare Workers AI
- Comparison provider: Hugging Face
- Local development option: LM Studio
- Required fallback: curated rules engine

---
### Catch Assistant implementation notes
- The hosted default is Cloudflare Workers AI using `@cf/moondream/moondream3.1-9B-A2B`, selected for efficient structured vision analysis without the separate Meta model-acceptance step.
- The endpoint requires a valid HoodFlyLog Supabase session and accepts images up to 5 MB.
- Each account is limited to 10 server-side analysis attempts per UTC day; the browser also limits normal use to 5.
- Photos and optional GPS/weather context are sent only when the angler presses **Analyze Photo + Conditions**. A separate, default-off checkbox is required before coordinates are sent to BigDataCloud for a nearby place-name suggestion.
- AI suggestions are never saved automatically. Every populated field remains editable and the user must press **Save Catch**.
- The Worker never asks the model to infer a named location from coordinates or estimate length without a visible scale reference.
- Local full-stack testing: `npm run dev:worker`.
- To evaluate Hugging Face instead, set `AI_PROVIDER=huggingface`, `HF_MODEL`, and the encrypted `HF_TOKEN` Worker secret.

## Long-Term Ideas

- [ ] Moon phase tracking
- [ ] Fish species database
- [ ] Expand Smart Fly Advisor with personalized fly recommendations
- [ ] River flow data
- [ ] Water level monitoring
- [ ] Fishing forecast system
- [ ] AI fishing journal summaries
- [ ] Tournament mode
- [ ] Gear inventory tracking
- [ ] Fly box inventory tracking