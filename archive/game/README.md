# Archived shape game

The interactive puzzle has been retired from the public academic pages. This directory preserves the previous source; it does not provide a playable page. The academic site no longer loads the game scripts or makes leaderboard requests.

## Preserved files

- `teaching-index.html.txt`: exact former `teaching/index.html`, including the game markup, inline styles and dependency script tags. The `.txt` extension deliberately prevents this file from rendering as a webpage.
- `site.js`: exact former `assets/site.js`, including the game controller and research filters.
- `style.css`: exact former `assets/style.css`, preserving the original appearance before the site-wide theme switch.
- `original-README.txt`: exact former site documentation, including the rules, scoring and leaderboard design.

The shared dependencies remain at their original paths in `assets/`: `packing-pieces.js`, `packing-rules.js`, `packing-worker.js`, `packing-solver.js`, `leaderboard.js`, `player-names.js` and `player-names-LICENSE.txt`. They are dormant on the current website.

## Restore for a local preview

1. Make a separate local copy of this repository so the current website files stay intact.
2. In that copy, copy `archive/game/teaching-index.html.txt` to `teaching/index.html`.
3. Copy `archive/game/site.js` to `assets/site.js`, and `archive/game/style.css` to `assets/style.css`. Keep the existing files in `assets/` listed above.
4. From the copied repository root, run `python3 -m http.server 8765 --bind 127.0.0.1` and visit `http://127.0.0.1:8765/teaching/`. The restored page includes the original leaderboard endpoint. For an offline-only preview, remove its `data-leaderboard-api` attribute before opening it.

These steps restore the former page locally. Publishing the restored files would make the game visible again. The archived full-page copy predates the current theme switch; integrating the game into a future page should retain that page's current header and theme script.

## Backend

The separate Cloudflare Worker, D1 database and saved scores have not been modified or removed. Backend source and deployment records are maintained separately from this public academic-site repository. No signing key is included here.
