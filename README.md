# Road to 8–0 — World Cup Draft Game

A viral-format football game in the style of 38-0.app / 82-0.com. Spin for a legendary
national team, draft your XI, and simulate the 2026-format World Cup: 3 group games +
5 knockout rounds. Win all eight.

**Features:** All-time mode (56 squads, 1950–2026) · 2026-squads-only mode · 4 formations ·
3 difficulty levels · hard mode (hidden ratings) · 1v1 pass-and-play duel · simulate-all ·
Wordle-style share text · Buy Me a Coffee hook.

---

## 1. Run it on your computer (zero experience needed)

1. Install **Node.js** from https://nodejs.org (the LTS version, just click through the installer).
2. Unzip this folder somewhere, then open a terminal in it:
   - Windows: open the folder, click the address bar, type `cmd`, press Enter.
   - Mac: right-click the folder → "New Terminal at Folder".
3. Run these two commands:
   ```
   npm install
   npm run dev
   ```
4. Open the link it prints (usually http://localhost:5173). That's your game.

Any edit you make to files in `src/` reloads instantly in the browser.

## 2. Put it on the internet (free hosting)

The easiest path is **Vercel**:

1. Create a free account at https://github.com and one at https://vercel.com (sign in with GitHub).
2. Upload this project to a new GitHub repository:
   - On github.com click **New repository**, name it `road-to-8-0`, create it.
   - Easiest upload: on the repo page click "uploading an existing file" and drag the whole
     project folder contents in (skip the `node_modules` folder if it exists — never upload that).
3. On vercel.com click **Add New → Project**, pick your repo, click **Deploy**. Vercel
   auto-detects Vite. Two minutes later you have a live URL like `road-to-8-0.vercel.app`.
4. Every time you push a change to GitHub, the site redeploys automatically.

## 3. Get a proper domain (~AU$20/yr)

Buy something short and meme-able — `8-0.app` style — from **Cloudflare Registrar**
(at-cost pricing, no markup) or Namecheap. In Vercel: Project → Settings → Domains →
add your domain, then follow the two DNS records it tells you to set. Done.

## 4. Make money from it

In rough order of effort:

1. **Buy Me a Coffee (do this first, takes 10 min).** Create a page at buymeacoffee.com,
   then open `src/App.jsx` and replace the `BMC_LINK` constant at the top with your URL.
   This is exactly what 38-0.app does. Ko-fi is an alternative.
2. **Ads (once you have traffic).** Apply for Google AdSense once the site has real visitors
   and its own domain. Gaming-focused networks (Venatus, Playwire) pay better but want
   ~50k+ monthly pageviews first. One banner under the result screen is the standard spot —
   don't plaster the draft screen, it kills shareability.
3. **The real engine is the share button.** These games grow because people post their
   results. Post your own perfect-run screenshots on X/TikTok/Reddit (r/soccer,
   r/worldcup) DURING the tournament — the window is now. Tag big football meme accounts.
4. **Later:** a "pro" mode (more squads, custom drafts) behind a one-off payment via
   Stripe Payment Links, or sponsor slots if traffic spikes.

## 5. Editing the game

- **Add/edit squads:** everything lives in `src/data.js`. Each squad is one line.
  Format: `["Player Name", "GK|DEF|MID|ATT", rating]`. Ratings 76–99.
- **Tweak difficulty:** the `DIFFICULTY` object at the top of `src/App.jsx`.
- **Change colors/fonts:** the `CSS` string at the bottom of `src/App.jsx`.

## 6. Legal positioning (important)

This project deliberately follows the same approach as 38-0.app and 82-0.com:

- It is NOT named after or branded as "FIFA World Cup". FIFA enforces its trademarks
  aggressively, especially in tournament years. Keep "World Cup" usage descriptive.
- No official logos, badges, kits, fonts, or player photos. Flags-as-emoji and plain
  player names used descriptively are the same footing those viral sites stand on.
- Keep the disclaimer in the footer. Add a simple privacy policy page if you add ads
  (AdSense requires one — there are free generators).
- None of this is legal advice. If the site starts making real money, pay a lawyer for
  an hour to sanity-check it.

Good luck. Go 8–0. ⚽🏆
