---
id: sc-vwap
title: VWAP in Sierra
summary: VWAP and its bands in Sierra - session, anchored, and the settings behind them.
minutes: 5
---

## What you already know

The Foundations lesson on VWAP covered the ideas: an average price weighted by volume, reset each session or anchored to a moment you choose, with bands that describe how spread out trading has been. This lesson is about setting VWAP up in Sierra Chart and knowing which settings change the line.

## Session VWAP

Sierra Chart has a VWAP study that you add from the chart's studies window like any other. Set up as a session VWAP, it starts again at the beginning of each session.

The key point is **what "the session" means**. The study resets according to the chart's session times, or according to its own reset inputs, depending on how you set it up. Two sensible choices give two different lines:

- **Full-day VWAP** starts at the evening open of the equity-index futures session, 6:00 p.m. New York time, and includes overnight trading.
- **Regular-session VWAP** starts at 9:30 a.m. New York time and ignores the overnight session.

Neither is right or wrong. Pick one, write it on your setup card, and check that every chart uses the same one.

## Anchored VWAP

An **anchored VWAP** starts at a time you choose instead of at the session open: a swing high or low, the start of the week, or the release of a piece of economic news.

Depending on your version, you set the anchor through the study's inputs, for example a start date and time or a reset period, or through a drawing tool. **Check Sierra Chart's documentation for the current method** before you rely on one. Whichever way you use, write down the rule for choosing the anchor. "From the prior day's high" is a rule; "from wherever looks important" is not.

## Bands and their settings

| Setting | What it changes |
| --- | --- |
| Session times, or the reset input | When a session VWAP starts again |
| Start point | Where an anchored VWAP begins |
| Price used | Which price each bar contributes, such as the close, a typical price or every trade |
| Band count and distances | How many bands are drawn and how far from VWAP each one sits |

The study's inputs set how many bands it draws and at what distances, usually 1, 2 and 3 standard deviations. Some versions offer more than one way to calculate the bands; note which one you use, because the choice changes where they sit.

The **price used** matters more than it seems. A VWAP built from every trade and one built from each bar's typical price will be close, but not identical. On a chart built from detailed data the difference is usually small; on coarse data it can be larger.

> [!tip] A quick sanity check
> Look at the first bar of a session. VWAP is an average of the prices traded so far, so at the end of that bar the line must sit inside the bar's range. If it does not, the session start is not where you think it is.

> [!check] Your session VWAP starts at 6:00 p.m. New York time instead of at the stock market's open. What decides that?
> - [x] The chart's session times, or the study's reset setting
> - [ ] The band distances
> - [ ] The colour of the VWAP line
> Session VWAP starts again when the session starts, and the session times or reset input define when that is.
