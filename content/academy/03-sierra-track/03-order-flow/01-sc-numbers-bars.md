---
id: sc-numbers-bars
title: Numbers Bars
summary: The footprint chart in Sierra - what the cells show and how the study is built.
minutes: 6
---

## What Numbers Bars are

A candle tells you four prices. A **footprint chart** opens the candle up and shows what traded at every price inside it. In Sierra Chart, the footprint is the **Numbers Bars** study.

Each bar becomes a column of cells, one per price (or per group of ticks). Each cell shows numbers about the trading at that price during that bar.

## Bid volume and ask volume at each price

Every trade has a buyer and a seller. What differs is who was **aggressive**, the one who crossed the spread to trade now.

- **Ask volume** is contracts traded at the offer: an aggressive buyer lifted a resting sell order.
- **Bid volume** is contracts traded at the bid: an aggressive seller hit a resting buy order.

A cell showing **45 x 120** at 5,002.25 means that during that bar, 45 contracts traded at the bid and 120 at the ask at that price. The usual convention puts bid volume on the left and ask volume on the right; check your own settings.

## Delta

**Delta** is ask volume minus bid volume. You can measure it per cell, per bar or added up through the session, which is called **cumulative delta**.

If a bar has 1,850 contracts at the ask and 1,420 at the bid, its delta is 1,850 - 1,420 = **+430**. More contracts traded through aggressive buying than aggressive selling.

Positive delta does not mean price went up. Resting sellers can absorb aggressive buying all bar long, so a bar can have positive delta and still close lower. Delta describes **who was aggressive**, not who got the better of the exchange.

## Imbalances as a definition

An **imbalance** is a cell where one side traded much more than the other, by a ratio you choose. The usual method compares **diagonally**:

- A **buy imbalance** compares ask volume at one price with bid volume **one tick below** it.
- A **sell imbalance** compares bid volume at one price with ask volume **one tick above** it.

The comparison is diagonal because the bid and the ask sit one tick apart at any moment. For example, with a ratio of 3 to 1: ask volume of 90 at 5,002.50 against bid volume of 25 at 5,002.25 is a ratio of 3.6, so it counts as a buy imbalance.

An imbalance is a **definition you set**, not a signal. Change the ratio or the minimum volume and different cells qualify. Numbers Bars can colour cells that meet an imbalance condition; check the study's inputs for the ratio and the comparison it uses, because diagonal and horizontal comparisons give different results.

## What the colours mean

Colours in Numbers Bars are settings, not signals. Common choices include:

- Shading cells by how much volume traded, so busy prices stand out
- Colouring cells by delta, one colour for more ask volume and another for more bid volume
- Highlighting imbalance cells, and outlining the price with the most volume in each bar

Because every trader chooses their own, two footprints of the same data can look completely different. Write down what each colour means in your set-up, and keep it the same across every chart.

| Term | Definition |
| --- | --- |
| Ask volume | Contracts bought by aggressive buyers at that price |
| Bid volume | Contracts sold by aggressive sellers at that price |
| Delta | Ask volume minus bid volume |
| Imbalance | One side's volume at least a set ratio above its diagonal neighbour |

> [!check] A bar shows 2,100 contracts at the ask and 2,600 at the bid, yet it closed higher than it opened. What does that show?
> - [ ] The data is wrong, because negative delta means price must fall
> - [x] Delta describes who was aggressive, not where price ends up
> - [ ] The bar had positive delta
> Resting buyers can absorb aggressive selling, so a bar can close higher with negative delta.
