import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact, LegalList, LegalPage, LegalSection } from "@/components/site/legal-page";
import { env } from "@/env";

export const metadata: Metadata = {
  title: "Terms",
  // A draft should not be indexed. Remove this together with the `draft` flag below.
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" draft>
      <LegalSection heading="Education only. Not financial advice.">
        <p>
          ZeroCorps teaches how markets and trading work. Everything on this site, in the Academy
          and in our Discord is <strong className="text-fg">educational content only</strong>. None
          of it is financial, investment, tax or legal advice, and none of it is a recommendation to
          buy or sell anything.
        </p>
        <p>
          <strong className="text-fg">Trading involves substantial risk.</strong> Futures and other
          leveraged products can lose money quickly, and you can lose more than you put in. Past
          results, examples and simulations do not predict future results. You alone are responsible
          for your trading decisions and their outcome. If you need advice, speak to a licensed
          professional.
        </p>
      </LegalSection>

      <LegalSection heading="Who can use ZeroCorps">
        <p>
          You must be 18 or older, and using the site must be legal where you live. One person per
          account.
        </p>
      </LegalSection>

      <LegalSection heading="Your account">
        <LegalList>
          <li>
            Use an email address you control. It is how you sign in and how we reach you about
            security.
          </li>
          <li>
            Keep your password to yourself. We will never ask you for it, or for a code we sent you.
          </li>
          <li>Tell us if you think someone else has got into your account.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Fair use">
        <p>Please do not:</p>
        <LegalList>
          <li>
            attack, probe or overload the site, or try to get into accounts that are not yours;
          </li>
          <li>copy, resell or republish the lessons, which are for your own learning;</li>
          <li>use the site to harass anyone or to break the law.</li>
        </LegalList>
        <p>
          If you find a security problem, please tell us first. The contact for that is in{" "}
          <a href="/.well-known/security.txt" className="text-fg underline underline-offset-4">
            security.txt
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Discord">
        <p>
          Our Discord server is optional, and you never need a site account to be part of it.
          Linking your Discord account to your site account is also optional. Discord is a separate
          service with its own terms.
        </p>
      </LegalSection>

      <LegalSection heading="The service">
        <p>
          We work to keep ZeroCorps available and correct, but it is provided as it is, without
          guarantees. We may change, pause or remove parts of it. We may suspend an account that
          breaks these terms. You can stop using ZeroCorps and ask for your account to be deleted at
          any time.
        </p>
        <p>
          To the extent the law allows, ZeroCorps is not liable for trading losses or other losses
          that follow from using the site or acting on its content.
        </p>
      </LegalSection>

      <LegalSection heading="Your data">
        <p>
          The{" "}
          <Link href="/privacy" className="text-fg underline underline-offset-4">
            Privacy Policy
          </Link>{" "}
          says what we collect, why, and how to have it deleted.
        </p>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <p>
          If these terms change in a way that matters, we will say so on the site before the change
          takes effect.
        </p>
        <LegalContact contact={env.PRIVACY_CONTACT} />
      </LegalSection>
    </LegalPage>
  );
}
