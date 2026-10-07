<h1><img src="public/favicon.svg" alt="" width="40" align="top"> tsundoku-WebUI</h1>

The web interface of [tsundoku](https://github.com/jt-ito/tsundoku), a self-hosted manga reader server.

**This is a fork of [Suwayomi-WebUI](https://github.com/Suwayomi/Suwayomi-WebUI)** and works with tsundoku (a fork of [Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server)). It keeps everything the Suwayomi WebUI does and adds a redesigned look, account support and a few library features. It is maintained independently and is not affiliated with the Suwayomi project.

## What is different from Suwayomi-WebUI

### Look and feel

Every visual change is listed, with how to revert it on its own, in [UI-MODERNIZATION.md](UI-MODERNIZATION.md). The styling lives in the component code and in `src/features/theme/services/ForkComponentOverrides.ts`, and follows whichever theme you pick.

- Layered shadows and depth on cards, dialogs and floating buttons; frosted glass only where something floats over content.
- Frosted status badges (Ongoing, Finished, ...), unread and download counts, with a small glowing dot; the cover buttons match.
- A floating "liquid glass" navigation pill and a frosted reader bar on phones.
- A sidebar profile card, a softer header with an accent glow, and compact settings sections with tactile controls.
- Press states, easing and reduced-motion support throughout.
- A redesigned **login page**: same split layout, with a themed form panel, an outlined form that submits on Enter, a loading state, password-manager support and the server address shown as a monospace chip.
- The new **ツン** logo and favicons.

### Accounts

- Account switcher and an accounts dialog for admins.
- Library, categories, reading progress and trackers are per account.
- The Authentication Mode setting lists **UI Login (Recommended)** first and marks Basic Authentication and Simple Login as **Legacy**. The first admin is created on the server's first-run page, not here.
- Sessions are refreshed quietly before they expire, so a phone stays logged in.

### Library and reading

- **A-Z index:** a strip of letters at the edge of the library; tap or drag a letter to jump to the first series starting with it.
- Live search while typing, rounded suggestions, and a scroll-to-top/bottom button.
- A release-status badge on library cards and a chapter-count badge in source browsing.
- A quicker extension list (virtualized, with image requests queued).
- "Finished" instead of "Completed" for a manga's status, translated separately from the tracker's "Finished".

### Server features in the interface

- The WebView popup shows the server's video-streamed browser, recoloured to your theme and shaped like a phone screen on phones.
- Settings > Server > Database links to the server's **database migration page** (built-in PostgreSQL, guided migration with backup).
- Backup and restore have an "Extensions and repositories" option and a clearer "Before restoring" popup. After a restore the app **stays logged in and applies the restored theme** without a reload.

## Everything from upstream

- Library management: filter, sort and search, categories, multi-select actions, shift-click or long-press ranges, duplicate overview.
- Manga pages with filtered and sorted chapter lists and bulk actions.
- Reader: single and double page, continuous vertical and horizontal, webtoon; scale modes; image filters; custom keybinds; auto-scroll; infinite chapter scrolling; per-manga and per-mode settings.
- Download queue, reading history, source browsing, saved searches, migration of manga between sources, duplicate checks.
- Settings per device, update notices for the server and the interface.
- Predefined and custom themes, and dynamic themes from manga covers.

## Running it

tsundoku serves this interface itself. To host your own build, set `server.webUIFlavor = "CUSTOM"` (or `WEB_UI_FLAVOR=Custom`) on the server and put the build into the `webUI` folder of the server's data folder. Keep the `revision` file that is already in that folder; without it the server cannot read the version and the app stays on the splash screen. Restart the server afterwards.

```bash
pnpm install
pnpm dev      # dev server on :3000, talks to the server on :4567 (the theme needs a full reload to rebuild)
pnpm build    # production build in build/
```

The dev build is noticeably slower than the production one, so judge scrolling and feel on the server's own port. See [BUILDING.md](BUILDING.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Commits run `oxfmt`, `oxlint`, the i18n extract and the type check.

## Translation

Strings are extracted with Lingui into `src/i18n/locales`. New strings are added to English and fall back to English in other languages until translated. The original translations are on [Weblate](https://hosted.weblate.org/projects/suwayomi/suwayomi-webui/).

## Credit and license

Built on the work of the [Suwayomi-WebUI](https://github.com/Suwayomi/Suwayomi-WebUI) contributors.

    Copyright (C) Contributors to the Suwayomi project

    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
