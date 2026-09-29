---
id: sample-size
title: Sample size
summary: How many trades a backtest needs before the numbers mean anything.
minutes: 5
---

## Why 20 trades tells you almost nothing

Imagine a setup whose true win rate, over thousands of trades, is exactly 50%. You backtest 20 trades. What win rate will your log show?

Very often, not 50%. Luck alone moves a small sample around a lot. With 20 trades, the win rate you measure can easily land anywhere from about 30% to 70%. You might see 65% and think you have found something special, or 35% and throw away a perfectly ordinary setup.

The table shows the range that about 95% of samples would fall inside, for a setup whose true win rate is 50%:

| Trades in the sample | Measured win rate usually lands between |
| --- | --- |
| 20 | about 28% and 72% |
| 100 | about 40% and 60% |
| 400 | about 45% and 55% |

Notice the pattern. To halve the uncertainty, you need **four times** as many trades. Precision grows slowly.

Win rate is the easy number. Expectancy moves around even more in a small sample, because a single large winner or loser shifts the average of a short list a long way.

## A rough floor for a first read

There is no magic number, but a common rule of thumb, and the floor this course uses, is **about 100 trades** before you take a first serious look at the results. Even at 100, treat the numbers as a rough estimate, not a measurement.

Below that, a backtest is still useful for learning your rules and finding the unclear ones. It is just not evidence yet.

A setup that triggers rarely will take a long time to reach 100 trades. That is a real cost, and worth knowing before you commit to testing it.

## Different market conditions inside one sample

A hundred trades from one quiet month are not the same as a hundred trades spread across a year. Markets move through different conditions: calm and volatile periods, trending and ranging stretches, weeks full of economic news and weeks with none.

- **Spread the sample out.** Take trades from several months, and from both quieter and busier periods, rather than one recent stretch.
- **Tag each trade** with the condition it happened in, for example a trend day, a range day or a high-volatility day. The notes column in your log is enough.
- **Compare by tag** once you have enough trades. A setup that only does well in one kind of market is worth knowing about, and so is one that falls apart in another.

Be careful not to slice too finely. Ten trades under one tag is a small sample all over again.

> [!note] Luck is part of every sample
> A large sample does not remove luck. It makes luck a smaller part of what you are looking at.

> [!check] A setup shows a 65% win rate after 20 trades. What is the most honest reading?
> - [x] The true win rate could plausibly be far lower or higher, so it needs many more trades
> - [ ] The setup has proven a 65% win rate
> - [ ] The sample is fine as long as all 20 trades came from the same week
> Twenty trades leave a range of roughly 20 percentage points either side, which luck alone can cover.
