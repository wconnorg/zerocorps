---
id: tpo-profile
title: TPO profile
summary: The TPO (Market Profile) chart - letters, periods, and what the shape of a day describes.
minutes: 6
---

## What a TPO is

**TPO** stands for time price opportunity. A TPO chart, often called Market Profile, measures **time at price** rather than volume at price.

It is built like this:

1. Split the session into equal periods, traditionally 30 minutes each.
2. Give each period a letter: A for the first, B for the second, and so on.
3. For every price that traded during a period, place that period's letter at that price.
4. Push all the letters sideways, so they stack into rows.

If price traded between 5,000 and 5,010 during period A, every price row from 5,000 to 5,010 gets an A. The finished chart is a sideways histogram of how many periods traded at each price. On a busy contract like ES, each row usually covers a group of ticks to keep the chart readable.

A TPO profile has its own point of control (the row with the most letters) and its own value area. It often looks like the volume profile for the same day, but not always: a price can see heavy volume in a short burst, or light volume over a long, slow stretch.

## Initial balance

The **initial balance (IB)** is the range of the first hour of the regular session, traditionally periods A and B. It describes the range the early participants set.

The rest of the day is described against it. When price later moves beyond the IB high or low, that is called **range extension**. A day that never leaves its initial balance was dominated by the early range. A day that extends far beyond it had someone new join the auction later.

## Single prints

A **single print** is a row with only one letter. Price traded there in just one period and never returned during the session.

- Single prints **inside** the profile describe a fast, one-directional move, typical of imbalance.
- Single prints at the **extreme** high or low form a **tail**. A tail of two or more single prints is commonly treated as excess: the clean end of an auction you met in the last chapter.

## Poor highs and poor lows

A **poor high** is a high where several periods reached the same price and none went beyond it, leaving a flat top with no tail. A **poor low** is the same at the bottom.

It describes an auction that stopped without the clear rejection that excess shows. Many traders make a note of poor highs and lows because the auction did not show a clear end there.

## Day shapes as descriptions

Once a session is over, the shape of its profile describes what kind of auction it was.

| Shape | What it looks like | What it describes |
| --- | --- | --- |
| Normal | Wide initial balance, bell shape, little range extension | Balance, with the early range holding all day |
| Trend | Narrow initial balance, long thin profile, single prints | Imbalance, with one side in control all day |
| Double distribution | Two bulges joined by single prints | Balance, a fast move, then a new balance |

These shapes are labels for what happened, not forecasts. In the middle of a session you only see a partial shape, and it can still change completely.

> [!check] What does a row with a single TPO letter inside a profile tell you?
> - [x] Price traded at that level in only one period and moved through quickly
> - [ ] Exactly one contract traded at that price
> - [ ] That price is the day's point of control
> A TPO counts periods of time at a price, not contracts, so one letter means one period.
