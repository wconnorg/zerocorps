# DNS for zerocorps.org

The zone is hosted at **Namecheap** (Domain List → Manage → Advanced DNS). Keep it
there. Moving the nameservers to a host such as Vercel would drop every record
below that is not re-created by hand, including email.

Everything in this file is public information that anyone can look up in DNS.
Nothing here is a secret.

## Website

| Type | Host | Value          | Purpose                    |
| ---- | ---- | -------------- | -------------------------- |
| A    | `@`  | `216.198.79.1` | Vercel (since 2026-09-19). |

There is **no `www` record**, by the owner's choice, so `www.zerocorps.org` does
not resolve. To add it later: in Vercel add `www.zerocorps.org` as a redirect to
`zerocorps.org`, then create a `CNAME` for host `www` with the value Vercel shows.

When the site moves to a self-hosted server, only the `A` record changes.

**There is no staging site and no `dev` record**, by the owner's decision on
2026-09-19. The only web hostname in this zone is `zerocorps.org` itself. Any other
web hostname that appears here is unexpected and should be investigated, because a
forgotten subdomain pointing at a host is a takeover risk. The same holds for mail:
`send` and `rsend` are CNAMEs into Resend's zone (see "Transactional email"), and
they are deleted the day Resend is dropped.

## Email (Proton Mail)

Still in place, under Namecheap's Mail Settings → Custom MX:

| Type | Host | Value                   | Priority |
| ---- | ---- | ----------------------- | -------- |
| MX   | `@`  | `mail.protonmail.ch`    | 10       |
| MX   | `@`  | `mailsec.protonmail.ch` | 20       |

**Removed by accident on 2026-09-19**, when the website records were replaced.
Restore these in Host Records before relying on Proton Mail again:

| Type  | Host                     | Value                                                                                            |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| TXT   | `@`                      | `v=spf1 include:_spf.protonmail.ch ~all`                                                         |
| TXT   | `@`                      | `protonmail-verification=024e5b8390846fd03d134c49f2ab1311b04f3e48`                               |
| TXT   | `_dmarc`                 | `v=DMARC1; p=quarantine`                                                                         |
| CNAME | `protonmail._domainkey`  | `protonmail.domainkey.dlf6c4clen6o5j5axenwdquyshaatvobsya2b44j3rd2qd34d3ooa.domains.proton.ch.`  |
| CNAME | `protonmail2._domainkey` | `protonmail2.domainkey.dlf6c4clen6o5j5axenwdquyshaatvobsya2b44j3rd2qd34d3ooa.domains.proton.ch.` |
| CNAME | `protonmail3._domainkey` | `protonmail3.domainkey.dlf6c4clen6o5j5axenwdquyshaatvobsya2b44j3rd2qd34d3ooa.domains.proton.ch.` |

These values were read from DNS before the change. Proton's own dashboard
(Settings → Domain names) lists the same records and is the source of truth if
they ever differ.

Lookups against a public resolver on 2026-09-19 confirmed the state above: the `A`
and both `MX` records answer, and all six records in this table are still missing.
Looked up again on 2026-09-20: both `MX` records still answer, there is still no
`TXT` on `@`, and **`_dmarc` now exists** (see "The single `_dmarc` record" below), so
that row of the table is history, not a record to restore.

### Checklist 1: restore the Proton records (owner, by hand). ON HOLD

**On hold.** The owner's Proton decision is delayed until about 2026-09-24. Nothing in
the release of milestone 2 waits for it.

**When it resumes, five records are added, not six. The `_dmarc` row is skipped.**
Proton's dashboard will suggest its own `_dmarc` record: do not add it. The zone keeps
ONE `_dmarc` record and never gains a second; two make DMARC fail for every sender.
If Proton's check is not satisfied by the record that exists, say so in chat: the fix
is an edit of that one record, never a second record.

Namecheap → Domain List → Manage → Advanced DNS → **Host Records** → Add New
Record. Add-only: do not edit or delete anything that is already there.

