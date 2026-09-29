---
id: futures-contracts
title: Futures contracts
summary: What a futures contract is, and the words on it - tick, point, multiplier, margin, expiry.
minutes: 6
---

## What a futures contract is

A futures contract is a standardised agreement to buy or sell something at a set price on a set future date, traded on an exchange. Every contract of the same kind is identical, which is what lets thousands of people trade it with each other.

For equity-index futures such as ES and NQ, the "something" is the value of a stock index. They are **cash-settled**: nobody delivers shares. Most traders close their position long before expiry, and their profit or loss is simply the change in the contract's price, multiplied by the contract's dollar value per point.

## Contract versus the underlying index

ES tracks the S&P 500 index, but it is a separate market with its own price. The futures price usually sits a little away from the index itself, a gap called the **basis**, which reflects interest rates and expected dividends until expiry.

The futures also trade nearly around the clock, while the index is only calculated during stock-market hours. The chart you trade is the contract, not the index, and the two will not show exactly the same numbers.

## Points, ticks and multipliers

- **A point** is one whole unit of price, for example 5,000.00 to 5,001.00.
- **A tick** is the smallest move the contract allows. For these four contracts it is 0.25 points, so there are 4 ticks in a point.
- **The multiplier** is the dollar value of one point.
- **Tick value** is tick size x multiplier.

| Contract | Tracks | Per point | Tick | Per tick |
| --- | --- | --- | --- | --- |
| ES | S&P 500 | $50 | 0.25 | $12.50 |
| MES | S&P 500 | $5 | 0.25 | $1.25 |
| NQ | Nasdaq-100 | $20 | 0.25 | $5.00 |
| MNQ | Nasdaq-100 | $2 | 0.25 | $0.50 |

A **micro** contract is one tenth of its standard contract. It follows the same index, but each point is worth a tenth as much. A 10-point move is $500 on one ES contract and $50 on one MES contract.

## Margin

**Margin** is the deposit your broker requires before you can hold a position. It is not a fee, and it is not the most you can lose. Your losses can be larger than your margin.

Margin is small compared with what the contract controls. At a price of 5,000, one ES contract represents 5,000 x $50 = $250,000 of index exposure. That leverage is why a small move in points is a large move in dollars, and why risk has to be measured before every trade.

## Sessions

CME equity-index futures trade from Sunday evening to Friday afternoon, New York time, with a short break each day. Most traders split that time in two:

- **The regular session** usually means the U.S. stock market's hours, 9:30 a.m. to 4:00 p.m. New York time. Volume and liquidity are highest here.
- **The overnight session** is everything else. It is often quieter and thinner.

Charts can show either the full day or only the regular session, and the choice changes the day's open, high and low. Hours can change around holidays, so check the exchange's current schedule.

## Expiry and rollover

Equity-index futures expire every quarter, in March, June, September and December, on the third Friday of the month. Each month has a code letter (H, M, U and Z), so ESZ6 is the December 2026 ES contract.

About a week before expiry, most traders **roll over** to the next contract, and volume moves with them. Platforms often offer a continuous chart that joins contracts together. When you study history, check how your platform joins them, because the prices of two contract months differ and the join can leave a gap.

> [!check] Price on MES moves from 5,010.00 to 5,014.00. What is that move worth on one contract?
> - [x] $20
> - [ ] $200
> - [ ] $2
> Four points at $5 a point is $20, the same as 16 ticks at $1.25.
