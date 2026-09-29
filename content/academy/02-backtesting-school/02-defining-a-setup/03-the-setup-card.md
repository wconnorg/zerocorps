---
id: the-setup-card
title: The setup card
summary: One page that fully describes a setup, so every backtested trade matches it.
minutes: 5
---

## One page, one setup

A **setup card** is a single page that fully describes one setup. Every trade you backtest, and later every trade you take on a simulated account, is checked against it. If something is not on the card, it is not part of the setup.

One page is a deliberate limit. If a setup needs three pages to explain, it is probably several setups, or it has too many rules to test honestly.

## What goes on it

Here is the chapter's example setup as a card. Yours will have the same fields.

| Field | Example |
| --- | --- |
| Name | Prior-day low reclaim |
| Version | 1.0, with the date |
| Market | MES |
| Session | Regular session, entries from 9:30 a.m. to 11:00 a.m. New York time |
| Timeframe | 5-minute candles |
| Conditions | Price trades below the prior day's low |
| Entry | A 5-minute bar closes back above the prior day's low; buy at the next bar's open |
| Stop | One tick below the lowest price made below the prior day's low |
| Target | +2R, or exit at 12:00 p.m., whichever comes first |
| Management | None; the stop and target stay where they are |
| No trade | Stop more than 12 points away; major scheduled release within 15 minutes; two losses already today |
| Risk | A fixed dollar amount per trade, sized with the position sizing formula |

The first five fields say **where and when** the setup applies. The next five say **what you do**. **Management** covers everything between entry and exit: moving the stop, taking part of the position off, or nothing at all. "Nothing" is a perfectly good management rule, and the easiest one to test.

The chart settings from your template, such as the session and any indicators with their inputs, belong on the card as well.

## A version number, and why it changes

Every change to the rules makes a new version. One common scheme:

- **1.0 to 1.1** for a small change, such as adding a no-trade filter.
- **1.0 to 2.0** for a big one, such as a different entry.

Keep a short change log at the bottom of the card: the date, the new version number and exactly what changed.

The reason is simple. Version 1.0 and version 1.1 are different setups, even if they share a name. Every trade in your log records the version it was taken under, so the results of each version stay separate. Mixing them produces numbers that describe neither.

> [!tip] Keep old versions
> When you change the card, save the old version rather than overwriting it. You will want to compare the two later.

## Using the card

- Before each backtesting session, read the card from top to bottom.
- Keep it open beside the chart while you work.
- When a situation is not covered by the card, stop. Decide how to handle it, write that decision onto the card as a new version, and carry on under the new version.

A trade that does not match the card exactly is not part of the sample, however good it looks.

> [!check] You change the stop rule on your setup card. What should happen to the version number?
> - [x] It changes, and trades from then on are logged under the new version
> - [ ] It stays the same, because the setup has the same name
> - [ ] It changes, and the old trades are relabelled with the new version
> A rule change makes a different setup, so its results must be kept apart from the old version's.
