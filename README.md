# Daywell

One action, two insights: type "Nasi lemak RM5" and Daywell records the spending and the calories.

**Status: working local-first web app (v0.1).** Data lives in your browser. No accounts, no cloud, no AI service yet. See "What works" and "Not built yet" below.

## Run it on Windows (step by step)

1. Install Node.js 20 or newer (the LTS installer from nodejs.org). Open a new **PowerShell** window and check: `node -v`
2. Open the project folder: `cd path\to\daywell`
3. Install: `npm install`
4. Start: `npm run dev` and open the address it prints (usually http://localhost:5173)
5. Tests: `npm test`
6. Production build: `npm run build` (output in `dist/`), preview it with `npm run preview`

No environment variables are needed right now. `.env.example` only reserves names for later stages.

## Deploy free (static hosting)

Because the app is static and stores data in the browser, any static host works.

**Netlify (drag and drop):** run `npm run build`, then drag the `dist` folder onto app.netlify.com/drop.

**Vercel / Cloudflare Pages / Netlify from GitHub:** push the project to GitHub, import it, build command `npm run build`, output directory `dist`.

Test on your phone: open the deployed https address in Safari or Chrome. Use Share > Add to Home Screen to get a home-screen icon. Note each device has its own separate data until cloud sync exists.

## What works (verified by automated tests, 45 passing)

- Quick log by typing: "Nasi lemak RM5", "Petrol RM50", "I ate two boiled eggs and a banana", "Bought lunch for RM12", multiple items per sentence, English and Bahasa Melayu, number words ("five ringgit").
- Review screen before saving: edit item, price, category, date, time, meal type, quantity, portion, calories. "I ate this" switch: purchases are not counted as eaten unless confirmed.
- Voice input via the browser's speech recognition (consent notice, English/BM, editable transcript, permission-denied and unsupported-browser fallbacks).
- Manual entry that needs no AI.
- Activity timeline (expenses and meals merged, grouped by day), search, filter, edit, delete with linked-record choices, "I ate this" on a purchase.
- Health: calorie ring, macros, meal breakdown, 7-day trend (empty days shown as "no data", never faked), averages over logged days only, common foods.
- Finance: today, week, month, budgets, category totals, largest expenses, month comparison, recent transactions.
- Money is stored as whole sen, so totals never drift. Days and months follow the timezone in Settings (default Asia/Kuala_Lumpur).
- Retrying a save never duplicates records. Refresh keeps data. CSV export. Light and dark themes.

## Important accuracy notes

- Calories for the ~23 built-in Malaysian foods are **approximate typical-serving estimates, not a verified database**. They are labelled "est." in the app and every value is editable. Replace `src/lib/foods.ts` with a verified source when you have one.
- Foods not in the table get **no calories** (blank), never a guess.
- The parser is rule-based. It cannot understand everything. Anything unclear shows on the review screen for you to fix.

## Not built yet (honest list)

- Food photo recognition, receipt scanning/OCR, AI parsing of free-form text (needs an AI provider and a server function to hold the API key; check current pricing first, a chat subscription does not include API credits).
- Accounts, cloud sync, two-user isolation. `supabase/migrations/0001_init.sql` is a reference schema with Row Level Security, **never run against a real database**.
- Browser notifications and notification history (budget/calorie alerts appear as notices on Home only).
- Recurring expenses, water and weight tracking, receipt storage.
- Offline mode / service worker. A manifest and icon exist, but I have not implemented or tested installability or offline use.
- Apple Health / HealthKit (needs a native iOS app). Nothing in Daywell talks to Apple Health.

## Known limitations

- Data is per browser. Clearing site data deletes it. Export CSV regularly.
- Not tested on real iOS Safari, Android, or with a real microphone. Layout was built mobile-first but only checked through code and automated tests, not visually.
- Account deletion = "Delete all data" on this device (there are no accounts yet).

## Costs

None today. Static hosting free tiers are enough. AI features, when added, will cost per use.

## Project map

- `src/lib/` money, time zones, parser, food table, store, statistics (pure code, unit tested)
- `src/QuickLog.tsx` input, voice, review sheet
- `src/Timeline.tsx` activity list and edit sheet
- `src/Screens.tsx` Home, Health, Finance, Settings
- `src/*.test.ts(x)` tests


## Cloud save (optional, Google sign-in)

Daywell works fully offline in the browser. To keep a private copy in the cloud and use it on several devices:

1. Create a free project at supabase.com.
2. In the SQL editor, run `supabase/migrations/0003_user_state.sql` (one private row per user, protected by Row Level Security).
3. Authentication → Providers → **Google**: enable it with a Google OAuth client ID and secret (Google Cloud Console → APIs & Services → Credentials → OAuth client, type Web). Add the callback URL Supabase shows you as an authorized redirect URI in Google.
4. Authentication → URL Configuration: set **Site URL** and add your app address (for example `https://rdavincii.github.io/daywell/`) to **Redirect URLs**.
5. In the app: Settings → Data → paste the project URL and the anon/publishable key, then **Sign in with Google**.

The deployed site is pre-connected through `.env.production` (project URL and anon key; both are public by design, protected by Row Level Security). Never put a service-role key there.

## Food lookup keys (stored only in your browser)

Settings → Data: a free Google AI (Gemini) key enables meal-photo scan and AI estimates for dishes no database has; a free USDA FoodData Central key avoids the shared rate limit.
