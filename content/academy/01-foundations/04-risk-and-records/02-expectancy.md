---
id: expectancy
title: Expectancy
summary: What a win rate means, what R is, and the one number that matters more than the others.
minutes: 5
---

## R multiples

**R** is the amount you risked on a trade: the distance to your stop, in money. It is written as **1R**.

Measuring results in R makes every trade comparable, whatever the market or the size:

- You risk $100 and make $300: **+3R**.
- You risk $100 and the stop is hit: **-1R**.
- You risk $100 and exit early for a $50 loss: **-0.5R**.

A trade on five MES contracts and a trade on one ES contract can now be compared directly.

## Expectancy

**Expectancy** is the average result per trade, in R, over many trades:

**expectancy = (win% x average win) - (loss% x average loss)**

Here win% and loss% are written as fractions, and the average win and average loss are both written as positive numbers of R.

Take a setup that wins 40% of the time, with an average win of 2.5R and an average loss of 1R:

(0.40 x 2.5) - (0.60 x 1) = 1.00 - 0.60 = **+0.4R per trade**

Over 100 trades, that averages out to +40R before costs, although the real total of any 100 trades will land above or below it. Commissions and slippage come off every trade, so subtract them in R as well.

## Why a 40% win rate can make money and a 70% win rate can lose it

| | Setup A | Setup B |
| --- | --- | --- |
| Win rate | 40% | 70% |
| Average win | 2.5R | 0.5R |
| Average loss | 1R | 1.5R |
| Expectancy | +0.4R | -0.1R |

Setup B wins seven trades in ten, and it still loses money: (0.70 x 0.5) - (0.30 x 1.5) = 0.35 - 0.45 = -0.1R per trade. Its wins are small and its losses are big.

Setup A loses more often than it wins, and it comes out ahead, because each win is worth two and a half losses.

A high win rate feels good, trade by trade. Expectancy is what adds up. You need all three numbers, the win rate, the average win and the average loss, before a result means anything.

## Variance and losing streaks

Positive expectancy describes the average over many trades. It says nothing about the order the wins and losses arrive in, and that order is close to random.

At a 40% win rate, each trade has a 60% chance of losing. The chance that five given trades in a row all lose is 0.6 x 0.6 x 0.6 x 0.6 x 0.6, about 7.8%. That sounds small, but over 100 trades there are many chances for it to happen, and a run of five or more losses somewhere in those 100 trades is very likely.

So a setup with a healthy expectancy will still have losing days, losing weeks and long losing streaks. Expect them, size for them, and judge a setup on a large sample, never on its last few trades.

> [!note] An estimate, not a promise
> Expectancy measured from past trades describes that sample. The future can be better or worse, and it usually looks worse once real fills and emotions are involved.

> [!check] A setup wins 50% of the time, with an average win of 1.2R and an average loss of 1R. What is its expectancy?
> - [ ] +0.2R
> - [x] +0.1R
> - [ ] +1.2R
> (0.5 x 1.2) - (0.5 x 1) = 0.6 - 0.5 = +0.1R per trade.
