JOHANNES BRÜSTLE — ACADEMIC WEBSITE

A responsive static website with a restrained science-fiction influence:
midnight blue, geometric typography, subtle grid lines, and cool-blue accents.
The academic pages use static files on GitHub Pages. A header switch offers
dark and light appearances and remembers each visitor's choice locally.
The former puzzle is no longer displayed or loaded on any academic page;
its source remains in the repository for future use.

PAGES
index.html                 About and recent research
research/index.html        All publications, preprints, and manuscripts
teaching/index.html        Teaching experience
cv/index.html              Academic background
assets/johannes-brustle-cv.pdf  Downloadable public CV
assets/style.css           Appearance and responsive layout
assets/site.js             Paper filters and search
assets/theme.js            Site-wide dark/light switch with saved preference
archive/game/              Non-rendered original game page and source archive
assets/packing-pieces.js   Shared piece geometry
assets/packing-rules.js    Seeded rerolls and observed-piece identities
assets/packing-worker.js   Seeded puzzle generation and offline solving
assets/packing-solver.js   Packing and optimal-layout verification
assets/leaderboard.js      Shared leaderboard and optional score submission
assets/player-names.js     Nickname validation shared with the score service
assets/player-names-LICENSE.txt  Dictionary sources and attribution

PUBLISH ON GITHUB PAGES
1. Create a public repository named jbrustle01.github.io, under the jbrustle01 account.
2. Upload the contents of this folder into the repository's top level.
   The index.html file and assets folder must be at the top level, not nested
   inside a johannes-brustle-website folder. Keep .nojekyll if uploading with Git.
3. Open the repository's Settings > Pages. Under Build and deployment,
   choose Deploy from a branch, then main and / (root), and Save.
4. GitHub will show the published address, normally
   https://jbrustle01.github.io/. Initial publication may take several minutes.

Official instructions: https://docs.github.com/en/pages/quickstart

SEARCH DISCOVERY
The canonical academic homepage is https://jbrustle01.github.io/.
Its static HTML includes linked WebSite, ProfilePage and Person structured
data identifying Johannes Brüstle (also published as Johannes Brustle),
Sapienza affiliation and the supplied Google Scholar profile. Keep these
facts consistent with the visible biography when updating the site.
robots.txt permits crawling and references the four-page sitemap.xml.
Update sitemap lastmod only when that specific page has actually changed.
The google-site-verification meta tag belongs to the owner's Google Search
Console property. It is a public verification tag, not a password; keep it
in the homepage head so Google can continue checking ownership.
Search indexing and ranking are decided by Google and are not guaranteed.

UPDATING THE SITE
Edit the relevant HTML file. Publication entries are ordinary HTML article
elements in research/index.html. Selected papers also appear on index.html.
The content is present without JavaScript, so search engines can read it.
The optional JavaScript adds paper search and category filters. The header
theme switch toggles dark and light appearances across all academic pages;
assets/theme.js remembers the visitor's preference on this device.

RETIRED GAME SOURCE
The game and leaderboard interface have been removed from the Teaching page.
No academic page loads the game code or calls the leaderboard service.
archive/game/ preserves the exact former Teaching page as a .html.txt file,
together with its original site.js, style.css and documentation. The .txt
extension keeps the archived page from acting as a playable website page.
Shared packing and leaderboard dependency files remain in assets/ but are
dormant. See archive/game/README.md for local restoration instructions.
The separate Cloudflare Worker, D1 database and existing scores are unchanged;
removing the interface does not delete or redeploy that backend.

Replace assets/johannes-brustle-cv.pdf to update the downloadable CV.

ADDING A PHOTO LATER
Place the photo at assets/portrait.jpg. In index.html, an HTML comment near
the research-interest sidebar shows where to insert the image. The portrait
style is already defined. No empty photo placeholder is shown to visitors.

TYPOGRAPHY
The site loads Space Grotesk, IBM Plex Sans, and IBM Plex Mono from Google Fonts.
System fonts are used if the font service is unavailable.

LOCAL PREVIEW
Open a terminal in this folder and run:
python3 -m http.server 8765 --bind 127.0.0.1
Then visit http://127.0.0.1:8765/ in a browser.
Press Control-C in that terminal to stop the preview.
