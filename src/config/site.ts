/**
 * Brand strings used across the site. All of this is placeholder copy for the
 * owner to edit; nothing here is read by business logic.
 */
export const site = {
  name: "ZeroCorps",
  academy: "ZeroCorps Academy",
  // The search-result and link-preview description. The landing page's hero no longer
  // shows it (owner, 2026-09-21): the hero is the name and the quotation.
  description: "We build trading solutions to empower the industry.",
  disclaimer:
    "Educational content only. Nothing on this site is financial advice. Trading involves risk, including the loss of your capital.",
  // The permanent invite to the ZeroCorps Discord (owner, 2026-10-04), behind the icon in
  // every header and "Join the Discord" on /sign-up. Public by nature: it is on every page.
  // DISCORD_INVITE_URL, when set on a server, takes its place there.
  discordInvite: "https://discord.gg/6cpMcFEPEt",
  // The owner's YouTube channel and X account (asked for on 2026-10-05), beside Discord in
  // every header. Empty until the owner gives the addresses: until then each icon shows as
  // "coming soon" and is not a link; filling one in makes it a link.
  youtube: "",
  x: "",
} as const;
