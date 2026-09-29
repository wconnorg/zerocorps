---
id: orders-and-fills
title: Orders and fills
summary: Market, limit and stop orders, and what actually happens when one of them fills.
minutes: 5
---

## Limit orders rest, market orders take

There are three order types you will use from the first day.

- **A market order** says "trade now, at the best price available." It takes liquidity. In a normal market it fills almost at once, but you do not choose the price.
- **A limit order** says "buy at this price or lower" or "sell at this price or higher." It rests in the order book until someone trades against it or you cancel it. You choose the price, but you are not promised a fill.
- **A stop order** sleeps until price trades at your stop price, then wakes up. A stop-market order becomes a market order; a stop-limit order becomes a limit order. Stops are most often used to get out of a trade that has gone wrong.

| Order | What it does | What it promises | What it risks |
| --- | --- | --- | --- |
| Market | Trades now at the best available price | A fill | The price |
| Limit | Rests at your price or better | The price | No fill at all |
| Stop-market | Waits, then trades like a market order | Action once triggered | Slippage |

## A fill is two orders meeting

Every trade has two sides: one order was resting, and one arrived and took it. If you place a limit buy at 4,999.75 and a seller sends a market sell down to that price, your order fills. If nobody sells to you there, your order just sits.

Resting orders at the same price wait in a queue. On many futures contracts, including the equity-index ones, orders at one price are filled in the order they arrived. So price can trade at your limit and leave you unfilled, because the orders ahead of you soaked up every contract sold there. Traders call this being "touched but not filled."

## Slippage

Slippage is the difference between the price you expected and the price you got. Market orders and stop orders are exposed to it, because they take whatever is available.

Say you hold one ES contract with a stop to sell at 4,990.00. In a fast market, the resting bids at 4,990.00 and 4,989.75 disappear, and your order fills at 4,989.50. That is 2 ticks of slippage: 2 x $12.50 = $25 more loss than you planned, per contract.

Slippage tends to be larger in thin markets, around economic releases and when many stops sit at the same obvious price.

## Partial fills

A partial fill is when only part of your order trades.

- A limit order to buy 5 contracts might see only 3 traded at your price before the market moves away. You now hold 3, and the other 2 keep resting until they fill or you cancel them.
- A market order bigger than the size resting at the best price fills across several prices. Each piece is a partial fill, and your average price is worse than the price on the screen when you clicked.

## What the last price really is

The last price is the price of the most recent trade: one aggressive order meeting one resting order, possibly for a single contract.

It is not a promise of the price you can get next. To buy now you pay the offer, and to sell now you get the bid. Charts are drawn from last prices, which is why a chart can look calm while the order book underneath it is thin.

> [!check] You have a limit order to buy at 4,999.75. Price trades there once, then moves up. Were you filled?
> - [ ] Yes, a limit order always fills when price touches it
> - [ ] No, a limit order only fills when price trades through it
> - [x] Not necessarily, because orders queued ahead of yours may have taken every contract sold there
> Orders at the same price fill in turn, so a touch can fill the orders ahead of yours and leave yours waiting.
