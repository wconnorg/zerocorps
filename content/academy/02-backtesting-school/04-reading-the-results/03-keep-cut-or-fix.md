---
id: keep-cut-or-fix
title: Keep, cut or fix
summary: Deciding what the numbers say - keep the setup, cut it, or change one rule and test again.
minutes: 5
---

## Three possible decisions

Once a backtest has a large enough sample, around 100 trades as a first read, the numbers point to one of three decisions.

| Decision | When | What happens next |
| --- | --- | --- |
| Keep | Positive expectancy after costs, a drawdown you can live with, rules you followed | Forward test it on a simulated account |
| Cut | Expectancy near zero or negative across a large sample, or a drawdown you cannot accept | Archive the card and the log, with a note on why |
| Fix | One specific, identifiable problem in otherwise reasonable results | Change one rule, bump the version, test again |

Cutting a setup is not a failure. A setup that fails a careful backtest has cost you time, not money, which is exactly what backtesting is for. Keep the archived card and log; they stop you testing the same idea twice.

## What a fixable problem looks like

A fix needs a clear reason in the log, not a hunch. Some examples:

- Most of the losing trades entered in the first 15 minutes of the session.
- Price reached +1R on most trades but rarely +2R, and many trades ended at the time exit.
- Trades on days with a major economic release did much worse than the rest.

Each of these suggests a single, specific change: a no-trade window, a different target, a news filter.

## One change at a time

Change **one** rule, then test again. If you change the entry and the target together and the results improve, you cannot know which change helped, or whether one helped and the other hurt.

Test the new version on trades from a different stretch of history as well as the original one if you can. A change that only improves the trades you used to find it may be curve fitting, which you met in Foundations.

## Bump the version number

Every change makes a new version on the setup card, with the date and exactly what changed. The new version gets its own log, or its own clearly marked rows. Keep the old version's results for comparison. Now you can put the two side by side and see what the single change did.

## What good enough looks like, and when to stop tinkering

No setup is perfect, and chasing perfection is how curve fitting happens. A setup is good enough to move on to simulation when:

- Its expectancy is positive after commissions and slippage, across a large sample.
- It holds up reasonably across different market conditions, not just one.
- Its maximum drawdown is one you can size for.
- Its rules were clear enough that you followed them on nearly every trade.

Watch for the signs of tinkering too long: the version number keeps climbing, the rules keep getting longer, each new filter removes only a handful of trades, and the improvements get smaller each time. Some traders set a limit in advance, such as three fixes, after which the setup is either kept or cut.

> [!check] Your backtest shows most losses happen in the first 15 minutes of the session. What is the disciplined next step?
> - [x] Add one no-trade rule for that window, bump the version, and test it on a new sample
> - [ ] Add that rule, change the target too, and keep the same version
> - [ ] Remove those losing trades from the log and recalculate
> One change, a new version and a fresh sample tell you whether that single rule helped.
