---
id: forward-testing
title: Forward testing
summary: Trading the setup live on a simulated account - same rules, same log.
minutes: 5
---

## What forward testing is

**Forward testing** means trading your setup in real time, as the market happens, on a simulated account. You follow the same setup card, and you record every trade in the same log format as your backtest.

A backtest asks whether the rules held up on history. A forward test asks a different question: **can you actually carry out these rules, live, when you do not know what the next bar will do?**

## How sim differs from a backtest

- **Fills.** In a backtest you assumed you got the entry price. In sim, your orders meet real prices as they happen: market and stop orders slip, and in a fast market you may not get the price you wanted. Some simulators also fill limit orders more generously than a real market would, so treat any limit fill on a single touch with suspicion.
- **Waiting.** A backtest skips the dull hours. Live, you sit through all of them, and your setup may not appear for days. Boredom tempts you into trades the card never called.
- **Emotion.** In a backtest, the next bar is only a click away. Live, you wait for it with a position open, and hesitation, early exits and skipped entries all start to appear.
- **Speed.** Decisions that took a minute of calm thought in replay now have to be made in the few seconds after a bar closes.

## Why sim results are usually worse, and why that is fine

Put your sim numbers next to your backtest numbers and the sim numbers will usually be a little worse. Slippage, late entries, missed trades and the occasional broken rule all take something off.

That gap is not a problem. It is **information**. It measures the difference between your rules on paper and your rules in your hands. A small gap means you execute the setup much as you tested it. A large gap tells you where the work is: usually in execution and discipline, not in the setup itself.

To read the gap, compare in R, trade by trade, and use the exit reason and notes columns to see where the difference comes from.

## What counts as a sim trade

The sim record is only useful if it follows the same standards as the backtest.

**Counts:**

- Every trade the setup card calls during the hours you trade, on live data, under the version you are testing
- Trades the card called that you missed, logged separately as missed, with the result they would have had

**Does not count:**

- Trades on ideas that are not on the card
- Trades placed on delayed data
- Trades taken on replayed history, which belong in the backtest log instead

Treat the simulated account as if it were real: the same fixed risk per trade, a realistic balance, and a stop placed with every entry.

> [!tip] Keep the logs apart
> Keep the sim log separate from the backtest log. Mixing live and replayed trades makes both sets of numbers harder to read.

> [!check] Your sim results are a little worse than your backtest over a similar number of trades. What does that most likely show?
> - [ ] The backtest was wrong and the setup should be cut
> - [x] The normal cost of executing in real time, which you can now measure
> - [ ] The simulator is broken
> Slippage, hesitation and missed entries make sim a little worse than paper, and the size of the gap is useful information.
