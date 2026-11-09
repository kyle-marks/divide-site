# Landing Page Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Divide landing page around "the shared tab for your home", with a Siri-to-receipt hero animation, simulator clips of the new features, and iPhone Duo fold animations.

**Architecture:** The app repo gets a DEBUG-only "Home" demo seed behind a new launch flag, used to record clips from the iPhone, iPad and iPhone Duo simulators. The static site keeps plain HTML/CSS. One small dependency-free `site.js` handles the hero animation, playing clips only while they're on screen, the sticky header CTA, and the fold animation. A Python check script holds the receipt math and the media budget.

**Tech Stack:** Swift/XCTest (app seed), `xcrun simctl`, `ffmpeg` (encode MP4/WebM and posters), static HTML/CSS/vanilla JS, Python 3 standard library (checks).

**Spec:** `docs/superpowers/specs/2026-11-08-landing-page-refresh-design.md`

## Global Constraints

- No third-party requests: no CDNs, fonts or analytics. Everything is self-hosted under the site root.
- The page must not mention e-Transfer, receipt scanning, Plus or pricing, push notifications, Splitwise import, or any competitor by name.
- Light only. Colors come from the existing `:root` tokens in `style.css`.
- Clips: H.264 MP4 (`-movflags +faststart`), optional WebM/AV1 first if smaller, `muted autoplay loop playsinline`, a `poster` JPG, under about 1.5 MB each, and under about 6 MB of media in total.
- `prefers-reduced-motion: reduce` means no autoplay, no hero animation, and no fold animation. Final states are shown.
- The hero says "The shared tab for your home." and "iPhone, iPad and iPhone Duo · On the App Store January 2027".
- CTA label: "Join the beta on TestFlight". The URL is defined once (`data-beta-url` on `<body>`), with fallback `mailto:kyle.m.marks@icloud.com?subject=Divide%20beta` until a public TestFlight link exists.
- Phone width: no horizontal scroll at 375 px, with a 16 px gutter.
- The app repo seed is DEBUG-only. It is reachable only with `--divide-ui-fake`, and `UIFakeSeed.reviewGroup` stays unchanged.

## Review Focus

