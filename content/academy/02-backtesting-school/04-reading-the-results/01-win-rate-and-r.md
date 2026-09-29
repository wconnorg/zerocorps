---
id: win-rate-and-r
title: Win rate and R
summary: Turning the log into win rate, average R and expectancy.
minutes: 6
---

## Computing each number from the log

Everything in this lesson comes from one column of your log: **Result in R**. Here are the calculations, in words.

- **Trades** is the number of rows.
- **Wins** are trades with a result above 0R. **Losses** are trades below 0R.
- **Win rate** is wins divided by trades.
- **Average win** is the total of the winning results divided by the number of wins.
- **Average loss** is the total of the losing results divided by the number of losses.
- **Expectancy** is the total R divided by the number of trades, which gives the same answer as the formula from Foundations.

Decide once how you count a trade that closes at exactly 0R, write it on your setup card, and stick to it. Counting it as a trade but neither a win nor a loss is common.

## A worked example

Ten trades from a log, in order: +2, -1, -1, +2, -1, +1.5, -1, -1, +2, -0.5.

- Wins: 4 trades (+2, +2, +1.5, +2), totalling +7.5R.
- Losses: 6 trades (five at -1 and one at -0.5), totalling -5.5R.
- Win rate: 4 / 10 = **40%**.
- Average win: 7.5 / 4 = **1.875R**.
- Average loss: 5.5 / 6 = about **0.92R**.
- Total: 7.5 - 5.5 = +2.0R, so expectancy is 2.0 / 10 = **+0.2R per trade**.

Check it with the Foundations formula: (0.4 x 1.875) - (0.6 x 0.9167) = 0.75 - 0.55 = +0.2R. The same answer, as it should be.

Ten trades is far too few to mean anything. The example is only here for the arithmetic.

## A spreadsheet that does it for you

Doing this by hand for 100 trades is slow and easy to get wrong. A spreadsheet does it instantly. If your results in R are in column J, rows 2 to 101, these formulas work in common spreadsheet programs:

```
Trades:        =COUNT(J2:J101)
Wins:          =COUNTIF(J2:J101,">0")
Win rate:      =COUNTIF(J2:J101,">0")/COUNT(J2:J101)
Average win:   =AVERAGEIF(J2:J101,">0")
Average loss:  =AVERAGEIF(J2:J101,"<0")
Total R:       =SUM(J2:J101)
Expectancy:    =AVERAGE(J2:J101)
```

The average loss comes out as a negative number, which is fine; just remember the sign when you use it in the formula.

If you keep your log in Obsidian, a plain Markdown table stores the numbers well but does not calculate them. Copying the Result column into a spreadsheet for the arithmetic is the simplest route.

## Expectancy per trade and per week

Expectancy per trade tells you what an average trade is worth. To see what it means in practice, multiply by how often the setup trades.

If a setup averages +0.2R per trade and triggers about 6 times a week, it averages about 0.2 x 6 = **+1.2R a week**.

That is an average, and averages hide a lot. Many individual weeks will be negative, and some will be much better than the average. Commissions and slippage come off every trade, so subtract them in R before you trust any of these numbers.

> [!check] A log has 50 trades and a total of +10R. What is the expectancy per trade?
> - [ ] +10R
> - [x] +0.2R
> - [ ] +0.5R
> Expectancy is the average result, so +10R divided by 50 trades is +0.2R.
