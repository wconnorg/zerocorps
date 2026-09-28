# Writing Academy lessons

Everything the Academy teaches lives in this folder, as plain Markdown files. Open the
folder in Obsidian as its own vault and write there. **You do not need the site running.**
The site reads this folder; it does not decide what is in it.

## The shape

The Academy has **levels**. A level holds one or more **courses** (Level 2, The Platform,
has one per platform). A course holds **chapters**, and a chapter holds **lessons**.

```
content/academy/
  01-foundations/                       a course (Level 1, Foundations)
    _course.md                          what the course is
    01-how-markets-work/                a chapter
      _module.md                        what the chapter is
      01-what-a-market-is.md            a lesson
      02-orders-and-fills.md            a lesson
  02-backtesting-school/                a course (Level 2, The Platform: Quantower)
  03-sierra-track/                      a course (Level 2, The Platform: Sierra Chart)
  _meta/curriculum-map.md               your checklist of every lesson
  _templates/lesson.md                  the header for a new lesson
```

A chapter's file is called `_module.md`: "module" is the old word for a chapter.

## The numbers at the front are the order, and nothing else

`01-`, `02-` decide what comes first. Leave gaps if you like (`10-`, `20-`, `30-`) so you
can slot one in later without renaming its neighbours.

## Every lesson and chapter has an `id`, and the id never changes

The `id` at the top of a file is how the site knows it: members' progress is saved
against the id, not against the file's name or folder (DECISIONS.md, "Academy content").

So:

- **Rename, reorder or move the file as much as you like.** Nothing breaks, and nobody
  loses their progress.
- **Never change an `id` once members can see it.** To the site, a new id is a new lesson,
  and the old one's progress is left behind.
- **Every lesson id is different**, across the whole Academy: lower-case letters, numbers
  and hyphens, such as `orders-and-fills`. The same goes for chapter ids.

## What goes at the top of a file

A few lines between `---` markers, then the lesson itself.

A lesson:

```md
---
id: orders-and-fills
title: Orders and fills
summary: Market, limit and stop orders, and what happens when one of them fills.
minutes: 6
draft: true
---

## Your first heading

Your writing starts here.
```

- **`id`**, **`title`**, **`summary`** and **`minutes`** are required.
- **`summary`** is one sentence, shown in lists. It must not contain a colon (`:`).
- **`minutes`** is your honest estimate of how long the lesson takes to read.
- **`draft: true`** means "not written yet": the site shows the title as coming soon, and
  nobody can open it. **Delete that line when the lesson is ready.**

A chapter (`_module.md`) has `id`, `title` and `summary`. A course (`_course.md`) also has
`level`, and may have `platform` and `status: coming-soon`, which shows the whole course as
coming soon (Sierra Chart, for now).

## Writing

- **Start each lesson's headings at `##`.** The lesson's `title` is the page's one `#`.
- **Obsidian callouts (`> [!note]`) and ordinary image links (`![what it shows](file.png)`)
  work.** Obsidian's own `[[links]]` and `![[embeds]]` do not: turn off "Use [[Wikilinks]]"
  in Obsidian's settings (Files and links) so it writes ordinary links instead.
- **A lesson marked VERIFY** needs a fact checked (for example, what Quantower's free plan
  includes) before it promises anything.
- **Nothing here is financial advice**, and the site says so on every page. Keep lessons
  to what things are and how they work, which is what the disclaimer covers.

## New lessons from the template

In Obsidian, turn on the core plugin **Templates** and set its template folder to
`_templates`. A new lesson then starts from `_templates/lesson.md`: fill in the `id` (once,
for good), the summary and the minutes.

## This folder is public

The repository is public, so **everything in this folder can be read on GitHub as soon as
it is pushed**, drafts included, before the site shows it and even if the site never does.
Keep private notes, plans and anything about members in a separate vault, never here.
Obsidian's own settings folder (`.obsidian/`) is never committed.

## Left off the site

A file or folder whose name starts with an underscore, other than `_course.md` and
`_module.md`, is not a lesson: `_meta/`, `_templates/`, or a `_scratch-ideas.md` you keep
beside your lessons. It is still public on GitHub, like everything here.