1. Open Proton's Settings → Domain names → `zerocorps.org` in another tab, and
   compare each value below with what Proton shows. If they differ, Proton wins;
   note the difference so this file can be corrected.
2. Add the records from the table above except `_dmarc`, in that order. For each
   one: **Type** as listed (`TXT Record` or `CNAME Record`), **Host** exactly as
   listed (Namecheap adds `.zerocorps.org` itself, so never type the domain),
   **Value** pasted whole with no surrounding quotes, **TTL** Automatic.
   - The two `TXT` records on host `@` are separate records. Only one of them
     starts with `v=spf1`, and it must stay the only one that does.
   - For the three `CNAME` records the trailing dot is optional; Namecheap adds it.
3. Press the green tick on each row. Nothing is saved until you do.
4. Say so in chat. Each record is then checked with a DNS lookup (this can take up
   to 30 minutes to show) and this section is rewritten as "in place".
5. In Proton, press Verify for the domain. SPF, DKIM and DMARC should all turn
   green.

Leave Mail Settings on **Custom MX**. Switching it to anything else removes the
`MX` records.

What is affected while they are missing: incoming mail still works, because the
MX records are intact. Mail **sent** from an `@zerocorps.org` address fails the
SPF and DKIM checks that receiving servers run, so it is likely to land in spam,
and Proton may flag the domain as not fully configured.

## Transactional email (milestone 2)

The site sends verification and password-reset emails through Resend, as
`"ZeroCorps" <no-reply@zerocorps.org>`. Resend's DNS records sit **next to** the
Proton records, never in place of them.

**In place since 2026-09-20.** The owner added them by hand, and each was confirmed the
same day by a lookup against a public resolver:

| Type  | Host                | Value                                        | Purpose                                                                 |
| ----- | ------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| TXT   | `resend._domainkey` | the `p=…` key from Resend's dashboard, below | DKIM: Resend signs the site's mail as `zerocorps.org`.                  |
| CNAME | `send`              | `send.forge.rmta.net`                        | Return path (SPF and bounces) for Resend's own sending engine, "Forge". |
| CNAME | `rsend`             | `rsend.forge.rmta.net`                       | Return path for Resend's older route through Amazon SES.                |
| TXT   | `_dmarc`            | `v=DMARC1; p=none;`                          | The zone's single DMARC record.                                         |

The DKIM key as it answers in DNS, kept here so the record can be restored without
the dashboard:

```text
p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC013c3TP+uPNewv6n7Nc6qRtX6E7XBtAXJqFUhwW1W8I+0yVb6+F5V4YiHp/CJc4HNWpCmmhZpA28PEk2lM8TvJiUhsg2GuYbGfX/U5seMJBtMWAR1OOSUrLvKLiWSJ76oEFjQ2hzGQo6wxa0FqJ8/0+XdKnhmRUkcY4f6bvksYwIDAQAB
```

This is Resend's newer record format ("Resend Forge"). It takes the place of the older
pair, an `MX` and an SPF `TXT` on `send`, which this zone never had. **It has no `MX`
of ours**, so nothing was added under Mail Settings, and nothing was added on `@`.

