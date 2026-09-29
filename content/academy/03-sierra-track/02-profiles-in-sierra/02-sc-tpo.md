---
id: sc-tpo
title: TPO in Sierra
summary: Building a TPO profile in Sierra and reading the day's structure.
minutes: 5
---

## What you already know

The Foundations lesson on the TPO profile covered the ideas: letters for periods of time, the initial balance, single prints, poor highs and lows, and day shapes as descriptions. This lesson is about building a TPO profile in Sierra Chart and finding each of those ideas on the chart.

## Adding the study and choosing the period

In Sierra Chart, TPO profiles come from the **TPO Profile Chart** study. The general workflow:

1. Open a chart for the contract, and check its **session times** first. The traditional TPO profile is built on the regular session, and the initial balance is measured from the session's start, so the session setting decides where everything begins.
2. Add the TPO Profile Chart study from the chart's studies window.
3. Set the **period length** for each letter. Thirty minutes is traditional. Shorter periods give more letters and finer detail, but the traditional definitions, such as a one-hour initial balance of two periods, assume 30 minutes.
4. Set the **row size**, the number of ticks each price row covers, so the profile is readable for your contract.

The exact input names can change between versions, so keep Sierra Chart's documentation for the study open while you set it up.

## Letters, initial balance and single prints on the chart

Once the study is running, match what you see to what you learned.

| On the chart | What it describes |
| --- | --- |
| Letters stacked wide in the middle | Time accepted at those prices |
| The first two periods' range | The initial balance |
| Single prints inside the profile | A fast move through those prices |
| Single prints at the high or low | A tail, the sign of excess |
| Several periods ending at the same high | A poor high |
| Two bulges joined by single prints | A double distribution |

Depending on your version and settings, the study can draw the point of control, the value area and the initial balance for you, and highlight single prints. Look through the study's inputs for these options. If your version does not draw the initial balance, mark the high and low of the first two periods yourself; it takes seconds.

## Splitting and merging profiles

A profile covers one session by default, but a session is not always one auction.

- **Splitting** a profile at a chosen time turns one day into two profiles. On a double distribution day, this shows the value of each distribution on its own, instead of one wide profile that blurs them.
- **Merging** joins neighbouring profiles into one. When several days trade inside the same range, merging them shows the value of the whole balance.

Sierra Chart supports splitting and merging TPO profiles. The exact steps depend on your version, so follow the study's documentation.

Splitting and merging change the description, not the data. Use them to see the auction's structure more clearly, and write down when and why you do it if a setup depends on it.

> [!check] A day forms two separate bulges joined by single prints. Why might you split it into two profiles?
> - [ ] To make the day's volume larger
> - [ ] Because Sierra cannot display double distributions
> - [x] To see the value of each distribution on its own
> Splitting describes each balance separately, instead of one wide profile that blurs them.
