# Writing Academy lessons

Everything the Academy teaches lives in this folder, as plain files you can write in any
editor. **You do not need the site running, and you do not need to wait for the Academy
to be built.** Milestone 7 reads this folder; it does not decide what is in it.

## The shape

Three levels, as the brief asks: a **course** holds **modules**, and a module holds
**lessons**.

```
content/academy/
  01-foundations/                       a course
    _course.md                          what the course is
    01-how-markets-work/                a module
      _module.md                        what the module is
      01-orders-and-fills.mdx           a lesson
      02-the-order-book.mdx             a lesson
    02-managing-risk/
      _module.md
      01-position-size.mdx
  02-building-a-system/
    _course.md
    ...
```

## The numbers at the front are the order, and nothing else

`01-`, `02-` decide what comes first. Leave gaps if you like (`10-`, `20-`, `30-`) so you
can slot one in later without renaming its neighbours.

## Every lesson has an `id`, and the id never changes

The `id` at the top of a lesson is how the site knows it: members' progress is saved
against the id, not against the file's name or folder (DECISIONS.md, "Academy content").

So:

- **Rename, reorder or move the file as much as you like.** Nothing breaks, and nobody
  loses their progress.
- **Never change an `id` once members can see the lesson.** To the site, a new id is a new
  lesson, and the old one's progress is left behind.
- **Every id is different**, across the whole Academy: lower-case letters, numbers and
  hyphens, such as `orders-and-fills`.

## What goes at the top of a file

A few lines between `---` markers, then the lesson itself in Markdown.

A lesson (`.mdx`):

```mdx
---
id: orders-and-fills
title: Orders and fills
summary: The two ways to ask for a trade, and what each one costs you.
minutes: 6
---

Your writing starts here.
```

A course (`_course.md`) or a module (`_module.md`):

```md
---
title: Foundations
summary: Where to start if you have never placed a trade.
---

An optional longer description, shown on the course's page.
```

- **`id`** is required on a lesson, and is described above.
- **`title`** is required. It is what people see.
- **`summary`** is one sentence, shown in lists and in search results.
- **`minutes`** is your honest estimate of how long the lesson takes to read.

## Writing

`.mdx` is Markdown: `#` headings, `**bold**`, lists, links, code blocks. It also allows
components later (a chart, a quiz, a callout) without rewriting anything you have already
written, which is why lessons are `.mdx` and not `.md`.

Things to keep in mind:

- **Start each lesson's headings at `##`.** The lesson's `title` is the page's one `#`.
- **Obsidian callouts (`> [!note]`) and ordinary image links (`![what it shows](file.png)`)
  work.** Obsidian's own `[[links]]` and `![[embeds]]` do not: turn off "Use [[Wikilinks]]"
  in Obsidian's settings (Files and links) so it writes ordinary links instead.
- **In an `.mdx` file, a bare `<` or `{` in a sentence breaks the page.** Write "price is
  below VWAP", or put it in backticks: `price < VWAP`.
- **Nothing here is financial advice**, and the site says so on every page. Keep lessons
  to what things are and how they work, which is what the disclaimer covers.

## This folder is public

The repository is public, so **everything in this folder can be read on GitHub as soon as
it is pushed**, before the site shows it and even if the site never does. Keep private
notes, plans and anything about members in a separate vault, never here.

## Drafts

A file or folder whose name starts with an underscore, other than `_course.md` and
`_module.md`, is left off the site. So `_scratch-ideas.mdx` can sit beside your lessons
without appearing in the Academy. It is still public on GitHub, like everything here.
