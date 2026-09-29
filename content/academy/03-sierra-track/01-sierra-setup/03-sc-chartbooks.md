---
id: sc-chartbooks
title: Chartbooks and studies
summary: Chartbooks, studies and how Sierra organises everything.
minutes: 5
---

## How Sierra organises things

Sierra Chart can feel overwhelming at first because almost everything is configurable. It becomes much easier once you see that it is organised in layers, each holding its own settings.

| Layer | What it holds | Example |
| --- | --- | --- |
| Global settings | Settings for the whole program | The data service |
| Chartbook | A group of charts and windows, and their layout | "MES backtest" |
| Chart | One symbol, its bar settings and session times | MES, 5-minute bars, regular session |
| Study | One calculation drawn on a chart | Volume by Price |

When something changes unexpectedly, ask which layer it lives in. That one question solves a surprising number of problems.

## Chartbook versus chart

A **chart** is one window showing one symbol, with its own settings: the bar period, the session times, how it looks and which studies are on it.

A **chartbook** is a file that holds a group of charts, and other windows such as the Trading DOM, together with their layout. Open the chartbook and every chart in it comes back exactly as you left it. If you have used Quantower, a chartbook plays a similar role to a workspace.

You can have more than one chartbook, and more than one open at once. A sensible start is one chartbook per job: one for study and backtesting, and later one for simulated trading.

## The study system

In Sierra Chart, almost everything you add to a chart is a **study**: a moving average, VWAP, Volume by Price, the TPO Profile Chart, Numbers Bars. You add studies to a chart through its studies window.

Every study has two kinds of settings:

- **Inputs**, which control the calculation: the period, the price it uses, the session it covers.
- **Display settings**, which control how the result is drawn: the lines, their colours and styles.

The chart's own settings sit underneath its studies. **Session times** are the important one: they are part of the chart's settings, and they decide which trades go into a daily profile or a session VWAP.

Sierra Chart can also save a set of studies so you can apply the same set to another chart. Check its documentation for the current way to do this; it is the Sierra equivalent of the chart template from the Backtesting School, and it serves the same purpose. Every chart for a setup should start from the same studies with the same inputs.

## Saving, restoring and global settings

- **Save the chartbook** after you change it, and check whether your installation also saves automatically.
- **Back up your chartbooks.** They are files in the installation folder, so copying them somewhere safe is a backup. Take one before any big change.
- **Restore** by opening a saved copy of the chartbook.
- **Global settings** affect the whole program, not one chart. Change them carefully and write down what you changed, because their effects show up everywhere.

A simple test tells you which layer a change lives in. If it appears on every chart, it was global. If it appears on one chart, it was that chart's setting or one of its studies.

> [!check] You want the same four charts and their layout every morning. What do you save?
> - [x] A chartbook
> - [ ] A single study
> - [ ] The global settings
> A chartbook holds a group of charts and their layout, so opening it restores all of them.
