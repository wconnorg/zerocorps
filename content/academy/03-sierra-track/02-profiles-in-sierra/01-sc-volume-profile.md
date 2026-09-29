---
id: sc-volume-profile
title: Volume profile in Sierra
summary: Volume profile studies in Sierra - session, composite, and the settings that matter.
minutes: 5
---

## What you already know

The Foundations lesson on the volume profile covered what it is: a sideways histogram of volume at each price, with a point of control, a value area and high- and low-volume nodes. This lesson is about building one in Sierra Chart and knowing which settings change what you see.

## Adding the study

In Sierra Chart, the volume profile is the **Volume by Price** study. The general workflow:

1. Open the chart you want, with the right symbol and session times.
2. Open the chart's studies window and add Volume by Price.
3. Open the study's settings and set the period it covers, then how it is displayed.

The input names and their exact options can change between versions, so use Sierra Chart's documentation for the study alongside this lesson. The ideas below stay the same whatever the labels say.

## Session versus composite

The most important input is the **period** each profile covers.

- **One profile per day or session** gives you session profiles: a new histogram for each day, showing where value built that day.
- **One profile over several days**, or over a range of time you choose, gives you a composite profile: the larger areas of value built over weeks or months.

Many traders keep both: session profiles on an intraday chart, and a composite on a separate chart covering a longer stretch. Keeping them on separate charts stops the two from crowding each other.

Remember that session profiles depend on the chart's **session times**. A chart set to the regular session builds profiles from regular-session trading only; a chart set to the full day includes the overnight session. The two can show different points of control for the same date.

## The settings that change what you see

| Setting | What it changes |
| --- | --- |
| Period | One profile per session, or one covering many days |
| Session times, in the chart's settings | Whether overnight trading is included |
| Ticks per row | Fine detail versus a smoother histogram |
| Value area percentage | How wide the value area is, commonly 70% |
| Lines shown | Whether the POC and value area lines are drawn and extended to the right |

**Ticks per row** deserves a closer look. At one tick per row, every price has its own bar, which is the most detail but can look ragged. Grouping several ticks into each row smooths the histogram, and it can shift the point of control and the value area edges slightly.

The **data behind the chart** matters too. A profile can only be as detailed as the data it is built from: one built from every trade is more accurate than one estimated from 1-minute records. Check what your data service provides for the history you are studying.

> [!note] Settings are part of the setup
> Two traders looking at the same day can see different POCs and value areas simply because their settings differ. If a setup uses a profile, its settings belong on the setup card.

> [!check] Your daily profile's POC differs from a friend's by a few ticks for the same day. What is the likeliest reason?
> - [ ] One of the two charts is showing the wrong market
> - [x] Different settings, such as session times or ticks per row
> - [ ] Volume profiles are random
> Session times, row size and the data behind the chart all change where the histogram peaks.
