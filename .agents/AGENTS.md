# Project Architecture & Deployment Guidelines

**CRITICAL RULE:** This project is a Monorepo containing a Next.js Frontend (`frontend/`) and a NestJS Backend (`backend/`). The user accesses the live application online. You MUST adhere to the following architecture rules to avoid breaking the live deployments.

## 1. Live Deployment & Syncing
- **Online Access**: The user always accesses and tests the application online at `https://autopost-app-one.vercel.app` (Frontend on Vercel) and Backend on Render (`https://autopost-app-1.onrender.com`).
- **Auto Commit & Push Requirement**: After making and verifying any code fix or feature addition locally, you MUST ALWAYS commit and push the changes to GitHub (`git add . && git commit -m "..." && git push origin main`) so Vercel and Render auto-deploy the updates immediately. Changes made only to local files are useless to the user.

## 2. Vercel Frontend Rules (STRICT)
- **DO NOT MODIFY ROOT CONFIGS FOR VERCEL**: Never create or modify a `vercel.json` or `package.json` in the root directory to force Vercel to build the `frontend` folder. Doing so crashes Vercel's native Next.js builders.
- **Root Directory Setting**: The Vercel deployment is configured via the Vercel Dashboard (Settings -> General -> Root Directory = `frontend`). The codebase should remain clean.
- **Frontend Changes**: All frontend code must go inside the `frontend/` folder. Next.js handles routing and builds natively.

## 3. Scraper & Backend Architecture Rules
- **Xiaohongshu (RedNote) Scraper**: 
  - **NO Playwright**: Do not use Playwright or any headless browsers. They crash the Render server due to missing Chromium binaries and RAM limits.
  - **NO yt-dlp**: Do not use `yt-dlp` for Xiaohongshu. XHS blocks `yt-dlp` due to `xsec_token` and captcha requirements.
  - **Native HTTP Only**: You must rely exclusively on Native HTTP requests (`axios`/`fetch`) combined with RegEx parsing of the `__INITIAL_STATE__` JSON object to extract video streams.
- **URL Normalization**: Ensure all extracted video URLs are normalized (e.g., adding missing `https://` protocols) before saving to the database.

## 4. Scraper Debugging & WAF Loop Prevention
- **Anti-Loop Policy**: If an HTTP scraping request returns "No videos found" or `null`, DO NOT immediately assume your RegEx parsing is broken and DO NOT rewrite the code in a loop.
- **Mandatory WAF Check**: You MUST first log the HTTP status code and the first 500 characters of the raw HTML response to analyze it.
- **Security Bypass Strategy**: If the raw HTML indicates a WAF block (e.g., `<title>Verify</title>`, Captcha, 403 Forbidden, or missing `__INITIAL_STATE__`), acknowledge that it is a security block. You must then implement a bypass strategy such as reading the `XHS_COOKIE` environment variable and injecting it into the `Cookie:` header, rather than pointlessly tweaking Axios parameters or Regex logic.

## 5. Full Autonomous Execution (Zero-Interruption Policy)
- **Zero Permission Mid-Task**: Never pause, stall, or ask the user for permission or confirmation to edit files, run builds, execute commands, or push code. Execute tasks end-to-end autonomously.
- **Complete Before Replying**: Carry out complete problem analysis, file updates, build checks, and git commit/push independently. Only send a response to the user once the full task is completely executed and live.
- **Communication Language**: Communicate with the user in clear, concise Roman Urdu (or Urdu as requested).

---

## 6. Complete System Technical Summary & Recovery Blueprint

### A. Repository & Cloud Infrastructure
- **GitHub Repository**: `https://github.com/bushraansari4428-beep/autopost-app.git` (Branch: `main`)
- **Frontend (Vercel)**:
  - Live URL: `https://autopost-app-one.vercel.app`
  - Source Folder: `frontend/` (Next.js App Router, Tailwind CSS, Lucide Icons)
  - API Proxy: `frontend/next.config.ts` / `next.config.mjs` proxies `/api/*` requests to the Render backend (`https://autopost-app-1.onrender.com`).
- **Backend & Database (Render)**:
  - Live URL: `https://autopost-app-1.onrender.com`
  - Source Folder: `backend/` (NestJS + Prisma ORM + PostgreSQL)
  - Prisma Schema: `backend/prisma/schema.prisma`

### B. VPS Auto Bulk Video Generator & Prompt Sync Endpoint
- **VPS Server**: Windows VPS (`151.245.140.91`) running the automated video generation & uploading scripts (`C:\Users\Administrator\Desktop\Auto Bulk Video Generator`).
- **Direct Prompt File Delivery to VPS**:
  - Frontend Page: `frontend/src/app/dashboard/prompt-generator/page.tsx`
  - Backend Controller/Service: `POST /prompts/send-to-vps` (`backend/src/prompts/prompts.controller.ts` & `backend/src/prompts/prompts.service.ts`)
  - Mechanism: Users can rename their generated `.txt` prompt file directly in the UI (`customFileName`) and click **Send to VPS**, which pushes the `.txt` file to the VPS queue or exposes it via `/prompts/vps-queue` so the VPS worker picks it up automatically.