1. **Reduce Motion users** should see a complete, readable receipt and posters, with nothing animating. → Task 4 adds a check that the HTML ships the receipt in its final state (the JS only rewinds and replays it), and Task 6 verifies with emulated reduced motion.
2. **JS disabled or failing** should still leave the full page and all content visible. → Task 4: the receipt's final state is in the HTML, and the JS only rewinds and replays it.
3. **A slow connection** shouldn't download clips below the fold before they're needed. → Task 5: `preload="none"` on clips below the fold, and the check script asserts it.
4. **Inconsistent receipt numbers** (line items not adding up to the total, or a balance that doesn't follow 50/50) would undermine trust. → Task 4's check script computes them from `data-cents`/`data-payer`.
5. **A phone-width layout** with a wide receipt or video forcing horizontal scroll. → Task 6 checks `document.documentElement.scrollWidth <= innerWidth` at 375 px.

---

### Task 1: Home marketing seed (app repo)

Work in `~/Developer/divide` on a new branch `feat/marketing-seed` cut from `main`. Use a separate worktree if the main checkout is dirty.

**Files:**
- Modify: `Divide/App/UIFakeEnvironment.swift`: add `recurring: [RecurringExpense]` to `UIFakeSeed` (default `[]` for `reviewGroup`), load it in `UIFakeStore.init(seed:)` into `recurringTemplates`, and add `static func homeGroup(now: Date, calendar: Calendar = .current) -> UIFakeSeed`.
- Modify: `Divide/App/AppEnvironment.swift`: add `case seededHome` to `UIFakeLaunch`. `uiFakeLaunch(arguments:)` returns `.seededHome` when `--divide-ui-seed-home` is present (checked before `--divide-ui-seed`). `uiFake(...)` takes the launch case.
- Modify: `Divide/App/DivideApp.swift:34-35` to pass the launch case through.
- Test: `DivideTests/App/UIFakeSeedTests.swift`

**Interfaces:**
- Produces: the launch arguments `--divide-ui-fake --divide-ui-seed-home`. The group is named "Home", emoji 🏠, CAD, with members Kyle (current user) and Drea (`companionId`), and expenses across the last 4 months.
- Seed content:
  - **Recurring templates (monthly, equal split):** Rent $2,100.00 paid by Kyle on day 1, Hydro $86.40 paid by Kyle on day 3, Internet $75.00 paid by Drea on day 5.
  - **Each month** also has those three as expenses, plus groceries (Save-On-Foods, Costco, farmers market), dining (tacos, ramen), home goods, and a cat-food "Pets" style entry using an existing category. Use Vancouver place names.
  - **No** trip, cabin, firewood, canoe or gas-on-highway items.
  - **Current month:** at least 6 expenses on days 1–7, so a recording made on Nov 8 looks full.

- [ ] **Step 1: Write failing tests** in `UIFakeSeedTests`:
  - `testHomeSeedIsAHouseholdWithRecurringBills`: there's one group with `name == "Home"`, `currencyCode == "CAD"`, and 2 active members. `recurring.map(\.description)` is `["Rent", "Hydro", "Internet"]` (any order), all `.monthly`. There's no expense whose description contains "Firewood", "Canoe" or "Cabin".
  - `testHomeSeedDatesStayBetweenCreationAndToday`: the same loop as `testEveryExpenseFallsBetweenGroupCreationAndToday`, run on `homeGroup`.
  - `testHomeSeedHasFourMonthsAndBothPayers`: the months are `["2026-08","2026-09","2026-10","2026-11"]` at `now = 2026-11-07`, both members pay, and there are at least 6 current-month expenses.
  - `testHomeLaunchFlagNeedsFake`: `uiFakeLaunch(arguments: ["--divide-ui-seed-home"]) == nil`, and `uiFakeLaunch(arguments: ["--divide-ui-fake","--divide-ui-seed-home"]) == .seededHome`.
- [ ] **Step 2: Run** `./scripts/test-ios.sh` and expect compile failures (`homeGroup`, `.seededHome` undefined).
- [ ] **Step 3: Implement** the seed and the flag as described above. Share date clamping with `reviewGroup` through its existing private helpers. Don't duplicate them.
- [ ] **Step 4: Run** `./scripts/test-ios.sh`. All unit tests should pass, including the existing `reviewGroup` tests (unchanged).
- [ ] **Step 5: Commit** `feat(debug): Home marketing seed behind --divide-ui-seed-home`. Push the branch and open a PR to `main` titled "Home demo seed for marketing recordings" without merging it.

### Task 2: Record clips and stills

**Files:**
- Create: `scripts/encode_clip.sh` (site repo). Usage: `encode_clip.sh IN.mov NAME [crop]`. It writes `media/NAME.mp4`, `media/NAME.webm` (kept only if it's smaller than the MP4), and `media/NAME.jpg` (the poster, from the last frame). It also trims dead time at the start and end, scales to 720 px max on the long edge, and drops the frame rate to 30 fps.
- Create: `media/` with the outputs below.
- Raw `.mov` files go to the scratchpad, never the repo.

**Interfaces:**
- Consumes: the Task 1 build (`./scripts/test-ios.sh` builds the `.app` in DerivedData, or `xcodebuild build -scheme Divide -destination 'platform=iOS Simulator,name=…'`), launched with `xcrun simctl launch <udid> com.kylemarks.divide --divide-ui-fake --divide-ui-seed-home`.
- Produces (filenames are fixed, because Task 3 references them):
  - `media/entry.{mp4,webm,jpg}`: iPhone 17 Pro, the Add sheet, three expenses typed quickly (Tacos 42.00, Coffee beans 24.00, Cat food 39.00) with the sheet staying open.
  - `media/recurring.jpg`: a still of the Recurring expenses list (Rent, Hydro, Internet).
  - `media/insights.{mp4,webm,jpg}`: iPhone 17 Pro, Insights. Tap the Groceries block, open its detail, swipe to the next category, then go back.
  - `media/duo-closed.{mp4,webm,jpg}`: Duo closed, Home with Add in the rail, tapping Add.
  - `media/duo-open.{mp4,webm,jpg}`: Duo open, tapping Add so the register slides in beside the tab, then Hide.
  - `media/duo-half.jpg`: a still of the half-folded Insights if the simulator can pose it. Otherwise it's skipped, and Task 5 builds that view from `duo-open` Insights.
  - `media/duo-open-insights.jpg`: a still of the open Duo two-page Insights.
  - `media/ipad-home.jpg`: iPad Pro 13" landscape Home with the category blocks.
  - `media/siri-card.png`: if the `AddExpenseIntent` result card can be shown (run "Add an Expense" from the Shortcuts app in the simulator, with $84 Groceries), crop it with a transparent background. Otherwise skip it.

- [ ] **Step 1:** Confirm `ffmpeg -version` works. If it's missing, run `brew install ffmpeg`.
- [ ] **Step 2:** Write `encode_clip.sh`. Use H.264 `-crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an` for MP4, and `libsvtav1 -crf 40` for WebM.
- [ ] **Step 3:** Record each clip with `xcrun simctl io <udid> recordVideo --codec h264 --mask black raw.mov`, driving the taps through the simulator control tool. For Duo poses, set the pose by hand in Simulator (Device menu), record, then encode.
- [ ] **Step 4:** Run `du -ch media/*` and confirm each clip is about 1.5 MB or less and the total is about 6 MB or less. If not, raise the CRF or shorten the clip.
- [ ] **Step 5:** Commit `feat: recordings for the refreshed landing page`.

### Task 3: Page structure and copy

**Files:**
- Modify: `index.html` (full rewrite of `<main>`, header CTA, `<body data-beta-url>`)
- Modify: `style.css` (new section styles. Keep the existing tokens and receipt styles.)
- Delete: `shots/home.jpg`, `shots/add.jpg`, `shots/insights.jpg`, `shots/ipad-home.jpg` once nothing references them. Check `privacy/`, `support/` and `changelog/` first with `grep -r shots/`.

**Interfaces:**
- Produces: section IDs `hero`, `for-home`, `entry`, `recurring`, `insights`, `duo`, `ipad`, `omissions`, `get-it`. Every clip uses this markup: `<video class="clip" muted loop playsinline preload="none" poster="media/X.jpg" aria-hidden="true"><source src="media/X.webm" type="video/webm"><source src="media/X.mp4" type="video/mp4"></video>` (the WebM source is present only if the file exists). Every beta CTA is an `<a class="button beta-link">`.
- Copy: the hero and section order follow the spec's approved list. Each section's copy is 1–2 short sentences in the current voice. `<title>` becomes "Divide: the shared tab for your home". The meta description is updated to match.

- [ ] **Step 1:** Rewrite `index.html` and `style.css` to the section order. Lay out each feature section as text and media side by side on desktop, stacked on phone. Alternate sides.
- [ ] **Step 2:** Open it in the browser pane. Every section renders, the posters show, and the browser console shows no 404s.
- [ ] **Step 3:** Commit `feat: landing page restructured around the shared tab for your home`.

### Task 4: Hero receipt animation and the check script

**Files:**
- Modify: `index.html` hero receipt. Each line row gets `data-cents` and `data-payer` (`kyle`|`drea`). The Siri line is `<tr class="siri-line" data-cents="8400" data-payer="kyle">` and is present in the HTML. A caption `<p class="siri-ask">"Add $84 groceries to Divide"</p>` sits above the receipt.
- Create: `site.js` (deferred, no dependencies)
- Create: `scripts/check_site.py`

**Interfaces:**
- Receipt rows: Rent, Hydro, Internet, plus 3–4 current-month expenses from the Task 1 seed, plus the Siri groceries line. The total and "Drea owes you" are in the HTML in their **final** state (including the Siri line).
- `site.js` exposes nothing global. On `DOMContentLoaded`, if motion is allowed, it rewinds the receipt (hides `.siri-line`, sets the total and balance to their pre-Siri values computed from the data attributes), then plays: the caption fades in, the line prints in (height and opacity), and the total and balance count up over 600 ms. Once only.

- [ ] **Step 1:** Write `scripts/check_site.py` with these checks. Each one prints `FAIL: …` and exits 1 if it fails.
  - `check_receipt`: the sum of `data-cents` equals the `.total td` text in cents. The balance is the sum, over rows, of the other member's half (`cents//2`, with the payer absorbing the odd cent), netted, and it equals the `.amount` text.
  - `check_media`: every `src`/`poster` under `media/` exists, each file is ≤1.6 MB, and the total is ≤6.5 MB.
  - `check_preload`: every `video.clip` has `preload="none"`.
  - `check_forbidden`: the visible text of `index.html` doesn't contain (case-insensitive) `e-transfer`, `interac`, `splitwise`, `tricount`, `receipt scanning`, `divide plus`.
  - `check_links`: every `beta-link` href is empty or `#`, and is filled by JS from `data-beta-url`, or the anchor's href equals `data-beta-url`.
- [ ] **Step 2:** Run `python3 scripts/check_site.py`. `check_receipt` should fail until the receipt has its data attributes.
- [ ] **Step 3:** Add the data attributes and final numbers, and implement `site.js`.
- [ ] **Step 4:** Run `python3 scripts/check_site.py` and expect `OK`.
- [ ] **Step 5:** Commit `feat: hero receipt prints a Siri expense; site checks`.

### Task 5: Clips on screen, sticky CTA, Duo fold

**Files:**
- Modify: `site.js`, `style.css`, `index.html` (`#duo` section)

**Interfaces:**
- **Clip playback:** an `IntersectionObserver` with threshold 0.4 sets `video.preload = "auto"` and calls `play()` on enter, and `pause()` on leave. With reduced motion it does neither, and the posters stay.
- **Sticky CTA:** `.site-header .beta-link` is hidden until the hero's CTA leaves the viewport (an IntersectionObserver on `#hero .beta-link`). It's always in the DOM and focusable only while visible (`hidden` attribute toggled).
- **Duo fold** (`#duo .fold`): two panels (left and right halves of one recording or still), using CSS 3D `rotateY` on the left panel around the hinge edge. States are `closed` (folded to one panel showing `duo-closed`), `open` (flat, showing `duo-open`) and `half` (horizontal hinge at 100°, showing `duo-half.jpg` or `duo-open-insights.jpg` split top and bottom). Three small buttons ("Closed", "Open", "Half-folded") switch states. It auto-advances every 4 s while on screen and stops after any button press. With reduced motion there's no transition and no auto-advance, and it shows `open`.

- [ ] **Step 1:** Implement the three behaviours.
- [ ] **Step 2:** Run `python3 scripts/check_site.py` and expect `OK`.
- [ ] **Step 3:** Commit `feat: clips play on screen, sticky beta button, Duo fold`.

### Task 6: Verify

- [ ] **Step 1:** Serve the site locally (`python3 -m http.server` in the site root) and open it in the browser pane.
- [ ] **Step 2:** On desktop, take screenshots of each section, confirm the hero animation plays once, the clips play while on screen, and the fold switches states. The console should show no errors.
- [ ] **Step 3:** At 375×812, confirm `document.documentElement.scrollWidth <= innerWidth` and the sticky CTA doesn't cover content.
- [ ] **Step 4:** Emulate reduced motion (in DevTools, or temporarily toggle the media query in JS). Confirm the receipt is complete, nothing moves, and the posters show.
- [ ] **Step 5:** Run `python3 scripts/check_site.py`, then commit any fixes. Don't push or merge without the user's go-ahead.
