---
id: what-backtesting-is
title: What backtesting is
summary: What backtesting is, what it can prove, and what it cannot.
minutes: 5
---

## Replaying written rules on past data

**Backtesting** means taking a written set of trading rules, applying them to past market data, and recording every trade those rules would have taken. You can do it by hand, stepping through a chart one bar at a time, or with code that does the stepping for you. The Backtesting School teaches the manual way.

The important word is *written*. If the rules only exist in your head, you are not backtesting. You are looking at old charts and remembering the trades you like.

## What it can show

A careful backtest can tell you:

- Whether the rules produce trades at all, and how often
- The win rate, average win and average loss in R, and so the expectancy, in that sample
- The worst drawdown and the longest losing streak in that sample
- Whether your rules are clear enough for you to apply the same way every time

It does all of that for the cost of your time, not your money.

## Sample size

A handful of trades tells you almost nothing, because luck can easily outweigh the rules over a short run. The more trades a backtest has, the more its numbers can be trusted. A later lesson covers how many is enough for a first read.

## Hindsight and look-ahead bias

These two biases make a backtest look better than the rules deserve.

- **Look-ahead bias** is using information that was not available when the decision would have been made. Seeing the bars to the right, using the day's high before the day was over, or relying on an indicator that redraws its past values are all examples.
- **Hindsight bias** is knowing how the chart turned out. The good trades look obvious, and the bad ones are easy to talk yourself out of taking.

The defences are practical: hide the right side of the chart, move forward one bar at a time, and decide on each trade before you move on.

## Curve fitting

**Curve fitting** is adjusting the rules until they fit the past perfectly. You notice three big losers, add a filter that happens to remove them, and the results improve. Repeat that a few times and the rules describe the history you tested, not a behaviour that repeats.

Warning signs include:

- Many rules, each with a very specific number
- Results that fall apart on a different stretch of data
- Filters that remove only a few trades

The guards are to keep rules simple, change one thing at a time, and check the result on data you did not use to build the rules.

## A filter, not a promise

A good backtest does not prove that a setup will make money. Markets change, real fills are worse than paper ones, and trading live feels nothing like clicking through history.

What a backtest does well is **filter out** ideas. If a set of rules loses money on past data, tested carefully and over a large sample, that is strong evidence against risking anything on it. The ideas that survive go on to the next test: trading them in real time on a simulated account.

> [!warning] Past results are not future results
> A backtest describes what rules did on one stretch of history. It can never guarantee what they will do next.

> [!check] You backtest a setup, then add a rule that removes the three biggest losers, and the results improve. What is the main risk?
> - [x] Curve fitting, because the rule may only describe those three past trades
> - [ ] Look-ahead bias, because the rule uses future prices
> - [ ] Too large a sample, because adding rules adds trades
> A rule added to remove specific past losers often fits the past without describing anything that repeats.
