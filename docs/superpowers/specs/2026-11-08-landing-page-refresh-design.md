# Landing page refresh: design

Date: 2026-11-08. Repos: `divide-site` (this repo) and `divide` (the app, at `~/Developer/divide`).

## Intent

The landing page was written around build 17. Builds 21–29 changed Divide substantially: iPhone Duo layouts, a rebuilt Insights, Siri and Shortcuts, and haptics. The Divide GTM plan (v2, 2026-11-08) also repositions the app as **"the shared tab for your home"**, aimed at **couples on iPhone first, then roommates**. Trips are explicitly out.

The page has three jobs, in order:

1. **What it does.** Within seconds a visitor understands that Divide is a running tab of shared household costs that shows who owes whom.
2. **Who it's for.** Couples and roommates sharing a home recognise themselves in it. It's not for one-off trips.
3. **Try it.** One clear beta call to action, at the top and again at the bottom.

## Goals

- Messaging matches the GTM plan's positioning and the App Store listing ("A running tab for your home").
- Show the things only Divide does: Siri entry, the fast entry pad, recurring household bills, the new Insights, and native iPad and iPhone Duo layouts.
- Use motion to show the product working, including Duo opening, closing and half-folding, without making the page slow or noisy.

## Non-goals

- Moving to a custom domain, invite-link landing pages, or Universal Links. These are GTM build-list item 1 and a separate job.
- Changes to the changelog, privacy or support pages beyond what shared CSS forces.
- App Store screenshots.
- French.

## Anti-goals (fail even if it works)

- **Promising unbuilt features.** No e-Transfer settle-up, no receipt scanning, no Plus/pricing, no push notifications, no Splitwise import. Decided by the user: e-Transfer stays off the page until it ships.
- **Naming competitors** (Splitwise, Tricount, etc.) on the page.
- **A heavy or janky page.** No multi-MB GIFs, no autoplaying motion for Reduce Motion users, and no third-party requests (the site self-hosts everything today and must keep doing so).
- **Faking the OS.** Don't draw a fake Siri system UI. Show the spoken request as a plain caption, and use Divide's real Siri result card.

## Decisions made with the user

- **Hero A: keep the receipt.** Headline "The shared tab for your home." Lede (roughly): "For couples and roommates. Say an expense to Siri or tap it in, and Divide keeps the running tally, so nobody keeps score in their head." A caption shows the spoken request "Add $84 groceries to Divide". The groceries line prints onto the receipt and the "Drea owes you" balance counts up. It plays once on load, then sits still. With Reduce Motion on, the final state shows immediately.
- Below the button: "iPhone, iPad and iPhone Duo · On the App Store January 2027".
- **The beta CTA is a public TestFlight link** (decided by the user), labelled "Join the beta on TestFlight". It goes in the hero, the sticky header, and the closing section. As of 2026-11-08 the external "Beta" group in App Store Connect has no public link enabled. Until it's enabled, every CTA points to one URL that is defined once and easy to swap, and the page doesn't ship with a dead link. If the link isn't ready at publish time, the button temporarily falls back to the existing `mailto:` link.
- **Section order** (approved):
  0. Header: logo, Changelog / Privacy / Support. A "Join the beta" button appears in the header after scrolling past the hero.
  1. Hero (A, above).
  2. "Made for the home, not the trip": a short text strip covering couples, roommates, recurring bills, and settling up whenever suits you.
  3. Add it before you forget: the fast entry pad, with the sheet staying open for the next expense. Clip.
  4. Rent and bills, set once: recurring expenses. Still or short clip.
  5. See where the month went: the new Insights (category blocks, tap for detail, swipe between categories, spending line vs last month). Clip.
  6. Made for iPhone Duo. Closed: Add sits in the side rail. Open: the register slides in beside the tab. Half-folded: Insights stands up. A code-built fold animation plus clips.
  7. On iPad, too: kept, with a fresh screenshot showing the category blocks.
  8. What Divide leaves out: no ads, no daily limits, no bank linking, no email address, no nagging.
  9. Closing CTA: "On the App Store in January. Try it now in the beta."
  - Footer: unchanged ("Made in Vancouver by Kyle Marks.").
