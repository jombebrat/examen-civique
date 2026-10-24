---
version: 1
slug: "scripts-build-mjs"
primary_target: "scripts/build.mjs"
related_targets: ["src/site/site.css","src/app/app.html"]
---

# Surface: home page and shared site chrome

Scope: the home page (`/`) and the shared layout, components and tokens every site page inherits (question pages, guides, fiches, PDFs page); the learning app keeps its own screens but shares the type and colour tokens.
Visitor mode: Persuade (home), Read (question pages and guides).
Audience and job: a candidate on a phone, French A2–B1, who must believe within seconds that it is free and they can start now; action: "Commencer à apprendre"; proof: the live 5-question quiz with official questions.
Constraints: keep all text and URLs (SEO), tricolour, name and logo, Atkinson Hyperlegible body; never look official, game-like, corporate-expensive or hard to read.

## Direction contract

THESIS: The category standard played straight at the craft of Babbel and Alan: a calm white page where a real official question proves the offer. It refuses the template tells (eyebrow labels, tracked caps, icon tiles, stacks of shadowed cards, side stripes).

OWN-WORLD: White ground with soft blue-grey bands, navy ink, one blue action colour; the tricolour lives in the flag bar and in red for mistakes. Hairline rules and plain lists instead of card stacks; cards only for things you click. Display Atkinson Hyperlegible Next ExtraBold, tight; body Atkinson Hyperlegible. Controls 12px radius; the quiz card 18px with one soft shadow.

STORY: The visitor reads the headline, answers a real question, sees the correction, and presses "Commencer à apprendre", knowing it is free and needs no account.

FIRST VIEWPORT: Desktop: headline (about 58px) on the left, one-sentence lede, primary button with two text links, three checks; quiz card on the right (420px); a hairline row of four exam facts below. Phone: headline about 38px, lede, full-width button, links, checks, and the quiz starting inside the first screen.

FORM: category standard (the user's choice of the standing exit, after directions A, A2 and B); seed: seed:f43297cc1a752f6e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
