# Homepage: a new tab for Chrome

A calm new tab page in the style of hoome.dev. It has a pinned essentials row, folders that open in a zoomed view, instant shortcut search, weather, tasks, notes, seven layouts, animated backgrounds and multiple desks. Everything syncs through Chrome's own sync. There's no account, server, ads or tracking.

## Install (developer mode)

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the repository folder.
4. Open a new tab.

To update, pull the latest code and press the reload icon on the extension card.

## Features

**Shortcuts**
- **Essentials:** a pinned row for the sites you use every day.
- **Folders:** each tile previews 4 or 9 icons. Click one to open its full grid in a zoomed view.
- **Icons:** the site's icon, coloured initials, or your own image (a link or an upload). There are three sizes and three styles: rounded, circle and flat.
- **Organising:** drag to reorder, and drop a shortcut on a folder to move it there. Right-click to edit, move (to Essentials, another folder or another desk) or delete. Deleting can be undone.

**Search**
- Typing filters your shortcuts instantly. Enter opens the first match.
- If nothing matches, Enter searches the web with Chrome's default engine or one you pick (Google, Bing, DuckDuckGo, Brave, Ecosia, Startpage, Qwant, or a custom URL).
- Shift+Enter always searches the web, and Ctrl/⌘+Enter opens the result in a new tab.
- Start typing anywhere on the page to search, or press `/`.

**Widgets** (off by default, turned on in Settings › Widgets). On wide windows they sit in columns on the left and right of the grid, centred vertically. On narrow windows they move into a drawer, opened with the ☰ button. Each widget can be put on either side and reordered.
- **Weather:** a five-day forecast for any city from [Open-Meteo](https://open-meteo.com). No API key needed.
- **Today's focus:** one thing to get done today. It resets at midnight.
- **To do** and **Notes**.
- **Countdown:** days (or hours) left until your dates. They also show as dots on the calendar.
- **World clocks:** the time in other cities, with the offset from yours.
- **Timer:** a countdown with presets and a chime, plus a stopwatch. It's shared by all open tabs.
- **Habits:** tick off each day, with streaks.
- **Calendar:** a month view, with the week starting on Monday or Sunday.
- **Sun and moon:** sunrise, sunset, day length and the sun's position, plus the moon phase.
- **Tides:** high and low tides for a coastal city (Open-Meteo Marine).
- **CPU** and **Memory:** live usage of this computer (`chrome.system.cpu` / `chrome.system.memory`).

**Layouts:** Beside grid (the default), Widgets right, Widgets left, Widgets below, Top bar, Dock and Minimal.

**Backgrounds**
- 13 gradients.
- 32 animated, code-drawn scenes. These include Aurora, Nebula, Constellations, Galaxy, Meteor shower, Northern lights, three suminagashi styles (classic, black and gold), Plasma, Code rain, Fireflies, Embers, Sakura, Ripples, Dunes, Topography, Hex pulse and Synthwave.
- A solid colour, or your own image.
- Dim and blur sliders.

**Desks:** separate sets of essentials and folders (for example Work and Personal). Switch with the bar at the bottom or Alt+←/→.

**Settings** are searchable and grouped into General, Interface, Search, Background, Widgets, Desks, Data and Account.

## Data and sync

- Everything is saved in the browser's local storage first.
- **Sync** uses `chrome.storage.sync`, so desks, folders, shortcuts, settings, tasks and notes follow you to every computer signed in to Chrome with the same account. Chrome must have *Extensions* turned on under Settings › You and Google › Sync. Chrome gives each extension about 100 KB of sync space. If tasks and notes push past that, they stay on the computer and everything else keeps syncing.
- **Uploaded images** (custom icons and backgrounds) are too big for Chrome sync, so they stay on the computer they were added on. Image *links* do sync.
- **Snapshots:** the last three versions are kept automatically, hourly while you edit and before imports, resets and deletions. You can restore one from Settings › Data.
- **Export/import:** a JSON file with everything, including uploaded images.
- **Bookmark import:** choose which Chrome bookmark folders to bring in. The bookmarks permission is requested only when you use this.
- **Strict privacy mode** blocks all icon and weather requests. Icons then come only from Chrome's own favicon cache.

## Keyboard

| Key | Action |
| --- | --- |
| `/` or just start typing | Focus search |
| Enter / Shift+Enter | Open first match / search the web |
| Alt+← / Alt+→ | Previous / next desk |
| `,` | Open settings |
| Esc | Close folder, dialog or settings |

## Project layout

Plain HTML, CSS and JavaScript modules with no build step.

```
manifest.json        Manifest V3; overrides the new tab page
newtab.html          Page skeleton
css/style.css        All styles (theme tokens, layouts, components)
js/app.js            Entry point: render loop, clock, desks, keyboard
js/store.js          State, local storage, chunked Chrome sync, snapshots
js/defaults.js       Default settings, starter shortcuts, gradients, layouts
js/ops.js            Shortcut/folder operations
js/tiles.js          Essentials, folders, folder overlay, drag and drop
js/search.js         Search bar and shortcut filtering
js/widgets.js        Widget registry and placement
js/widgets/*.js      The widgets (basic, planning, time, nature, system)
js/backgrounds.js    Gradients, images and animated canvas backgrounds
js/settings.js       Settings panel and settings search
js/dialogs.js        Modals, shortcut editor, context menu
js/bookmarks.js      Chrome bookmark import
```