- Siri remains a feature, but it appears in the hero, not as its own section. Section 3 can include the real Siri card as a secondary visual if it fits.

## Constraints and facts

- The site is static HTML/CSS on GitHub Pages at `kyle-marks.github.io/divide-site/`, with no build step and self-hosted fonts. Colors and type follow the app's `ReceiptTheme`. It is light only, matching the app.
- **Media format.** Clips are H.264 MP4 (plus WebM/AV1 if it's meaningfully smaller), muted, `autoplay loop playsinline`, with a poster JPG, lazy-loaded below the fold. They play only while on screen (IntersectionObserver). With `prefers-reduced-motion: reduce`, the poster shows and nothing plays. Target under about 1.5 MB per clip and under about 6 MB of media for the whole page.
- **Recording.** Use `xcrun simctl io <device> recordVideo` from the iPhone Duo, iPhone and iPad simulators (Xcode 27.2, iOS 27.x), with the app launched in DEBUG demo mode (`--divide-ui-fake` + a seed flag). Fold and unfold can't be scripted in the simulator, so record each pose separately. The opening and closing motion is a code-built animation (CSS/SVG) that blends between pose recordings or stills.
- **Siri** can't be meaningfully recorded in the simulator. The hero's Siri moment is code-built. If a real `AddExpenseIntent` result card can be captured (for example by running the intent from Shortcuts in the simulator), use it as a still. Otherwise leave it out.
- **Demo data.** The existing seed `UIFakeSeed.reviewGroup` is a group called "Cabin" with firewood and canoe expenses. That's off-message for the home, and many UI and unit tests depend on it. **Don't change it.** Add a separate DEBUG-only marketing seed instead (for example `--divide-ui-seed-home`). It should be a group like "Home" with Kyle and Drea, recurring rent, Hydro and internet, groceries, dining and so on across 4 months, with CAD amounts and Canadian place names. It goes in the app repo on its own branch, with a unit test like the existing `UIFakeSeedTests`. It must not be reachable without `--divide-ui-fake`, just like the current seed.
- The hero receipt must use numbers that agree with each other (the line items add up to the total, and the balance follows from a 50/50 split). The recordings should use the same household so the receipt and the clips tell one story.
- **Accessibility.** Videos are decorative, with the meaning carried by the text beside them. Give them `aria-hidden` or a short label. The receipt keeps its accessible label. The sticky header CTA must not cover content or trap focus. Meet WCAG AA contrast with the existing palette.
- Phone-width layout must work with no horizontal scroll.

## Left to the builder

- Exact copy for each section beyond the hero headline (keep the current voice: plain, short, warm, no exclamation marks).
- The fold animation technique (CSS 3D transform, SVG, or crossfade), as long as it reads as a Duo opening and closing.
- Whether section 4 is a clip or a still.
- File naming in `shots/` and whether to keep or retire the old screenshots.
- How the sticky header CTA behaves on phones.

## Claude's calls (not decided with the user)

- A new marketing seed rather than editing `reviewGroup`, to protect the tests.
- **The hero receipt is rebuilt from the new seed.** The group is "Home", not "The Apartment", and the receipt shows the current demo month's lines from the seed. The $84 groceries line the hero adds is paid by Kyle, so the balance rises by $42.00, and both numbers are worked out from the seed. The receipt and the clips then agree exactly.
- **Half-folded Duo.** Try posing it in the Duo simulator first: the Insights requirements doc says it can be posed, though the spike notes only list closed, open-landscape and open-portrait. If it can't be posed, section 6 shows closed and open as clips, and half-folded as a code-built still (the open Insights recording tilted along the fold). Don't block on a physical device.
- **The app-repo seed** goes on its own branch, `feat/marketing-seed`, with a PR opened against `main` but not merged. Recordings are made from that branch, so they can be reproduced, and the PR documents the launch flag.
- Media budget and format numbers above.
