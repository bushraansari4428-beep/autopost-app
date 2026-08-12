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