### C. Facebook Pages & 1-Click OAuth System
- **Frontend Screen**: `frontend/src/app/dashboard/pages/page.tsx`
- **Backend Service**: `backend/src/pages/pages.service.ts` & `backend/src/pages/pages.controller.ts`
- **Key Workflows**:
  1. **1-Click Facebook OAuth (`Connect Facebook (1-Click)`)**:
     - Redirects to Meta OAuth (`v19.0/dialog/oauth`) with scopes `pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata`.
     - Callback (`POST /pages/facebook/oauth-callback`) exchanges the code for a 60-day Long-Lived User Token, saves/updates the account in `FacebookAccount`, and fetches all managed pages (`me/accounts`).
     - **Zero-Duplication Import**: Existing pages (`pageId` match) only have their `accessToken` refreshed (`pagesUpdated`), preserving all Cloud Queue videos, Mappings, and Upload History. Newly created pages on the same Facebook ID are imported (`pagesImported`) with an automatic `MEGA_CLOUD` source (`cloud://<pageId>`) and active schedule (`04:30, 19:00`).
  2. **Content Monetization (CM) Scanner**:
     - `POST /pages/scan-monetization` scans connected pages via Graph API for Content Monetization invites/status and triggers WhatsApp alerts via `WhatsappService`.
  3. **UI Cleanliness Rule**:
     - Do NOT re-add non-working/unnecessary buttons like `AI Bulk Page Creator`, `Bulk Import (1000+ Pages)`, `Rename & Bio`, `Sync Creator`, or `Test CM` on page cards. Keep page cards clean with stats view, token expiry reminder, `Active` badge, and `Disconnect`.

### D. Prompt Generator & Video Reverse-Engineering Engine
- **Frontend Screen**: `frontend/src/app/dashboard/prompt-generator/page.tsx`
- **Backend Service**: `backend/src/prompts/prompts.service.ts` (`backend/src/prompts/prompts.controller.ts`)
- **AI Engine & Multi-Model Rotation**:
  - Uses Google Gemini API (`GEMINI_API_KEY` pool) with automatic 7-model fallback rotation (`gemini-flash-lite-latest`, `gemini-3.1-flash-lite-preview`, `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-3-flash-preview`, `gemini-flash-latest`, `gemini-2.0-flash`) to prevent 429 rate-limit bottlenecks.
- **Two Core Modes**:
  1. **Tab 1 — Native Video Reverse-Engineering Engine (`video_reverse`)**:
     - **Direct Video Upload Only**: Users upload a `.mp4`/`.mov`/`.webm` video clip directly (NO video link input).
     - Deconstructs the uploaded video's visual hook, camera POV, subject/action, climax, and Foley sound design, synthesizes a new re-skinned viral concept, and generates an initial verification test batch (5, 10, 15, or 20 prompts).
     - Provides 1-click expansion buttons (`Expand to 20 Prompts`, `Approve & Expand to 500 Prompts`, `Expand to 1,000 Prompts`).
  2. **Tab 2 — Universal Master Prompt Generator (`master_prompt`)**:
     - **100% Universal & Niche-Agnostic**: Zero hardcoded scene blueprints (`MASTER_SCENE_BLUEPRINTS` was permanently removed) and zero hardcoded default example prompts on page load.
     - Dynamically analyzes whatever example prompt(s) or concept the user pastes (whether 1 prompt or multiple numbered prompts, in any niche such as car restoration, cooking, miniature workers, comedy, ASMR, wildlife, etc.).
     - Extracts the exact paragraph structure, camera style, pacing, and audio format from the user's input, and generates 100% unique, non-repeating scene concepts in that exact niche and format.
     - Every generated card in `Scene Cards` has a 1-click **`Copy`** button (`handleCopyScenePrompt`) for instant individual testing, plus `.txt` file renaming, downloading, and 1-click **Send to VPS**.

### E. TikTok / RedNote (Xiaohongshu) / Cloud Sync Pipeline
- **Sync Service**: `backend/src/sync/sync.service.ts`
- **MEGA Cloud Upload**: `frontend/src/app/dashboard/upload/page.tsx` & `backend/src/mega/` — uploads bulk videos mapped to specific Facebook Pages (`cloud://<pageId>`) and auto-publishes them on each page's scheduled times.
- **TikTok -> YouTube / Facebook**: `frontend/src/app/dashboard/tiktok-youtube/page.tsx` & `backend/src/sync/tiktok.scraper.ts` & `xiaohongshu.scraper.ts`.

