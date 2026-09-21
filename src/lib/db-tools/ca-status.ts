import { X509Certificate } from "node:crypto";

/**
 * Says how long each pinned database certificate (src/lib/db-ca.ts) has left.
 *
 * A pinned connection fails closed, so the day a pinned certificate expires, or Supabase
 * moves to a new one, sign-in stops working until the list is updated. This gives the
 * warning well before that day: `npm run db:check` and the tests print it when a
 * certificate has under 90 days left, and fail only once one has expired.
 *
 * This module imports nothing from the app, so the scripts in `scripts/` can load it.
 */

export const WARN_BELOW_DAYS = 90;

export type PinnedCaStatus = {
  name: string;
  fingerprint256: string;
  validTo: Date;
  daysLeft: number;
  state: "ok" | "expiring" | "expired";
};

const DAY = 24 * 60 * 60 * 1000;

/** Throws if an entry is not a certificate, or is not a certificate authority. */
export function inspectPinnedCas(pems: readonly string[], now: Date): PinnedCaStatus[] {
  if (pems.length === 0) throw new Error("No database certificate is pinned.");
  return pems.map((pem, index) => {
    const certificate = new X509Certificate(pem);
    if (!certificate.ca) {
      throw new Error(`Pinned certificate ${index + 1} is not a certificate authority.`);
    }
    const validTo = new Date(certificate.validTo);
    const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / DAY);
    const name = /^CN=(.+)$/m.exec(certificate.subject)?.[1] ?? `certificate ${index + 1}`;
    return {
      name,
      fingerprint256: certificate.fingerprint256,
      validTo,
      daysLeft,
      state: daysLeft < 0 ? "expired" : daysLeft < WARN_BELOW_DAYS ? "expiring" : "ok",
    };
  });
}
