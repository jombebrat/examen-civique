---
name: Coq Civique
description: Free app and site to learn the official questions of the French examen civique, calm and readable at A2.
colors:
  tricolour-blue: "#1F4E9C"
  blue-deep: "#183F80"
  blue-mist: "#E6EDF9"
  flag-red: "#C8102E"
  ink: "#14203C"
  slate: "#4F5A74"
  paper: "#FFFFFF"
  mist: "#F1F4F9"
  hairline: "#DDE2EC"
  pass-green: "#17744A"
  pass-wash: "#E3F3EA"
  theme-values: "#1F4E9C"
  theme-institutions: "#2B6B5E"
  theme-rights: "#A8432F"
  theme-history: "#86621A"
  theme-society: "#5B3F8E"
  footer-navy: "#14203A"
  footer-ink: "#B9C4D8"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "clamp(36px, 6.2vw, 60px)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "clamp(30px, 4.4vw, 44px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  tag: "6px"
  control: "12px"
  box: "14px"
  card: "16px"
  quiz: "18px"
spacing:
  gutter: "18px"
  band: "clamp(56px, 8vw, 104px)"
  section-head: "28px"
components:
  button-primary:
    backgroundColor: "{colors.tricolour-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.blue-deep}"
    textColor: "{colors.paper}"
  button-primary-big:
    backgroundColor: "{colors.tricolour-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.box}"
    padding: "12px 22px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "46px"
  button-disabled:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.slate}"
    rounded: "{rounded.control}"
  quiz-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.quiz}"
    padding: "22px"
  quiz-option:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "46px"
  quiz-option-correct:
    backgroundColor: "{colors.pass-wash}"
    textColor: "{colors.ink}"
  list-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px 22px 20px"
  answer-box:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "18px 20px"
  note:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 18px"
---

# Design System: Coq Civique

## Overview

**Creative North Star: "La réponse claire"**

Every page exists to hand a candidate one clear answer, calmly. The system is the category standard played straight, at the finish of Babbel and Alan: a white page, soft blue-grey bands, navy ink and one blue for actions. Nothing competes with the question being learned; the live quiz, a real official question with instant correction, is the one object that is allowed to stand out.

The audience reads French at A2–B1, mostly on a phone. That decides density: one idea per band, generous type, short lines, labels in plain sentence case. The tricolour is identity, not decoration; it lives in the 4px flag bar and in red for mistakes. The site is independent and must never look like a government service, a game, or an expensive private school.

**Key Characteristics:**
- White ground, alternating with a quiet blue-grey band; no textures, no gradients.
- One display family (Atkinson Hyperlegible Next ExtraBold) over the hyperlegible body face.
- Hairline lists instead of stacks of cards; cards only for things you click.
- One filled button per view; every other action is an underlined text link.
- A single authored motion: the correct quiz answer settling in green.

## Colors

A restrained palette: neutrals tinted toward navy, one blue that acts, a red that only marks, and five theme colours that code the official themes.

### Primary
- **Tricolour Blue** (`tricolour-blue`): primary buttons, links, focus rings, the active state of controls. The only colour that invites a tap.
- **Deep Ink Blue** (`blue-deep`): hover and pressed state of the primary button and links.
- **Blue Mist** (`blue-mist`): the closing band behind the last call to action, the refrain of the Marseillaise, the English help pill.

### Secondary
- **Flag Red** (`flag-red`): the right third of the flag bar, wrong answers, error messages, the carte de résident list number. Never a heading, never a label.

### Tertiary
- **Pass Green** (`pass-green`) and **Pass Wash** (`pass-wash`): the correct answer, the "Bonne réponse" mark, the check icons of the trust line.
- **Theme colours** (`theme-values`, `theme-institutions`, `theme-rights`, `theme-history`, `theme-society`): the number of each official theme, the meta line of a question page, the chips in the app. They code; they never fill large areas.

### Neutral
- **Night Ink** (`ink`): all headings and body text.
- **Quiet Slate** (`slate`): ledes, meta lines, captions, counters.
- **Paper White** (`paper`): the page ground and every card surface.
- **Morning Mist** (`mist`): alternating bands, notes, the "essentiel" box, disabled buttons.
- **Hairline Grey** (`hairline`): every rule, border and list separator.
- **Footer Navy** (`footer-navy`) with **Footer Ink** (`footer-ink`): the footer only.

### Named Rules
**The Flag-Only Rule.** Blue, white and red appear together only in the flag bar. Red alone means "wrong" or "attention"; it never decorates.

**The One Blue Rule.** Only one colour is clickable. If something is Tricolour Blue, a visitor must be able to tap it.

## Typography

**Display Font:** Atkinson Hyperlegible Next, ExtraBold (with Atkinson Hyperlegible and system-ui as fallbacks)
**Body Font:** Atkinson Hyperlegible (with system-ui)

**Character:** one hyperlegible family from headline to footnote. Tight, heavy headlines give confidence; the body face keeps every letter distinct for readers still learning French.

### Hierarchy
- **Display** (800, clamp 36–60px, 1.04, −0.025em): the home headline and page titles.
- **Headline** (800, clamp 30–44px, 1.1, −0.02em): section titles.
- **Title** (800, 19–22px, 1.2): item titles in lists, guides, cards and the quiz head.
- **Body** (400, 17px on desktop, 16.5px on phones, 1.55): running text, answers, quiz options; prose measure at most 54ch.
- **Label** (700, 14–15px, sentence case, no tracking): meta lines, card labels, counters, table heads.

