---
id: drawdown
title: Drawdown
summary: Drawdown, losing streaks, and what a setup's worst stretch looks like on paper.
minutes: 5
---

## Maximum drawdown

Add up your results in R, trade by trade, and you get a **running total**, often drawn as an equity curve. **Drawdown** is how far the running total has fallen from its highest point so far. **Maximum drawdown** is the largest such fall in the whole sample, measured from a peak to the lowest point before a new high.

Here are eleven trades: +2, -1, +2, -1, -1, -1, -1, +2, +2, +2, -1.

The running total after each trade is: +2, +1, **+3**, +2, +1, 0, **-1**, +1, +3, +5, +4.

- The total peaks at +3R after trade 3.
- It falls to -1R after trade 7.
- That fall is 3 - (-1) = **4R**, the maximum drawdown.
- It takes until trade 9 to get back to +3R, and trade 10 to set a new high.

Notice that the setup finished well ahead and still spent five trades in a row below its peak. That is normal. Maximum drawdown measures the fall, not the final result.

## Streak length at a given win rate

Losing streaks come with every setup, and the lower the win rate, the longer they get. The table shows the typical longest losing streak you would see somewhere in 100 trades, if wins and losses arrive at random:

| Win rate | Typical longest losing streak in 100 trades |
| --- | --- |
| 60% | about 4 to 5 |
| 50% | about 6 |
| 40% | about 7 to 8 |
| 30% | about 10 to 11 |

These are typical values, not worst cases. In any particular 100 trades, the longest streak can be longer, and over several hundred trades it usually is. A setup with a 40% win rate that has never shown more than four losses in a row has probably not been tested for long enough.

## The worst stretch decides the risk per trade

Your backtest's maximum drawdown is a **floor** for what to expect, not a ceiling. Real trading adds slippage, mistakes and a sample that has not happened yet, so assume the future's worst stretch will be at least as deep.

That turns drawdown into a sizing question. If the backtest's maximum drawdown was 10R and you risk $100 per trade, you should expect to see your account fall by $1,000 or more at some point. Ask two questions honestly:

- Can the account take that fall and keep trading?
- Can *you* take it and keep following the rules?

You can also work backwards. Decide the largest fall in dollars you could accept. Some traders then add a buffer, for example planning for one and a half times the backtest's worst drawdown. If you could accept a $1,500 fall and the backtest's maximum drawdown was 10R, planning for 15R gives $1,500 / 15 = **$100 risk per trade**.

> [!warning] Deeper than you think
> A drawdown on paper is a number. Living through one, with real money and no idea when it ends, is much harder. Size for the worst stretch, not the average one.

> [!check] A running total goes +4R, +6R, +3R, +1R, +5R, +8R. What is the maximum drawdown?
> - [ ] 3R
> - [ ] 1R
> - [x] 5R
> The peak at +6R fell to +1R before a new high, a drop of 5R.
