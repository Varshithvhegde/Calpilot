import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata = {
  title: 'Privacy Policy · Calpilot',
  description: 'How Calpilot handles your Google account and calendar data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display text-[17px] font-bold tracking-tight text-ink">Calpilot</span>
        </Link>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link href="/terms" className="text-mute transition hover:text-ink">
            Terms
          </Link>
          <Link
            href="/"
            className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-ink transition hover:border-ink/30"
          >
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 pb-16">
        <article className="rounded-[16px] border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-cobalt">Legal</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Privacy Policy</h1>
          <p className="mt-2 text-xs text-mute">Last updated: November 25, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/90">
            <section>
              <h2 className="font-display text-lg font-bold text-ink">1. Information We Access</h2>
              <p className="mt-2 text-mute">
                When you sign in with Google, Calpilot requests access to your basic Google profile (name, email address,
                and profile image) and your Google Calendar data (<code className="rounded bg-paper px-1.5 py-0.5 text-xs">calendar</code> scope)
                so it can display your schedule, analyze meeting load, and apply changes you explicitly approve.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">2. How We Use Your Data</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-mute">
                <li>Display your weekly events and compute your Week Health score in your browser.</li>
                <li>
                  Generate schedule proposals, invite triage recommendations, and meeting prep briefs when you ask
                  Calpilot. Relevant event metadata (titles, times, attendees, and descriptions) is sent to our AI
                  inference provider solely to fulfill your request.
                </li>
                <li>
                  Write changes (creating, moving, deleting, or RSVPing to events) to your Google Calendar{' '}
                  <strong className="text-ink">only after you explicitly approve them</strong>.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">3. Data Storage &amp; Retention</h2>
              <p className="mt-2 text-mute">
                Calpilot does not store your Google Calendar events in a persistent external database. Your OAuth
                session token is kept in an encrypted, HTTP-only session cookie, and local preferences (such as your
                goals, hourly rate, and theme) are stored in your browser&apos;s <code className="rounded bg-paper px-1.5 py-0.5 text-xs">localStorage</code>.
                In Demo Mode, only sample events are used and no Google data is accessed.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">4. Google API Services User Data Policy</h2>
              <p className="mt-2 text-mute">
                Calpilot&apos;s use and transfer of information received from Google APIs adheres to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-cobalt underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We do not sell your personal or calendar data, nor do we use
                Google Workspace data to train generalized AI models.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">5. Revoking Access &amp; Contact</h2>
              <p className="mt-2 text-mute">
                You can sign out at any time from Calpilot or revoke Calpilot&apos;s access to your Google account at{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-cobalt underline"
                >
                  myaccount.google.com/permissions
                </a>
                . For privacy questions, contact the app administrator via the support email listed on the Google OAuth
                consent screen.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
