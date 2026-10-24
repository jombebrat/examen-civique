# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: candidates for the French examen civique (carte de séjour pluriannuelle, carte de résident, naturalisation). Foreign residents in France whose French is around A2–B1, studying alone, mostly on a phone, in short sessions. Many arrive from Google on the page of one specific official question.

Secondary (reached through outreach, not the design target): associations and trainers who prepare candidates.

## Product Purpose

Coq Civique teaches the official question lists of the examen civique, with a clear answer and explanation for every question, short lessons, a quiz after each lesson, exam simulations and printable PDFs. Success is a candidate passing the exam (32/40 or better).

## Positioning

Free, without an account and without ads. Every official question has a written answer, an explanation and a source. Built by Jovan, a candidate himself, for himself and his family, then opened to everyone. Independent and openly not official.

## Operating Context

- The exam: 40 questions in 45 minutes (28 knowledge questions from the official list of the candidate's procedure, 12 situations), pass mark 32/40, taken in an approved centre.
- Three official lists: naturalisation (259 questions), carte de résident (209), carte de séjour pluriannuelle (191); many questions are shared.
- Five official themes: principles and values, institutions, rights and duties, history-geography-culture, living in French society.
- Use: phone first, short daily sessions, installable as an app (PWA), PDFs printed for paper revision.

## Capabilities and Constraints

- Lessons of about 8 questions, quiz after each lesson, spaced repetition of mistakes, 40-question exam simulation, 119 practice situations, PDF booklets and 40-question PDF papers, guides, revision sheets (fiches), pages in English and Arabic.
- Email is optional (sync progress, receive the PDF); no password. Anonymous usage counters only; no Google Analytics.
- Static site built with Node (scripts/build.mjs), deployed on GitHub Pages; Supabase for email sync and counters.

## Brand Commitments

- Name: Coq Civique. Logo: the app icon (rooster face).
- Blue, white and red stay the base of the palette; exact shades may be adjusted.
- Body typeface: Atkinson Hyperlegible.
- The animated rooster mascot is optional, not binding.
- Must never look like a government website or imply it is official; the independence statement stays.
- Must never feel like a game, like an expensive private school, or be hard to read for someone with A2–B1 French.
- The first message a visitor must believe within seconds: it is free and they can start right now.
- Standing visual preference (chosen 24 October 2026): the category standard, clean and calm, at the craft level of Babbel and Alan; no school-notebook or transit-map metaphors.

## Evidence on Hand

- The official lists and their counts; the answers and sources written for each question.
- Jovan's own story (about page and home page).
- Real anonymous counters (page views, lessons finished, quiz answers, PDF downloads).
- No testimonials yet (the block stays hidden until real, verified ones exist). No user counts, pass rates or ratings may be invented.

## Product Principles

1. Free and immediate: nothing stands between the visitor and the first question.
2. Truth before persuasion: official questions, sourced answers, no invented claims.
3. Readable at A2: short sentences, plain words, generous type.
4. Independent, never official-looking.
5. Respect the learner: serious without being cold, encouraging without being childish.

## Accessibility & Inclusion

Readers with A2–B1 French; low-vision friendly body face; phone screens down to 320 px; keyboard and screen-reader use; reduced motion respected; Arabic pages read right to left.
