import type { Metadata } from "next";
import { LegalContact, LegalList, LegalPage, LegalSection } from "@/components/site/legal-page";
import { env } from "@/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  // A draft should not be indexed. Remove this together with the `draft` flag below.
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" draft>
      <LegalSection heading="The short version">
        <p>
          ZeroCorps is a trading education site. We collect as little about you as we can, we never
          sell it, and we do not run advertising or tracking scripts. This page says exactly what we
          hold, why, and how to have it deleted.
        </p>
      </LegalSection>

      <LegalSection heading="What we collect">
        <p>When you create an account:</p>
        <LegalList>
          <li>
            <strong className="text-fg">Your email address.</strong> It is how you sign in, and
            where we send security emails: your sign-up code, password resets, and alerts about new
            sign-ins.
          </li>
          <li>
            <strong className="text-fg">Your password, as a one-way hash.</strong> We never store
            the password itself and cannot read it.
          </li>
          <li>
            <strong className="text-fg">The date you agreed to the Terms</strong>, and which
            version.
          </li>
        </LegalList>
        <p>As more of the site opens, and only if you use those parts:</p>
        <LegalList>
          <li>A username, an optional display name and an optional profile picture.</li>
          <li>
            A phone number, only if you choose text-message codes as your second sign-in step. It is
            used only to text you security codes.
          </li>
          <li>
            Your Discord ID and Discord username, only if you choose to link your Discord account.
            We ask Discord for nothing else and store no Discord access tokens.
          </li>
          <li>Which lessons you have completed and when, and the rank that follows from them.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Security records">
        <p>
          To protect accounts we keep a record of security events: sign-ins, failed sign-ins,
          password resets, and sign-ins from a browser we have not seen before. These records do not
          contain your full IP address. We store a scrambled (keyed-hash) form of it that cannot be
          read back, a coarse network prefix, and the family of your browser, such as &ldquo;Chrome
          on Windows&rdquo;. They are deleted after 90 days.
        </p>
      </LegalSection>

      <LegalSection heading="Cookies">
        <p>We use only the cookies the site needs to work:</p>
        <LegalList>
          <li>a sign-in cookie, so you stay signed in (up to 30 days);</li>
          <li>a short-lived cookie while you are confirming your email address (15 minutes);</li>
          <li>
            a cookie that lets us recognise a browser you have signed in from, so we can warn you
            about a new one;
          </li>
          <li>your choice of light or dark theme.</li>
        </LegalList>
        <p>There are no advertising cookies, no analytics cookies and no third-party trackers.</p>
      </LegalSection>

      <LegalSection heading="How we use it">
        <LegalList>
          <li>To run your account and keep it secure.</li>
          <li>
            To show you your own progress and rank, and to give you the matching role in our Discord
            if you linked it.
          </li>
          <li>
            <strong className="text-fg">For our own community analytics.</strong> We look at
            usernames, ranks and lesson progress to understand how members are getting on. This
            stays internal and is never published or sold.
          </li>
          <li>
            <strong className="text-fg">To get in touch on Discord.</strong> We may contact members
            on Discord about opportunities connected to ZeroCorps, based on their progress. You can
            ask us not to.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Who handles it for us">
        <p>
          We use a small number of companies to run the site: a hosting provider, a database
          provider and an email delivery provider, and later a text-message verification provider if
          you choose that option. They process data only to provide their service to us. We do not
          sell or rent your data to anyone.
        </p>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <LegalList>
          <li>Your account data: until you ask us to delete your account.</li>
          <li>Security records: 90 days.</li>
          <li>A sign-up you never finished: 15 minutes, and nothing is created from it.</li>
          <li>Encrypted backups: until they are replaced by newer ones.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Deleting your data">
        <p>
          You can ask us to delete your account and everything connected to it, or to send you a
          copy of what we hold. A delete button in your account settings is on the way; until then,
          contact us and we will do it for you.
        </p>
        <LegalContact contact={env.PRIVACY_CONTACT} />
      </LegalSection>

      <LegalSection heading="Age">
        <p>ZeroCorps is for adults. You must be 18 or older to create an account.</p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          If this policy changes in a way that matters, we will say so on the site before the change
          takes effect.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
