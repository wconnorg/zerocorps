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
forgotten subdomain pointing at a host is a takeover risk.

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

### Checklist 1: restore the Proton records (owner, by hand)

Namecheap → Domain List → Manage → Advanced DNS → **Host Records** → Add New
Record. Add-only: do not edit or delete anything that is already there.

1. Open Proton's Settings → Domain names → `zerocorps.org` in another tab, and
   compare each value below with what Proton shows. If they differ, Proton wins;
   note the difference so this file can be corrected.
2. Add the six records from the table above, in that order. For each one: **Type**
   as listed (`TXT Record` or `CNAME Record`), **Host** exactly as listed (Namecheap
   adds `.zerocorps.org` itself, so never type the domain), **Value** pasted whole
   with no surrounding quotes, **TTL** Automatic.
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
`"ZeroCorps" <no-reply@zerocorps.org>`. Resend's DNS records are **added next to**
the Proton records, never in place of them. If the DMARC record above is restored
with `p=quarantine`, mail from the site must pass DKIM alignment for
`zerocorps.org`, or receiving servers will quarantine it.

Rules that always hold for this zone:

- **Exactly one `TXT` record starting with `v=spf1` per hostname.** Two make SPF
  fail for every sender. Resend's SPF belongs to the `send` hostname, so the one on
  `@` (Proton's) should not change. If Resend's dashboard ever asks for an SPF
  change on `@`, merge its `include:` into the existing record instead of adding a
  second one.
- **Exactly one `_dmarc` record**, and it is Proton's. Do not add the DMARC record
  Resend suggests, and do not tighten the policy until both senders pass.

### Checklist 2: add the Resend records (owner, by hand, after checklist 1)

The values come from Resend's dashboard, because the DKIM key is unique to the
account. None exist yet: lookups on 2026-09-19 found nothing at `send` or
`resend._domainkey`.

1. In Resend, add the domain `zerocorps.org`. Resend lists the records it wants.
   Expect three; the hosts below are what Resend normally uses, but **the dashboard
   is the source of truth**:

   | Type | Host (as typed into Namecheap) | Where in Namecheap        |
   | ---- | ------------------------------ | ------------------------- |
   | MX   | `send`                         | Mail Settings → Custom MX |
   | TXT  | `send` (starts with `v=spf1`)  | Host Records              |
   | TXT  | `resend._domainkey`            | Host Records              |

2. Resend shows full names such as `send.zerocorps.org`. Type only the part before
   `.zerocorps.org` into Namecheap's Host field.
3. The `MX` for `send` goes in the Custom MX list **next to** Proton's two records
   on `@`, with the priority Resend shows. Do not change Proton's rows.
4. Skip any DMARC record Resend suggests (see the rules above).
5. If Resend asks for anything on host `@`, stop and say so in chat before adding
   it.
6. Save each row, then say so in chat. Each record is checked with a DNS lookup,
   the values are written into this file (they are public once they are in DNS),
   and then you press Verify in Resend.