A CNAME hands a whole name to its target, so what receiving servers read under `send`
and `rsend` is whatever Resend publishes there. Followed on 2026-09-20 (these values
are Resend's and may change without notice, which is the point of the CNAME):

| Our name | SPF published at the target                                          | Bounce `MX` at the target                  |
| -------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `send`   | `v=spf1 ip4:52.3.252.119 ip4:44.222.39.36 ip4:199.249.231.0/24 ~all` | `10 feedback.forge.rmta.net`               |
| `rsend`  | `v=spf1 include:amazonses.com ~all`                                  | `10 feedback-smtp.us-east-1.amazonses.com` |

**How we know the targets are Resend's.** The values came from Resend's dashboard, which
is the source of truth. Resend's public page about Forge (read 2026-09-20) does not
list these hostnames, so they were checked another way: the address block in `send`'s
SPF, `199.249.231.0/24`, is registered at ARIN to Resend, and `rsend` publishes the
Amazon SES records Resend has always used. The last proof is Resend's dashboard showing
the domain as verified.

Rules that always hold for this zone:

- **Exactly one `TXT` record starting with `v=spf1` per hostname.** Two make SPF
  fail for every sender. Resend's SPF lives at its CNAME targets, so the one on `@`
  (Proton's, when it is restored) is not Resend's business. If any dashboard ever
  asks for an SPF change on `@`, merge its `include:` into the existing record
  instead of adding a second one.
- **Exactly one `_dmarc` record, ever.** It belongs to the zone, not to Proton and not
  to Resend. Every provider's dashboard suggests its own: skip it. The policy is
  tightened by editing that one record, and only once every sender passes.
- **Nothing else is ever added at `send` or `rsend`.** A CNAME cannot share its name
  with any other record, so an `MX` or `TXT` there would break both. **Both CNAMEs are
  deleted the day Resend is dropped**, so they never dangle (runbook "Stop using
  Resend" in [SECURITY.md](SECURITY.md)).

### The single `_dmarc` record (in place since 2026-09-20)

The owner added `v=DMARC1; p=none;` on 2026-09-20, together with Resend's records and
without waiting for the Proton decision. A lookup the same day returned exactly one
record at `_dmarc`. A DMARC record is the domain's policy, not a mail host's: one is
needed whichever way the Proton decision goes.

- **`p=none`, not the old `p=quarantine`, to begin with.** `p=none` cannot send
  anybody's mail to spam, so it is safe while Proton's SPF and DKIM records are still
  missing. Large mailbox providers treat a domain that has no DMARC record at all as
  a worse sign than one that has `p=none`, and a brand-new sending domain needs its
  sign-up codes to arrive.
- **No reporting address (`rua`) for now.** Reports need an inbox that works and
  usually an outside service to read them.
- **When Proton returns it will suggest its own `_dmarc` record. It is not added.** We
  keep ONE and never add a second.
- It is tightened to `p=quarantine` by editing that one record, with a
  before-and-after note here, once Resend passes and the Proton decision is made and
  carried out.

### Checklist 2: add the Resend records (owner, by hand). DONE 2026-09-20

It does not depend on checklist 1. Add-only: nothing that is already in the zone is
edited or deleted. Resend's dashboard is the source of truth for the values, because
the DKIM key is unique to the account.

Namecheap → Domain List → Manage → Advanced DNS → **Host Records** → Add New Record,
four times, TTL Automatic:

| Type           | Host (as typed into Namecheap) | Value                                 |
| -------------- | ------------------------------ | ------------------------------------- |
| `TXT Record`   | `resend._domainkey`            | the `p=…` key from Resend's dashboard |
| `CNAME Record` | `send`                         | `send.forge.rmta.net`                 |
| `CNAME Record` | `rsend`                        | `rsend.forge.rmta.net`                |
| `TXT Record`   | `_dmarc`                       | `v=DMARC1; p=none;`                   |

1. Resend shows full names such as `send.zerocorps.org`. Type only the part before
   `.zerocorps.org` into Namecheap's Host field.
2. **There is no `MX` in this format.** Mail Settings stays on Custom MX with Proton's
   two rows untouched, and nothing is added on host `@`.
3. **Add nothing else at `send` or `rsend`**, now or later: no `MX`, no `TXT`. A CNAME
   cannot share its name with any other record.
4. `_dmarc` is the zone's single DMARC record. Skip any other DMARC record that a
   dashboard suggests.
5. Press the green tick on each row, then say "records added" in chat. Each record is
   looked up, both CNAMEs are followed to confirm the target publishes an SPF record
   and a bounce `MX`, and the values are written into this file.
6. Press **Verify** in Resend and say what status it shows.

**Status:** steps 1 to 5 are done. On 2026-09-20 a public resolver returned all four
records with the values above, both CNAME targets published an SPF record and a bounce
`MX`, `_dmarc` answered with exactly one record, and the `A` record and Proton's two
`MX` records were unchanged. Step 6 is the owner's.
