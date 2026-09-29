---
id: qt-charts-and-panels
title: Charts and panels
summary: The panels you will use - chart, volume analysis, DOM - and where each setting lives.
minutes: 5
---

## The panels you will use

Everything in Quantower lives in a **panel**, and a workspace is a set of panels. For the Backtesting School you need three kinds:

- **Chart**, where you replay and study the market. This is where you will spend almost all your backtesting time.
- **Volume analysis tools**, such as profiles drawn on the chart, if your plan and connection include them.
- **DOM Trader**, the price ladder for placing and managing orders. You will not need it for bar-by-bar backtesting, but it becomes useful when you start trading your setup on a simulated account.

Each panel has its own settings, usually reached from the panel itself. Settings belong to the panel, so changing one chart does not change another unless you apply a template, which comes at the end of this lesson.

## Chart types and timeframes

A chart has two basic choices, and both belong in your setup's rules.

- **Chart type.** Candles are the standard, and they are what the Foundations lessons describe. Your version may offer other types as well; if your setup uses one, write down exactly which.
- **Timeframe.** The period each bar covers, such as 1, 5 or 15 minutes. As you saw in Foundations, timeframe is a choice, not a truth, and a result found on one timeframe says nothing about another.

There is a third setting that is easy to miss: the **session**. A chart can show the full day or only the regular session, and the choice changes the day's open, high and low, and any profile or VWAP built on the day.

## Profile and volume tools

Quantower includes volume analysis tools, but **which ones your plan includes, and what data they need, is something to check in your own version** before you build a setup around them. Some profile tools need detailed trade data that not every connection provides.

If a tool you want is not available to you, you still have plenty to work with. Setups built on levels you can mark by hand, such as the prior day's high and low, the overnight high and low or the opening range, can be backtested on a plain candle chart.

## Saving a template

A **template** saves a chart's settings so that every new chart can start the same: chart type, timeframe, session, colours and any indicators with their inputs. Check how your version saves and applies templates, then save one named after your setup and its version.

Why it matters:

- **Consistency.** If one chart quietly uses a different session or timeframe, you are testing a different setup without knowing it.
- **Comparable screenshots.** Every trade screenshot looks the same, which makes reviewing them far easier.
- **Less to remember.** Open a chart, apply the template, start working.

| Setting | Example | On the setup card? |
| --- | --- | --- |
| Chart type | Candles | Yes |
| Timeframe | 5 minutes | Yes |
| Session | Regular session only | Yes |
| Indicators | Session VWAP | Yes, with their inputs |
| Colours | Your choice | No |

> [!check] Why save a chart template for backtesting?
> - [x] So every chart uses the same type, timeframe, session and indicators your setup was written for
> - [ ] Because templates make the chart load faster
> - [ ] So the platform can take trades for you
> If a setting quietly changes between charts, you end up testing a different setup without knowing it.
