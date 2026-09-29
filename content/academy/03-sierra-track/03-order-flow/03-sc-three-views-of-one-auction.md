---
id: sc-three-views-of-one-auction
title: Three views of one auction
summary: How the profile, VWAP and the DOM describe the same auction from three angles.
minutes: 5
---

## Each tool answers a different question

By now you have three families of tools in Sierra Chart. It is tempting to treat them as three separate opinions. It is more useful to see them as three angles on one auction, each answering its own question.

| Tool | The question it answers | Timescale |
| --- | --- | --- |
| Volume by Price and TPO | Where has the market accepted value, and where has it refused to trade? | A session, or many |
| VWAP | What is the average price paid since the anchor, and which side of it is price on? | Since the anchor |
| Trading DOM and Numbers Bars | What is happening at these prices right now? | Seconds to minutes |

The profile is the map. VWAP is the average of the journey so far. The DOM and footprint are the view from the ground.

## Describing one session with all three

Here is an invented MES session, described with all three tools. Read it as practice in description, not as a trade.

**Before the regular session opens.** The previous day's value area ran from 5,000 to 5,020, with its point of control at 5,011. The market opens at 5,015, inside that value.

**The first hour.** Price rotates between 5,008 and 5,021. The developing profile builds around 5,012 to 5,016. Session VWAP is nearly flat near 5,013, and price crosses it in both directions. *Description: balance, inside the previous day's value, with neither side ahead on average.*

**Late morning.** Price moves up through 5,021, the previous day's value area high. On the DOM, offers at 5,021 and 5,022 fill and are replaced several times before they finally give way. Numbers Bars show positive delta in the bars moving up, with several buy imbalances. *Description: initiative buying above the previous day's value.*

**The next hour.** Price spends the hour between 5,024 and 5,030, with volume building there and several TPO periods at those prices. VWAP turns upward, and price stays above it. *Description: the higher prices are being accepted, and buyers since the open are ahead on average.*

Put together: *the session opened in balance inside yesterday's value, then initiative buying moved price above that value, where it was accepted; VWAP rose, and most trading since late morning has been above it.*

Every sentence there is about what happened. None of it says what happens next.

## No signals, description only

None of these tools says buy or sell. Each one describes the auction from its own angle. It is easy to believe that when all three agree, the agreement must mean something about the future. It does not, on its own. Agreeing descriptions are still descriptions.

The way to find out whether a description is useful is the process from the Backtesting School: turn it into written rules on a setup card, test those rules bar by bar over a large sample, and prove them in simulation. Only the records can tell you whether a set of rules had an edge on the data you tested.

> [!tip] Practise the description
> At the end of each session, write three sentences: one from the profile, one from VWAP, one from the DOM or footprint. It builds the habit of seeing the auction as a whole.

> [!check] Which question does VWAP answer in this lesson's framework?
> - [x] What the average price paid since the anchor is, and where price sits against it
> - [ ] What is happening at one price in the last few seconds
> - [ ] Where the market will go next
> VWAP is an average of traded prices weighted by volume, so it describes the average paid, not what is happening right now or what comes next.
