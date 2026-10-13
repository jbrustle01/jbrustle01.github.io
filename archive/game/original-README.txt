JOHANNES BRÜSTLE — ACADEMIC WEBSITE

A responsive static website with a restrained science-fiction influence:
midnight blue, geometric typography, subtle grid lines, and cool-blue accents.
The academic pages use static files on GitHub Pages. The optional shared
puzzle leaderboards use a separate Cloudflare Worker with a D1 database.

PAGES
index.html                 About and recent research
research/index.html        All publications, preprints, and manuscripts
teaching/index.html        Teaching experience
cv/index.html              Academic background
assets/johannes-brustle-cv.pdf  Downloadable public CV
assets/style.css           Appearance and responsive layout
assets/site.js             Paper filters, search, and single-player shape game
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
The optional JavaScript adds paper search, category filters, and an interactive
single-player shape-placement game at the bottom of the Teaching page.
Choose a 5-by-5, 7-by-7, 9-by-9, or 11-by-11 board before starting;
7-by-7 and Medium difficulty are the defaults. Choose Easy, Medium, Hard,
or Very hard for respectively 3, 2, 1, or 0 rerolls.
Every piece covers four squares. All connected four-square shapes are
possible, including their distinct rotations and reflections.
Place the current piece without rotating it. The next three pieces are visible
alongside the current piece. Keep up to two pieces on hold. Click a hold slot,
or press H for slot 1 or J for slot 2, to store the current piece and draw the
next, or swap it with the piece in that slot. One hold or swap is available
per placement across both slots; placing a piece unlocks both slots again.
Click Reroll pieces or press R to replace the current piece and next three.
Held pieces stay unchanged. Rerolling does not unlock a hold already used
since the last placement. Each reroll draws four fresh pieces from the
sequence fixed by the starting seed.
Each placed piece immediately shows its reveal-order number, so pieces
can be matched to the optimal layout even when holding changes their order.
Every rerolled replacement is a new numbered draw.
The game ends only when the current piece cannot fit and no permitted hold
or remaining reroll can help. Shortcuts work while interacting with the game
and do not intercept typing in the nickname field.
Hover any square that a legal placement could cover; clicking places the
exact preview. Focus and Enter provide the same choices with the keyboard.
A fresh seed fixes random blocked squares, with no symmetry requirement,
and the full sequence of pieces and orientations. Blocked-square ranges
scale with the board: 0–1 on 5-by-5, 1–3 on 7-by-7, 2–4 on 9-by-9,
and 3–6 on 11-by-11.
Boards mix scattered blockers with small clusters and exclude stranded
regions smaller than a piece. Each puzzle is generated with a packing that
reaches the free-area bound, then its pieces are shuffled into arrival order.
Generation favors varied families and limits long runs of the same family.
New game returns to the size and difficulty picker; Start game generates
a fresh seed. Reset restores the original board and sequence, both empty
hold slots, the original four visible draws, and the full reroll allowance.
At the end, compare your layout with the Optimal offline solution: the
largest possible packing chosen from all distinct draws actually revealed
during play. This includes placed, held and previewed pieces, and pieces
discarded by rerolls. Unseen future pieces are excluded. The offline solver
may choose any subset and order from this pool; orientations stay fixed.
The score is 100 times your covered squares divided by its covered squares.
Only the actually revealed prefix is used as this new benchmark. The seeded
generator provides a valid packing for this prefix that attains the inventory
or free-area bound, proving optimality. Discarding and replacing four draws
never removes them from the offline pool. Verification runs separately from
the page in assets/packing-worker.js and packing-solver.js. While calculating,
results are marked pending; no approximation is labelled optimal or submitted
as an exact score.

LEADERBOARDS
A shared top ten is kept separately for every board-size/difficulty pair:
5-by-5, 7-by-7, 9-by-9 and 11-by-11, each with four difficulty categories.
Scores are ranked by exact covered/optimal percentage, with newer submissions
first in a tie. Adding a qualifying score is optional: visitors can enter a
name or everyday noun, optionally followed by up to five digits, or leave the
field blank to remain Anonymous. Nicknames are limited to 24 characters and
checked for vulgar language both in the browser and on the server. Invalid
names can be corrected without losing the game's submission opportunity.
The vocabulary includes international given names and surnames, recognized
full names, and English nouns. It is a broad list, not a complete registry of
every real name. Dictionary attribution is in assets/player-names-LICENSE.txt.
The service regenerates the signed starting seed and replays all legal moves,
holds and rerolls before accepting a score. Tickets bind size, difficulty
and rules version. It independently reconstructs the observed pool and checks
the submitted placement certificate. If a valid certificate reaches the area
or inventory bound it proves optimality; otherwise the service performs a
bounded exact search. An unproved result cannot be submitted as optimal.
Submitted percentages are never trusted. This
checks a legal replay; it does not claim to distinguish humans from bots.
The database keeps at most 160 scores and no discarded score history. Anonymous
one-use submission receipts (no name or score) expire after 24 hours. One
score may be added per starting ticket; Reset preserves an already-added score.
The static game remains playable if the score service is unavailable, with
an explicit message that the local game cannot submit a leaderboard score.
The API origin is configured in teaching/index.html as data-leaderboard-api.
Backend source and deployment records are maintained separately from the
public academic-site repository. No signing key is shipped to visitors.
Existing scores and cached older clients map to Very hard, retaining their
original historical benchmark. Their scores are not retrospectively recalculated.

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
