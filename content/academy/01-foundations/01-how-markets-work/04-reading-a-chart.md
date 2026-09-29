---
id: reading-a-chart
title: Reading a chart
summary: Candles, timeframes and volume - what a chart is showing you and what it is not.
minutes: 5
---

## What one candle summarises

A candlestick is a summary of every trade in one period of time. It keeps four prices:

- **Open**, the first trade of the period
- **High**, the highest trade
- **Low**, the lowest trade
- **Close**, the last trade

The thick **body** runs between the open and the close. The thin **wicks** reach up to the high and down to the low. The colour usually tells you whether the close was above the open or below it.

What a candle throws away matters just as much. It does not show the order in which prices traded, how long price spent at each level, or where the volume happened. Two candles with identical open, high, low and close can hide completely different stories: one may have drifted up steadily, the other may have dropped hard and then recovered in the last seconds.

## Timeframe is a choice, not a truth

The same hour of trading can be drawn as sixty 1-minute candles, twelve 5-minute candles or one 60-minute candle. None of them is more correct. Each is a different summary of the same trades.

Timeframe changes what you think you see. A move that looks like a clean trend on a 5-minute chart can be a messy back-and-forth on a 1-minute chart, and a small wiggle on a 60-minute chart. Some charts are not based on time at all: tick, volume and range bars start a new bar after a set amount of activity or movement.

Pick a timeframe for a reason, write it down and stay with it. When you backtest later, a result found on one timeframe says nothing about another.

## Volume as participation

Volume is the number of contracts traded in a bar. Every contract traded has a buyer and a seller, so volume is not "buying" or "selling". It measures **participation**: how many contracts changed hands.

- A move on high volume had many participants involved.
- A move on low volume had few.

Volume follows a daily rhythm. In equity-index futures it is usually heaviest near the open and close of the regular session and lightest overnight. So compare a bar's volume with the same time on other days, not just with the bar before it.

## What a chart is not

A chart shows what already happened. It does not show the orders waiting to trade (that is the DOM, later in this course), who was trading, or what happens next.

## Why two people see different things

Put two traders in front of the same market and they can describe it in opposite ways. Some of that is settings:

- **Timeframe.** One looks at 1-minute candles, the other at 30-minute candles.
- **Session.** A chart of only the regular session has a different open, high and low from a chart of the full 24-hour day.
- **Chart type.** Time bars and range bars of the same data look nothing alike.

The rest is people. Each of us notices what we expect to see. That is exactly why this Academy asks you, later on, to turn what you see into written rules and test them.

> [!tip] Before you describe a chart
> Say the market, the timeframe and the session out loud first. Half of all disagreements about a chart are really about those three settings.

> [!check] Two candles have the same open, high, low and close. What can you say about them?
> - [ ] The same trades happened in both
> - [x] Their summaries match, but the path and the volume inside them may be completely different
> - [ ] They had the same volume
> A candle keeps only four prices, so the order of trades and where the volume traded are lost.
