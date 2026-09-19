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

What is affected while they are missing: incoming mail still works, because the
MX records are intact. Mail **sent** from an `@zerocorps.org` address fails the
SPF and DKIM checks that receiving servers run, so it is likely to land in spam,
and Proton may flag the domain as not fully configured.

## Transactional email (milestone 2)

The site sends verification and password-reset emails through Resend. Resend's
DNS records are **added next to** the Proton records, never in place of them. If
the DMARC record above is restored with `p=quarantine`, mail from the site must
pass DKIM alignment for `zerocorps.org`, or receiving servers will quarantine it.
