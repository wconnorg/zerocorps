---
id: qt-data-and-simulation
title: Data and simulation
summary: Connecting a data source and a simulated account in Quantower.
minutes: 5
---

## What a connection is

Quantower is the software on your screen. Market data and trading accounts come from somewhere else, through a **connection**: a link to a broker, a data provider or a simulated account. A connection can supply data, an account or both, and you can usually have more than one set up.

Before anything shows on a chart, you need at least one connection that supplies the market you want to study.

## Which connections work without paying

This changes often, so there is no fixed list here. **Check the connections list in your own version, and the terms of each provider, before you choose.** When you compare them, ask:

- Does it supply the futures contracts you want, such as MES or ES?
- Is its data real-time or delayed, and does it cost anything?
- How much history does it provide, and at what detail: every trade, or only 1-minute bars?
- Does it include a simulated account?

Real-time data for exchange-traded futures usually carries exchange fees, charged through whoever supplies your feed. Delayed data and demo accounts are where no-cost options are most often found, but confirm it for your own connection.

## The simulated account

A **simulated account** behaves like a real one with pretend money. You place orders, they fill, you hold positions, and your profit or loss is tracked, but nothing reaches a real market.

Two points are worth knowing from the start:

- **Set a realistic balance** if you can. A huge pretend balance makes large position sizes feel normal.
- **Simulated fills can be generous.** Some simulators fill a limit order the moment price touches it, with no queue ahead of you. Real markets are less kind, as you saw in the orders lesson.

Always check which account an order is going to before you place it. The account name is shown in the order panels; make a habit of reading it.

## Delayed versus live data

Delayed data is the same data, shown a fixed number of minutes late. Whether that matters depends on the job.

| Job | Delayed data | Live data |
| --- | --- | --- |
| Bar-by-bar backtest on history | Works | Works |
| Forward testing on a simulated account | Not suitable, the prices are stale | Needed |
| Real trading | Not suitable | Needed |

For backtesting, delayed data is fine. You are replaying bars that finished days, weeks or months ago, and they are identical whether they first arrived live or ten minutes late. What matters for a backtest is **history**: how far back it goes and how detailed it is. A volume profile built from every trade is more accurate than one estimated from 1-minute bars.

For forward testing later in this course, you will need prices as they happen.

> [!warning] Know which account you are on
> A platform can hold a simulated account and a real one side by side. Checking the account before every order is a habit worth building now, while nothing is at stake.

> [!check] Why is delayed data usually fine for bar-by-bar backtesting?
> - [ ] Delayed data is more accurate than live data
> - [ ] Backtests do not need any data
> - [x] You are replaying history, which is the same whether it arrived late or live
> A backtest works on bars that finished long ago, so a delay of a few minutes changes nothing about them.
