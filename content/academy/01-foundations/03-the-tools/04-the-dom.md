---
id: the-dom
title: The DOM
summary: The depth of market ladder - resting orders, traded volume, and what you can and cannot see.
minutes: 5
---

## The bid and ask ladder

**DOM** stands for depth of market. It is a vertical ladder of prices, one row per tick, showing the resting limit orders around the current price.

- On one side of the price column are the **bids**: resting orders to buy, and how many contracts sit at each price.
- On the other side are the **asks** (offers): resting orders to sell.
- The best bid and best ask meet in the middle, usually one tick apart in a busy market.

Most DOMs add more columns: volume traded at each price, your own working orders, and your position and profit or loss. Depending on your data feed, you may see only a set number of price levels on each side.

## Resting size versus traded volume

Two numbers on the DOM look alike and mean very different things.

- **Resting size** is how many contracts are waiting as limit orders at a price right now. It is what *might* trade.
- **Traded volume** is how many contracts actually changed hands at a price. It is what *did* trade.

A price can show 300 contracts resting and only 20 traded there. Another can show 50 resting that keeps refilling, while 800 contracts trade through it. Some orders show only part of their true size and refill as they fill, so the resting number is not always the whole story.

## Orders get pulled and placed

Resting orders can be cancelled at any moment, often in a fraction of a second. A large order sitting a few ticks away can vanish as price approaches it, and new size can appear out of nowhere.

So the ladder is **not a promise**. It is a snapshot of what people are showing at this instant. Cancelling orders for ordinary reasons is routine. Placing orders you intend to cancel before they fill, in order to mislead other traders, is known as spoofing and is illegal.

## The DOM shows intent, the tape shows action

The **tape**, also called time and sales, is the running list of completed trades: each with its price, its size and whether it traded at the bid or the ask.

| | DOM | Time and sales |
| --- | --- | --- |
| Shows | Resting limit orders | Completed trades |
| Tense | What might happen | What did happen |
| Can change without a trade | Yes | No |

Reading the two together tells you more than either alone. Say 200 contracts are offered at 5,010.25. If the tape shows buyers trading 250 contracts there, the offer is used up and price ticks higher. If the tape shows buyers trading 250 and the offer is still showing 200, sellers kept adding to it as it filled.

## What you cannot see

The DOM leaves a lot out:

- **Who** is behind any order
- **Stop orders**, which are not in the book until they are triggered
- The hidden part of orders that show only some of their size
- Orders beyond the levels your feed displays

In a fast market the ladder also changes faster than you can read it.

> [!warning] Size is not a wall
> A big number on the ladder describes what someone is showing now. It says nothing certain about what will be there when price arrives.

> [!check] The DOM shows 400 contracts offered two ticks above the market. What does that tell you?
> - [ ] Price cannot rise past that level
> - [ ] 400 contracts have traded at that price
> - [x] Sellers are showing 400 contracts there right now, and they can cancel before price arrives
> Resting size is intent, not action, and orders can be pulled at any time.
