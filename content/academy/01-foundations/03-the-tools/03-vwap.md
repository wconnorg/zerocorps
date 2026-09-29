---
id: vwap
title: VWAP
summary: How VWAP is calculated, what it is anchored to, and why large participants watch it.
minutes: 5
---

## The calculation in words

**VWAP** stands for volume-weighted average price. It is the average price of every contract traded since a starting point, where each price counts as many times as it traded.

In words: multiply each trade's price by its size, add all of those up, and divide by the total number of contracts.

A small example. During a session, three groups of trades happen:

- 10 contracts at 5,000
- 30 contracts at 5,004
- 10 contracts at 5,002

Price x size gives 50,000 + 150,120 + 50,020 = 250,140. Divide by the 50 contracts traded and VWAP is **5,002.80**. A plain average of the three prices would be 5,002.00. VWAP is pulled toward 5,004, because that is where most of the contracts changed hands.

Charts usually approximate this bar by bar, using each bar's typical price and volume, unless they are built from every trade. Because VWAP is a running average, it moves more slowly as the session goes on: each new trade is a smaller share of the total.

## Session VWAP versus anchored VWAP

- **Session VWAP** starts again at the beginning of each session. Whether "the session" means the full day or only the regular session is a setting, and it changes the line.
- **Anchored VWAP** starts from a moment you choose: a swing high or low, the start of the week, or the minute a major economic release came out. It answers the question "what is the average price paid since then?"

## Standard-deviation bands

Many platforms draw bands above and below VWAP, usually at 1, 2 and 3 standard deviations. They describe how spread out the session's trading has been around its average.

- Wide bands describe trade spread over a wide range of prices.
- Narrow bands describe trade packed close to the average.
- Price outside the second band is far from the average compared with that session's own spread.

The bands are a measurement, not a signal.

## What above and below VWAP describe

| Price is... | What it describes |
| --- | --- |
| Above VWAP | Higher than the average paid since the anchor, so on average buyers since then are ahead |
| Below VWAP | Lower than the average paid, so on average sellers since then are ahead |
| Crossing back and forth | Trade balanced around the average, with neither side ahead for long |

A session where price holds above VWAP for most of the day describes buyers in control on average. A session that keeps crossing it describes balance.

## Why large participants watch it

Institutions that buy or sell very large amounts cannot do it in one order without moving the price against themselves. They often spread their orders through the day, and their execution is commonly judged against VWAP: buying below the day's VWAP counts as a better-than-average execution.

So VWAP is a benchmark that real money is measured against. That is why it matters, and it is also all it is. It has no power of its own over price.

> [!check] During a session, 10 contracts trade at 5,000 and 90 contracts trade at 5,010. Where is VWAP?
> - [ ] 5,005, halfway between the two prices
> - [x] 5,009, close to where most of the volume traded
> - [ ] 5,010, the last price
> (10 x 5,000 + 90 x 5,010) divided by 100 contracts is 5,009, because each price counts as often as it traded.
