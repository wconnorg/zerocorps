---
id: bar-by-bar-replay
title: Bar-by-bar replay
summary: Replaying the market one bar at a time without seeing the future.
minutes: 6
---

## Why replay at all

A finished chart shows you the answer. Looking back over a day that is already complete, the good trades jump out and the bad ones are easy to overlook. That is hindsight bias, and it makes almost any idea look better than it is.

Replaying the market bar by bar puts you back where you would have been at the time: you see only the bars that had finished, and you decide before you see the next one.

## Replay tools versus manual scrolling

There are two ways to do it.

- **A replay tool** plays historical data back as if it were live, bar by bar or at a chosen speed, and often lets you place simulated orders as it plays. Quantower has a Market Replay feature. **Whether your plan and connection include it, and what history it needs, is something to check in your own version.**
- **Manual scrolling** works on any chart, with no extra tools. You scroll back to a starting date and move forward one bar at a time, keeping the future out of sight yourself.

| | Replay tool | Manual scrolling |
| --- | --- | --- |
| Hides the future | Automatically | Only if you hide it |
| Placing trades | Often simulated orders | Written in your log by hand |
| Availability | Depends on your plan and data | Any chart |
| Pace | Can play at speed | One bar at a time |

Both give honest results if you follow the routine below. Manual scrolling is slower, but it is all you need.

## Hiding the right side of the chart

With manual scrolling, the danger is catching sight of bars you should not have seen yet. Some ways to prevent it:

- Scroll so the newest bar you are allowed to see sits at the right edge of the chart, with nothing beyond it.
- Cover the right side of the screen with another window, or even a sheet of paper.
- Close any higher-timeframe chart that would show how the day ended.
- Watch out for tools that use the whole day's data. A profile of the full session shows where value **ended up**, which you could not have known at 10:00 a.m. Use a profile that builds as the session goes, or one from the previous session only.

## Mark the trade before you advance the bar

Work through the same routine for every bar:

1. Look at the bar that just closed.
2. Check the card: are the conditions met? Is the trigger met? Is there a no-trade condition?
3. If there is a trade, write the entry, stop and target in the log **now**.
4. Move forward exactly one bar.
5. If you are in a trade, check whether the stop or the target was reached.

Sometimes a single bar reaches both your stop and your target. The bar alone cannot tell you which came first. Record it as a loss, or step through a smaller timeframe to see the real order. Always choosing the worse outcome keeps the backtest honest.

## Pace yourself

Go slowly at first. Speed comes with practice, and accuracy matters more than the number of days covered. Work in short sessions, because tired eyes start skipping bars and bending rules.

> [!check] During a manual replay, one 5-minute bar reaches both your stop and your target. How should you record it?
> - [ ] As a win, since the target was reached
> - [x] As a loss, unless a smaller timeframe shows which came first
> - [ ] Leave it out of the log
> A single bar does not show the order of its high and low, so the cautious choice is the losing outcome.
