---
id: entry-stop-target
title: Entry, stop, target
summary: Writing the entry, the stop and the target as conditions, with a worked example.
minutes: 6
---

## Condition, trigger, invalidation

An entry rule has three parts.

- **The condition** is the situation that must be true before you even look for a trade. For example: price has traded below the prior day's low during the regular session.
- **The trigger** is the exact event that puts you in. For example: a 5-minute bar closes back above the prior day's low, and you buy at the open of the next bar.
- **The invalidation** is what cancels the idea before the trigger happens. For example: if no trigger comes by 11:00 a.m. New York time, the setup is off for the day.

Keeping the three apart stops you from entering early "because it's nearly there", and from hanging on to an idea the market has already cancelled.

## The stop as a rule, not a feeling

The stop goes where the trade idea is proven wrong, and it is written as a rule. For example: one tick below the lowest price made while price was under the prior day's low.

Two things the stop is not:

- It is not "wherever the loss would feel bearable". That is a sizing question, and the position sizing lesson answers it after the stop is placed.
- It is not something you move because the trade is going badly. A stop moves only if a written rule says so, and never further away.

## The target as a rule

Targets come in three common kinds, and a setup can combine them.

| Kind | Example | What to know |
| --- | --- | --- |
| Fixed R | Exit at +2R | Simple to test; ignores the market's structure |
| A level | Exit at the prior day's POC | Distance changes from trade to trade |
| A time | Exit at 12:00 p.m. New York time | Caps how long a trade can last |

"Exit at +2R or at 12:00 p.m., whichever comes first" is a perfectly good rule.

## The no-trade conditions

Some situations switch the setup off completely. They are rules too, and they belong on the page:

- A major scheduled economic release is due within 15 minutes.
- The stop would be more than 12 points away, so the size would be tiny or zero.
- You have already taken two losing trades today.

## A worked example

Here is the chapter's example setup, written out in full. It is only an illustration of the format.

- **Market and chart:** MES, 5-minute candles, regular session.
- **Condition:** price trades below the prior day's low.
- **Trigger:** a 5-minute bar closes back above the prior day's low; buy at the open of the next bar.
- **Invalidation:** no trigger by 11:00 a.m. New York time.
- **Stop:** one tick below the lowest price made below the prior day's low.
- **Target:** +2R, or exit at 12:00 p.m., whichever comes first.
- **No trade:** stop more than 12 points away, or a major scheduled release within 15 minutes.

Now some numbers. The lowest price below the prior day's low was 4,997.25, so the stop goes one tick lower, at 4,997.00. The trigger bar closes, and the next bar opens at 5,003.00, which is the entry.

- Stop distance: 5,003.00 - 4,997.00 = 6 points, which is 24 ticks.
- Risk on one MES contract: 24 x $1.25 = $30. That is 1R.
- Target at +2R: 12 points above the entry, at 5,015.00.

Every one of those numbers came from a rule. Nothing was decided by feel.

> [!check] Entry is 5,010.00 and the stop is 5,006.50. Where is a +2R target?
> - [ ] 5,013.50
> - [ ] 5,020.00
> - [x] 5,017.00
> The stop is 3.5 points away, so 2R is 7 points above the entry.
