---
id: volume-profile
title: Volume profile
summary: What the volume histogram is, and what POC, value area and low-volume nodes mean.
minutes: 6
---

## Volume at price, not at time

An ordinary volume bar sits under a candle and tells you how many contracts traded in that period of **time**. A volume profile turns that idea on its side. For every **price**, it adds up how many contracts traded there over a chosen period, and draws the total as a horizontal bar.

The result is a sideways histogram next to the price scale. Long bars mark prices where a lot of trading happened. Short bars mark prices the market passed through with little trade.

Building it is simple arithmetic. Every trade adds its size to the bar at its price. A session profile is the sum of every trade in the session. The more detailed the data behind it, the more accurate the profile: one built from every trade is exact, while one built from 1-minute bars has to estimate where inside each bar the volume traded.

## Point of control

The **point of control (POC)** is the price with the most volume in the profile's period. It is the price the auction found most agreeable, where the most business was done. If two prices tie, each platform breaks the tie with its own rule.

## Value area high and low

The **value area** is the range of prices around the POC that holds a set share of the period's volume, usually 70%. Its top is the **value area high (VAH)** and its bottom the **value area low (VAL)**.

The usual method starts at the POC and adds neighbouring prices, taking whichever side has more volume each step, until 70% of the volume is inside. Platforms differ in small details, so the VAH and VAL on two platforms can differ by a tick or two for the same day.

For example, suppose today's ES profile has its POC at 5,012.25 and its value area from 5,004.75 to 5,020.50. That means about 70% of today's contracts traded inside those 15.75 points, and more traded at 5,012.25 than at any other price.

## High-volume and low-volume nodes

The shape of the histogram is as informative as its peak.

- **High-volume nodes (HVNs)** are bulges: areas where the market spent time and traded a lot. In the language of the last chapter, these prices were accepted.
- **Low-volume nodes (LVNs)** are thin areas: prices the market moved through quickly, with little trade. These prices were passed over or rejected.

A profile with one big bulge describes a balanced period. A profile with two bulges separated by a thin area describes two areas of value with a fast move between them.

## Session profiles versus composite profiles

The period you choose changes the question the profile answers.

| Profile | Covers | Answers |
| --- | --- | --- |
| Session | One trading day or session | Where was value today? |
| Composite | Several sessions joined together | Where has value been over weeks or months? |

The session setting matters as well. A profile of only the regular session leaves out overnight trading, and one covering the full day includes it, so the two can show different POCs and value areas.

> [!note] Write your settings down
> Period, session and data source all change what a profile shows. When a setup uses a profile, its settings belong in the setup's rules.

> [!check] What does a low-volume node on a session profile describe?
> - [ ] The price where the most contracts traded
> - [ ] The edge of the value area
> - [x] Prices the market moved through quickly, with little trade
> Low-volume nodes are thin areas of the histogram, where the auction spent little time and traded little.
