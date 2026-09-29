---
id: what-a-market-is
title: What a market is
summary: A market is an auction, and price is the result of that auction, not a number that goes up or down on its own.
minutes: 5
---

## A market is an auction

A market is a place where people who want to buy meet people who want to sell. In futures, that place is an exchange's electronic matching engine. Nobody sets the price. The price is simply where the most recent buyer and seller agreed to trade.

That sounds obvious, but it changes how you look at a chart. Price does not rise or fall on its own, like a thermometer. It moves because orders arrive, meet other orders and trade. Every tick on your screen is the record of a deal between two people.

## Bids, offers and the spread

At any moment there are two prices that matter more than any other:

- **The bid** is the highest price someone is currently willing to pay.
- **The offer** (also called the ask) is the lowest price someone is currently willing to sell at.
- **The spread** is the gap between them.

In a busy market such as the E-mini S&P 500 (ES), the bid and offer are usually one tick apart, for example 5,000.00 bid and 5,000.25 offered. If you want to buy right now, you pay the offer. If you want to sell right now, you sell at the bid.

## Why price moves

Orders behave in one of two ways.

- **Resting orders** wait at a price. They are the bids and offers stacked below and above the market, and together they are called **liquidity**.
- **Aggressive orders** want to trade now, at whatever price is available. They take liquidity.

Price moves when aggressive orders use up all the resting orders at a price. Suppose 40 contracts are offered at 5,000.25 and buyers send market orders for 60. The first 40 fill at 5,000.25, the offer there is gone, and the other 20 fill at the next offer, 5,000.50. The last traded price has moved up a tick, not because anyone decided it should, but because buyers were more urgent than sellers at that moment.

The same thing happens in reverse when sellers are the more aggressive side. Price can also move when resting orders are cancelled, because there is then less standing in the way.

## Liquidity matters more than the last price

The last price tells you where a trade happened. Liquidity tells you what will happen when *you* trade.

In a deep market, with plenty of resting orders at every price, you can buy or sell several contracts without moving the price. In a thin market, a single order can push through several prices, and you pay more than the screen showed. Liquidity changes through the day: it is usually deepest during the regular session and thinner overnight, around holidays and in the moments around major economic releases.

> [!tip] A useful habit
> Before you look at where price is, ask how easily you could get in and out there. A price you cannot trade at in size is only a number.

## The idea everything else builds on

Think of the market as a continuous auction. Price moves up to look for sellers and down to look for buyers. When it finds prices where both sides are happy to keep trading, it slows down and spends time there. When one side runs out, it moves on to find the other side.

Every later lesson, from value areas to volume profiles to the DOM, is a way of watching that auction: where it is trading, which prices it accepts, and which it refuses.

> [!check] What makes the last traded price move up a tick?
> - [ ] The exchange raises the price when demand is high
> - [x] Aggressive buyers use up all the resting offers at the current price
> - [ ] A seller places a new limit order above the market
> Once every resting offer at a price has been filled, the next buy can only trade at the next price up.
