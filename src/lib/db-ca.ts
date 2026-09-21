/**
 * The certificate authorities a database connection trusts. These and no others.
 *
 * Supabase's pooler presents a certificate signed by Supabase's own authority, which
 * the public authorities cannot vouch for. So its root certificate is pinned here, and
 * every connection (the app's, and each of the owner's `db:` commands) checks the
 * server's chain and host name against this list. There is NO fallback: if the check
 * fails, the connection is refused before a password is sent.
 *
 * It is a LIST so that a rotation can be staged: add the new certificate beside the old
 * one, release, and only then remove the old one. The runbook is "Database connections
 * fail after Supabase rotates its CA" in docs/SECURITY.md. `npm run db:check` and the
 * tests warn when a certificate has under 90 days left.
 *
 * The certificates are public. Each one came from the owner's own Supabase dashboard
 * (Database settings, SSL Configuration) and is kept unchanged in `certs/`; a test
 * checks that the text here is that file, and pins its fingerprint.
 *
 * This module imports nothing, so the scripts in `scripts/` can load it too.
 */

/** Supabase Root 2021 CA: `certs/prod-ca-2021.crt`, valid until 2031-04-26. */
const SUPABASE_ROOT_2021_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

export const PINNED_DATABASE_CAS: readonly string[] = [SUPABASE_ROOT_2021_CA];

/**
 * The `ssl` option for every `postgres()` call. Giving `ca` replaces Node's public
 * authorities, so only the pinned ones are trusted, and the driver still checks the
 * host name. `rejectUnauthorized` is spelled out so that nobody has to know the default.
 */
export function databaseTls(): { ca: string[]; rejectUnauthorized: true } {
  return { ca: [...PINNED_DATABASE_CAS], rejectUnauthorized: true };
}
