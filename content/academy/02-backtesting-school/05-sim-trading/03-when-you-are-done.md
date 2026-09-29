---
id: when-you-are-done
title: When you are done
summary: How you know the Backtesting School is finished for a setup, and what comes next.
minutes: 5
---

## The three records

The Backtesting School is finished for a setup when you have three things:

1. **A written setup card**, in its final version, with a change log that shows how it got there.
2. **A backtest log with a large enough sample**, at least around 100 trades, containing every trade the rules called, losers included.
3. **A sim record**, forward tested on live data with the same card and the same log format.

Sim trades arrive far more slowly than backtest trades, because you have to wait for the market to produce them. Building the sim record usually takes weeks or months, and the sample-size thinking from the backtest applies here too: the more trades, the more the numbers mean.

## The numbers side by side

Put the two records next to each other. Here is an invented example, only to show the format:

| | Backtest | Sim |
| --- | --- | --- |
| Trades | 120 | 45 |
| Win rate | 42% | 38% |
| Average win | 2.1R | 1.9R |
| Average loss | 1.0R | 1.1R |
| Expectancy | +0.30R | +0.04R |
| Maximum drawdown | 9R | 7R |

Check the expectancy lines with the formula: (0.42 x 2.1) - (0.58 x 1.0) = +0.30R for the backtest, and (0.38 x 1.9) - (0.62 x 1.1) = +0.04R for the sim.

Reading it honestly:

- The sim is worse, which is normal. The question is **why**. Look at the exit reasons, the missed trades and the rule breaks. Slightly larger average losses, as here, can point to slippage on stops.
- Most of the expectancy has gone. On paper the setup looked comfortable; in practice it is close to zero. That points to execution before anything else.
- 45 sim trades is still a small sample, so both lines are estimates.

Being "done" means the three records exist and the numbers in them are honest. It does not mean the setup makes money, and it is not a signal to trade real money. Sometimes the honest outcome of the whole process is to cut the setup, and that still counts as finishing it.

## What the Sierra track adds

The Sierra Chart track comes after this course. It works on a different platform, one that costs money, and goes deeper into the tools: volume and TPO profiles and VWAP set up in Sierra, order flow with Numbers Bars and the Trading DOM, and a chapter on how funded-account evaluations work. It comes second on purpose.

## The income test

Before paying for any platform, data feed or evaluation, two things should be true:

- You have finished records like the ones above for a setup.
- The money comes from **income you can spare** after your bills, never from savings or credit.

The Sierra track explains this test in full. The short version: trading tools are a cost, and a cost you cannot comfortably afford adds pressure, and pressure is the enemy of following rules.

> [!check] Which set of records means the Backtesting School is finished for a setup?
> - [x] A written setup card, a backtest log with a large enough sample, and a sim record
> - [ ] A profitable week on a simulated account
> - [ ] A backtest of 20 trades and a funded-account evaluation
> The three records together show the rules, how they did on history, and how they held up in real time.
