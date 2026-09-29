---
id: what-an-evaluation-is
title: What an evaluation is
summary: What a prop-firm evaluation is - the rules, the drawdown types, and how the business works.
minutes: 5
---

## What an evaluation is

A proprietary trading firm, usually shortened to **prop firm**, sells **evaluations**. You pay a fee to trade an account under the firm's rules for a period. If you meet the rules, you pass, and you are offered a **funded account**, from which you can request payouts of a share of the profits, under a further set of rules.

In many programmes, the funded account is itself simulated, and payouts are a share of its simulated profits, paid by the firm under its terms. The details differ widely from firm to firm, and they change often. Everything below describes the common shape of the rules, not any particular firm's.

## Profit targets and daily loss limits

Most evaluations combine a goal with several limits.

- **The profit target** is the amount you must make to pass, for example a set dollar figure on an account of a stated size.
- **The daily loss limit** is the most you may lose in one day. Break it and, depending on the firm, you are either stopped for the day or you fail the evaluation.
- **The maximum drawdown** is the lowest your balance may ever fall. Touch it and the evaluation is over. It comes in different types, described below.

There are often other rules too: a minimum number of trading days, a maximum number of contracts, a **consistency rule** that limits how much of your profit can come from a single day, restrictions around news releases, and a time by which positions must be closed. Every one of them is a way to fail, so read all of them before you pay.

## Trailing versus static drawdown

This is the rule that catches the most people, so it is worth working through.

Take an account that starts at $50,000 with a $2,000 drawdown limit.

- **Static drawdown.** The floor is set once, at $48,000, and never moves.
- **Trailing drawdown.** The floor follows your highest balance upward, staying $2,000 below it. If your balance reaches $52,500, the floor rises to $50,500. A fall back to $50,500 now ends the evaluation, even though you are still $500 above where you started.

Trailing drawdowns also differ in **what they follow**:

| Drawdown type | The floor moves with | Example |
| --- | --- | --- |
| Static | Nothing; it never moves | Stays at $48,000 |
| Trailing, end of day | The highest balance at the close of a day | A $51,000 close moves it to $49,000 |
| Trailing, intraday | The highest balance at any moment, open profit included | Open profit taking the balance to $51,200 moves it to $49,200, even if the trade closes lower |

With an intraday trailing drawdown, a trade that goes well and then comes back can raise your floor without adding anything to your balance. Some firms stop the trailing once the floor reaches a set level; check exactly how yours works.

## How the firm makes money

A firm earns from **fees**: evaluation fees, reset fees, activation fees and sometimes monthly charges. Everyone who takes part pays fees. Payouts go only to those who pass and then meet the payout rules.

That means fees are central to the business model. It is not a secret or a scandal, it is simply how the product works, and it is the most important thing to understand before you buy one. The next lesson looks at what those costs add up to.

> [!check] An account starts at $50,000 with a $2,000 trailing drawdown that follows the highest balance. The balance reaches $53,000. Where is the floor now?
> - [ ] $48,000
> - [x] $51,000
> - [ ] $53,000
> The floor trails the highest balance by $2,000, so $53,000 minus $2,000 is $51,000.
