---
id: position-sizing
title: Position sizing
summary: Turning a stop distance and a risk amount into a number of contracts.
minutes: 5
---

## Risk per trade as a fixed amount

Before any trade, decide how much money you will lose if the stop is hit. That is your **risk per trade**, and it is a fixed dollar amount, decided in advance and the same from trade to trade.

Many traders set it as a small percentage of their account. The exact number is yours to decide. What matters is that it is fixed, written down and chosen before you look at a chart, so that one bad trade can never do outsized damage and every loss is comparable with every other.

## Stop distance in money

The stop's distance from your entry is measured in ticks. Multiply by the tick value and you have the risk on one contract:

**risk per contract = stop in ticks x tick value**

On MES, a stop 8 points away is 8 x 4 = 32 ticks. At $1.25 a tick, that is 32 x $1.25 = **$40 per contract**. You can check it another way: 8 points at $5 a point is also $40.

## The formula

**contracts = risk per trade / (stop in ticks x tick value)**

Always round **down**. Rounding up means risking more than you decided.

Take a fixed risk of $200 per trade:

| Market | Stop | Ticks | Risk per contract | Contracts for $200 |
| --- | --- | --- | --- | --- |
| MES | 8 points | 32 | $40 | 5 |
| MES | 12 points | 48 | $60 | 3 |
| MNQ | 20 points | 80 | $40 | 5 |
| ES | 8 points | 32 | $400 | 0 |

Look at the second row: $200 / $60 is 3.33, so the size is 3 contracts, and the real risk is $180. Look at the last row: one ES contract with an 8-point stop risks $400, twice the fixed amount. The answer is zero contracts. That trade does not fit the plan on ES; it would only fit on a smaller contract.

## Size follows the stop, never the other way round

The order of the steps matters:

1. Decide where the stop goes, based on where the trade idea is proven wrong.
2. Measure its distance in ticks.
3. Work out the size from the formula.

The mistake is to go the other way: pick a size first, then squeeze the stop closer until the dollar risk "fits". A stop placed to suit your account instead of the market tends to sit inside ordinary price movement, where it gets hit for no reason connected to your idea.

When the stop has to be wide, the size gets small. When the size would be zero, there is no trade.

> [!warning] The plan is not the ceiling
> Slippage and commissions come on top of your planned risk, and in a fast market a stop can fill well beyond its price. Your real loss on a trade can be larger than the number you planned.

> [!check] You risk $150 per trade and your MNQ stop is 30 points away. How many contracts?
> - [x] 2
> - [ ] 3
> - [ ] 5
> 30 points is 120 ticks, and 120 x $0.50 is $60 per contract, so $150 / $60 is 2.5, rounded down to 2.
