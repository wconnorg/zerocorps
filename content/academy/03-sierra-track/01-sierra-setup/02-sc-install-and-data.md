---
id: sc-install-and-data
title: Install and data
summary: Installing Sierra Chart and connecting a data feed.
minutes: 5
---

## Before you start

This lesson assumes you have passed the income test from the last lesson. Nothing here needs money until you choose a package, but a trial clock or a data subscription can start as soon as you set things up, so have your records from the Backtesting School finished first.

Sierra Chart changes over time, and the details of its data options change with it. This lesson describes the general workflow. **For every specific step, follow Sierra Chart's own current documentation**, not older videos or forum posts.

## Installing and first launch

Sierra Chart is a Windows program. The workflow:

1. Create an account on Sierra Chart's own website, and download the installer from there. Never use a copy from anywhere else.
2. Check the current system requirements on that site.
3. Run the installer and choose the folder it installs into.
4. Launch it and sign in with the account you created.

One thing about Sierra Chart is worth knowing from the start: it keeps its settings, chartbooks and downloaded data inside its installation folder. That makes it easy to back up, since copying the right files from that folder is a backup, and it means you should know where that folder is.

## Data feed setup

A new installation shows no live prices until you connect it to a data source. The general steps are:

1. **Choose a data service.** Sierra Chart can use its own data service, or connect through a broker or trading service. Which options are available, what each one includes and what each costs all change, so **check the current list in Sierra Chart's documentation before you choose**.
2. **Enter the details** the service needs in Sierra Chart's settings, as its documentation describes.
3. **Connect**, then open a chart for the contract you want.
4. **Check the symbol.** Futures symbols include the contract month, and the exact format depends on the data service. A chart that stays empty usually has a symbol in the wrong format.
5. **Let the history download.** The first chart of a new symbol can take a while to fill.

Once data is flowing, check the basics: the prices match another source you trust, the chart's session times are the ones you want, and the volume looks sensible.

Sierra Chart also has a **trade simulation mode**, which lets you practise placing orders on live data without sending anything to a real market. The Sierra DOM lesson covers it.

## The trial versus the paid packages

Sierra Chart has offered new accounts a trial period. **Check whether a trial is available now, how long it lasts and what it includes**, especially whether it covers real-time data, which usually still carries exchange fees.

If a trial is available, use it for what it is good at:

- Confirm that the install works on your computer
- Confirm that your data connection works and shows the markets you need
- Build the chartbook from the next lesson
- Decide which package, if any, includes the tools you have a tested use for

A trial is for finding problems while nothing is committed. It is not a reason to rush into a paid package.

> [!tip] Keep notes as you go
> Write down each setting you change and why. Sierra Chart has a lot of settings, and your notes will save you hours when something needs to be rebuilt.

> [!check] What is a sensible use of a trial period?
> - [ ] Starting a funded-account evaluation straight away
> - [ ] Collecting as much data as possible before it ends
> - [x] Checking that the install, the data connection and your charts work before paying for anything
> A trial is the time to find set-up problems before any money is committed.
