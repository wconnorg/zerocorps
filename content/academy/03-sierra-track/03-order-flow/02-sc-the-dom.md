---
id: sc-the-dom
title: The Sierra DOM
summary: The Sierra DOM - reading the ladder, the volume columns, and the trade window.
minutes: 5
---

## The Trading DOM

The Foundations lesson on the DOM covered the ideas: a ladder of prices, resting orders on each side, and the difference between what is showing and what has traded. In Sierra Chart, the ladder is the **Trading DOM**, a chart window you can keep in a chartbook alongside your other charts.

Sierra's DOM is highly configurable. You choose which columns it shows, in what order and how they look. That is powerful, and it also means two traders' DOMs can look nothing alike.

## The ladder and its columns

The price column runs down the middle, one row per tick. Around it, you choose from columns of a few kinds:

| Column type | What it shows | Can it change without a trade? |
| --- | --- | --- |
| Resting bid and ask size | Limit orders waiting at each price now | Yes |
| Recent volume | What traded at each price in the last few moments | No |
| Volume at price | Everything traded at each price this session | No |
| Your orders and position | Your working orders, and your open position | Only when you act or an order fills |

The exact names of the columns, and the options for each, are in Sierra Chart's documentation. Start with as few columns as you need to read the market, and add others only when you know what question each one answers.

## Recent volume versus resting size

This is the distinction from Foundations, now side by side on one screen.

- **Resting size** is what people are showing: orders that might trade, and can be cancelled at any moment.
- **Recent volume** is what has just traded at each price, split into trades at the bid and trades at the ask. Depending on the settings, it clears after a pause in trading or when price moves away.

Reading them together is where the DOM becomes informative. Say 300 contracts are showing on the offer at 5,010.25. If recent ask volume at that price climbs to 280 while the resting size stays near 300, orders there are being added as they fill. If the resting size shrinks quickly while very little trades, orders are being cancelled.

Both are descriptions of what is happening now. Neither tells you what happens next.

## The trade window and the simulated account

Orders can be placed straight from the DOM, and Sierra Chart's **Trade Window** holds the order settings: the quantity, and a stop and target that can be attached to an entry, so both are placed automatically when the entry fills. Attaching them means your stop exists from the first moment of the trade, which is exactly what your setup card requires.

Sierra Chart's **trade simulation mode** lets you practise all of this on live data without sending anything to a real market. Two things to know:

- **Check the mode every time.** A chart or DOM can be in simulation mode or not. Before any practice order, confirm that simulation mode is on.
- **Simulated fills can be kind.** How limit orders fill in simulation depends on settings. A simulator that fills your limit order as soon as price touches it is more generous than a real queue, so read your sim results with that in mind.

> [!warning] Sim and real can look the same
> The DOM looks identical whether an order will go to a simulated account or a real one. Make checking the mode part of your pre-session checklist, and check again before the first order.

> [!check] Before you place an order on the Sierra DOM for practice, what must you confirm?
> - [ ] That the recent volume column is visible
> - [ ] That the ladder is centred on the last price
> - [x] That trade simulation mode is on
> An order placed outside simulation mode can reach a real account, so the mode is the first thing to check.
