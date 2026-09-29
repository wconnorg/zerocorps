---
id: logging-every-trade
title: Logging every trade
summary: The backtest log - every trade the rules produce, including the ones that lose.
minutes: 5
---

## The backtest log

The **backtest log** is a table with one row for every trade your rules call. It is the only output of a backtest that matters: every number you calculate later, from win rate to drawdown, comes from it.

A spreadsheet works well, because it can do the arithmetic for you in the next chapter. Whatever you use, keep the same columns for every trade.

## The log columns

| Column | Example |
| --- | --- |
| Trade number | 14 |
| Date | 2026-03-12 |
| Setup version | 1.0 |
| Direction | Long |
| Entry | 5,003.00 |
| Stop | 4,997.00 |
| Target | 5,015.00 |
| Exit | 4,997.00 |
| Exit reason | Stop |
| Result in R | -1.0 |
| Screenshot | 014-2026-03-12 |
| Notes | Trigger bar had a very large range |

A few columns earn their place later:

- **Setup version** keeps the results of different rule sets apart.
- **Exit reason** shows how trades end. If most trades end at the time exit, the target may rarely be reached, and that is worth knowing.
- **Notes** can hold the market context, such as a trend day or a range day, so you can compare results by condition later.

Two optional columns are useful once you are comfortable: the furthest the trade went **against** you before it closed, and the furthest it went **in your favour**, both in R. They help when you later ask whether the stop or target is in a sensible place.

## Screenshots for every trade

Take a screenshot at entry and another at exit, for every trade.

- They let you check later that each trade really matched the card.
- They show patterns a table cannot, such as losing trades that all began after a long, fast move.
- They protect you from your own memory, which will otherwise remember the trades differently.

Name the files the same way every time, for example the trade number and the date, and keep one folder per setup version.

## No skipping losers, no adding trades

The log records **exactly** what the rules produce. That sounds obvious, and it is where most backtests go wrong.

- **Losers stay in.** A losing trade the rules called is part of the setup, even if it looks foolish in hindsight. Remove it and the numbers describe a better setup than the one you have.
- **Nothing gets added.** A great trade the rules did not call belongs to a different setup. You can note the idea separately for a future version.
- **Missed trades go in.** If you find a trade the rules called that you scrolled past, add it, win or lose.
- **Unclear cases become rules.** If you cannot tell whether the rules called a trade, decide, write the decision on the card as a new version, and apply it the same way from then on.

> [!warning] A trimmed log lies
> Every loser skipped and every winner added makes the results look better than the rules deserve. The trouble is that you will believe those numbers, and risk money on them.

> [!check] While replaying, you spot a great trade the rules did not call. What goes in the log?
> - [ ] The trade, marked as a bonus
> - [ ] The trade, but only if it won
> - [x] Nothing, although you can note the idea separately for a future version
> The log records what the rules produce, and a trade outside them belongs to a different setup.
