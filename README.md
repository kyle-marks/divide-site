# divide-site

Public landing, privacy policy, and support pages for the Divide iOS app, served by GitHub Pages at https://kyle-marks.github.io/divide-site/.

The privacy policy's source of truth is `docs/legal/privacy-policy.md` in the app repo. Change it there first, then mirror it in `privacy/index.html`.

Fonts are self-hosted so the site makes no third-party requests: Instrument Serif and Bricolage Grotesque, both under the SIL Open Font License (see `fonts/OFL-*.txt`). Screenshots in `shots/` come from the app's DEBUG UI-fake mode.

The changelog page (`changelog/index.html`) is generated from `changelog/releases.json` by `scripts/build_changelog.py`. The Divide app repo's `scripts/release_notes.py` adds an entry on every release; don't edit the HTML by hand.
