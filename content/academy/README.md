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

`01-`, `02-` decide what comes first. They are **not** part of the address a lesson gets:
`01-orders-and-fills.mdx` is reached at `orders-and-fills`.

So:

- **To reorder, rename the numbers.** Nothing breaks: no address changes, and nobody
  loses their progress.
- **To rename a lesson's words, think twice.** That changes its address, and progress is
  remembered against it. Renaming `orders-and-fills` to `order-types` would look, to the
  site, like the old lesson was deleted and a new one added.

Leave gaps if you like (`10-`, `20-`, `30-`) so you can slot one in later without
renaming its neighbours.

## What goes at the top of a file

A few lines between `---` markers, then the lesson itself in Markdown.

A lesson (`.mdx`):

```mdx
---
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

- **`title`** is required. It is what people see.
- **`summary`** is one sentence, shown in lists and in search results.
- **`minutes`** is your honest estimate of how long the lesson takes to read.

## Writing

`.mdx` is Markdown: `#` headings, `**bold**`, lists, links, code blocks. It also allows
components later (a chart, a quiz, a callout) without rewriting anything you have already
written, which is why lessons are `.mdx` and not `.md`.

Two things to keep in mind:

- **Start each lesson's headings at `##`.** The lesson's `title` is the page's one `#`.
- **Nothing here is financial advice**, and the site says so on every page. Keep lessons
  to what things are and how they work, which is what the disclaimer covers.

## Drafts

A file or folder whose name starts with an underscore, other than `_course.md` and
`_module.md`, is ignored. So `_scratch-ideas.mdx` can sit beside your lessons without
being published.
