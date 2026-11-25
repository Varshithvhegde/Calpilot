import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata = {
  title: 'Terms & Conditions · Calpilot',
  description: 'Terms of service for using Calpilot.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display text-[17px] font-bold tracking-tight text-ink">Calpilot</span>
        </Link>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <Link href="/privacy" className="text-mute transition hover:text-ink">
            Privacy
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
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Terms and Conditions</h1>
          <p className="mt-2 text-xs text-mute">Last updated: November 25, 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/90">
            <section>
              <h2 className="font-display text-lg font-bold text-ink">1. Acceptance of Terms</h2>
              <p className="mt-2 text-mute">
                By accessing or using Calpilot, you agree to be bound by these Terms and Conditions and our{' '}
                <Link href="/privacy" className="font-medium text-cobalt underline">
                  Privacy Policy
                </Link>
                . If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">2. Description of Service</h2>
              <p className="mt-2 text-mute">
                Calpilot is an AI-assisted calendar planning tool for Google Calendar. Calpilot generates schedule
                proposals, invite triage recommendations, and meeting prep summaries for your review. You remain solely
                responsible for reviewing and approving any changes before they are written to your Google Calendar.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">3. Acceptable Use</h2>
              <p className="mt-2 text-mute">
                You agree to use Calpilot only for lawful purposes and in accordance with Google&apos;s Terms of Service.
                You must not attempt to abuse, reverse-engineer, overload, or bypass rate limits or authentication
                mechanisms of the service.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">4. AI-Generated Output &amp; No Warranty</h2>
              <p className="mt-2 text-mute">
                Calpilot uses large language models to interpret natural-language requests. AI suggestions may
                occasionally contain inaccuracies or scheduling conflicts. The service is provided &ldquo;as is&rdquo;
                and &ldquo;as available&rdquo; without warranties of any kind, express or implied.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">5. Limitation of Liability</h2>
              <p className="mt-2 text-mute">
                To the maximum extent permitted by law, Calpilot and its creators shall not be liable for any indirect,
                incidental, or consequential damages, including missed meetings or calendar changes approved by you.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-ink">6. Changes to Terms</h2>
              <p className="mt-2 text-mute">
                We may update these Terms from time to time. Continued use of Calpilot after changes are posted
                constitutes your acceptance of the updated Terms.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