### Named Rules
**The Plain Label Rule.** Labels are sentence case in the body face. No capitals with letter-spacing, anywhere, in the site or the app.

**The Title-First Rule.** A meta line (theme, list, date) sits under the title it describes, never above it as a kicker.

## Layout

Two containers: a 760px reading column for questions, guides and fiches, and a 1120px wide container for the home page. Gutters are max(18px, safe area) on phones. Home sections are full-width bands that alternate Paper White and Morning Mist, padded clamp(56px, 8vw, 104px); a section opens with its headline and one short lede, then its content.

The home hero is a two-column grid on desktop (text, then the 380px quiz card, 420px from 1100px) and a single column on phones, where the quiz starts inside the first screen. Exam facts sit in a hairline row of four, two by two on phones. Lists (themes, guides, FAQ) are hairline rows; guides flow in columns of at least 300px. The footer collapses to wrapped link groups on phones. Breakpoints in use: 350, 560, 640, 860 and 1100px.

## Elevation & Depth

Mostly flat. Depth comes from the white surface over the blue-grey band and from hairlines. A soft lift (two-layer, low-opacity navy shadow) marks only the quiz card, the answer box of a question page, and a list card on hover; list cards rest with a 1px whisper of shadow. PDF covers carry a paper shadow so they read as print. There are no hard offset shadows and no coloured glows.

### Named Rules
**The Lift-Means-Live Rule.** Only an element you can interact with right now may lift: the quiz, the answer you are reading, the card under your cursor.

## Shapes

Gently rounded throughout: 6px for tags, 12px for buttons, inputs and quiz options, 14px for boxes and big buttons, 16px for cards, 18px for the quiz card. Borders are 1px Hairline Grey on surfaces and 1.5px on controls. No side stripes, no top bars on cards; colour coding lives in numbers and labels.

## Components

### Buttons
- **Shape:** gently rounded (12px; 14px on the big variant).
- **Primary:** Tricolour Blue fill, white text, 46px tall (52px big). One per view.
- **Hover / Focus / Active:** fill deepens to Deep Ink Blue; focus shows a 2.5px blue ring offset by 2px, instantly; pressing moves the button 1px down.
- **Secondary:** white fill, ink text, 1.5px hairline border that turns blue on hover. Used for the header PDF link and list footers.
- **Disabled:** Morning Mist fill, slate text, not-allowed cursor; never opacity alone.

### Text links
Bold, Tricolour Blue, underlined (1.5px, offset 4px), no arrows or chevrons. Every secondary action is a text link.

### Cards / Containers
- **Corner Style:** 16px (lists, PDFs), 14px (answer box), 18px (quiz).
- **Background:** Paper White on any ground.
- **Shadow Strategy:** see Elevation; at rest only the quiz and the answer box lift.
- **Border:** 1px Hairline Grey.
- **Internal Padding:** 18–24px.

### Inputs / Fields
- **Style:** 1.5px hairline border, 12px radius, 46px minimum height, ink text.
- **Focus:** 2.5px blue outline, border turns blue.
- **Error:** red bold message under the field, naming the problem and the fix.

### Navigation
Flag bar, then a white header with a bottom hairline: wordmark on the left; Questions and Guides as bold ink links, PDF as a secondary button and Apprendre as the primary button on the right. On phones: wordmark, Apprendre and a menu button that opens a panel with Questions officielles, Livrets PDF gratuits, Examen blanc, Plan en 7 jours and Guides pratiques; Escape closes it. Under 350px the wordmark text hides behind the logo.

### Quiz card (signature)
A real official question, its four options as full-width bordered rows, and a counter under the title. Choosing an option settles the correct one into Pass Wash with a green border (320ms, exponential ease-out) and raises the feedback 6px into place; a wrong choice gets a red border. The result screen shows the score and one primary button. No mascot video, no confetti, no sound.

### Hairline list
Rows separated by 1px rules with a title in the display face and one muted line under it. Used for the five themes, the guides and the FAQ (with a drawn plus/minus at the end of each question).

## Do's and Don'ts

### Do:
- **Do** keep one filled button per view and make every other action an underlined text link.
- **Do** put meta (theme, list, date) under the title in a 15px bold slate or theme-coloured line.
- **Do** separate lists with 1px Hairline Grey rules and keep cards for clickable things.
- **Do** keep prose at 54ch or less and body text at 17px with 1.55 line height.
- **Do** use drawn SVG icons (check, close, menu, download) at 14–22px with aria-hidden.

### Don't:
- **Don't** put a small label above a heading, and don't set any label in spaced capitals.
- **Don't** use coloured side stripes or top bars on cards, notes or verses.
- **Don't** use hard offset "3D" shadows, bounce animations or other game devices; the product must never feel like a game.
- **Don't** use text characters (✓, ×, +, ▶) as icons.
- **Don't** use a serif or decorative display face, cursive, notebook ruling or other school props.
- **Don't** borrow anything that makes the site look official: no Marianne block, no government page patterns.
- **Don't** show invented numbers, ratings or testimonials; only official facts and real counters.
