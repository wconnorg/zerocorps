---
id: qt-install-and-workspace
title: Install and workspace
summary: Installing Quantower and building a workspace for backtesting.
minutes: 4
---

## What Quantower is

Quantower is a trading platform for Windows. It is the software you look at: charts, order panels and tools. It connects to brokers and data providers to get prices and accounts, which the next lesson covers. This lesson is only about getting it installed and arranging your screen for backtesting.

## Installing on Windows

The workflow is the same as for any Windows program:

1. Download the installer from the developer's own website. Do not use copies from forums, file-sharing sites or anyone offering a "cracked" version; trading software handles your accounts, so where it comes from matters.
2. Check the current system requirements on that site before you install.
3. Run the installer and follow its prompts.
4. Launch Quantower and follow the first-run prompts. Leave connections for the next lesson.

Keep the platform updated once it is installed. Updates fix problems, and they can also change where settings live, which is one reason these lessons describe what to do rather than exact menu paths.

## Free plan versus paid plans

Quantower is offered as a free version and as paid licences. **What each one includes changes over time**, and some features also depend on the connection you use. So before you rely on any particular tool for your backtesting, such as Market Replay or a volume analysis tool, check two things in your own set-up:

- What your current plan includes, on the developer's own plan comparison
- What your data connection supports, since some tools need data that not every connection provides

This course is designed around what you can do without paying. Where a lesson uses a tool that may belong to a paid plan, it also describes a manual way to do the same job.

## Creating a workspace

A **workspace** is the arrangement of panels on your screen: which panels are open, where they sit and how each one is set up. Quantower lets you keep several workspaces and switch between them, so you can have one for backtesting and, later, a different one for simulated trading.

A backtesting workspace should be simple:

- **One large Chart panel** for the market you are testing. This is where you will replay the market bar by bar.
- **One smaller Chart panel** on a higher timeframe, if your setup uses one for context.
- **Nothing else.** Order panels and the DOM Trader matter later, for sim trading. While backtesting they are only clutter.

## Saving the workspace

Once the layout is right, save it under a name that says what it is for, such as "Backtest - MES 5 min". Check whether your version saves workspace changes automatically. Either way, keep one named copy of the finished layout, so an accidental change is easy to undo.

> [!tip] One workspace per job
> Mixing backtesting and live panels in one layout makes mistakes easy. Separate workspaces keep the job in front of you obvious.

> [!check] What should you check before relying on a Quantower feature in your backtesting?
> - [ ] Nothing, because every feature is in every plan
> - [x] What your current plan and your data connection include
> - [ ] Only whether the feature appears in an online video
> Plans and connections change, so the only reliable answer is what your own version and connection include today.
