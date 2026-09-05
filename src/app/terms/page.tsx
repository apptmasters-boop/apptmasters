import Link from "next/link";

export const metadata = {
  title: "Terms of Service — ApptMasters",
};

const EFFECTIVE_DATE = "June 11, 2025";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-blue-600">ApptMasters</Link>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
            <Link href="/login" className="hover:text-blue-600 transition-colors">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using ApptMasters (&quot;the Service,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree
              to all of these Terms, do not use the Service. Your continued use of the Service after any
              changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 18 years old to create an account. By registering, you represent that
              you are 18 years of age or older and have the legal capacity to enter into these Terms. If you
              are creating an account on behalf of an organization, you represent that you have authority to
              bind that organization to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Account Registration and Security</h2>
            <p className="mb-2">
              You agree to provide accurate, current, and complete information during registration and to
              keep your account information updated. You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintaining the confidentiality of your password and account credentials.</li>
              <li>All activity that occurs under your account, whether or not authorized by you.</li>
              <li>Notifying us immediately at <a href="mailto:apptmasters@gmail.com" className="text-blue-600 hover:underline">apptmasters@gmail.com</a> of any unauthorized use or security breach.</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that we believe have been compromised or
              are being used in violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Description of Service</h2>
            <p>
              ApptMasters is a roommate management platform that helps co-tenants organize shared expenses,
              chores, maintenance requests, communications, and other aspects of shared living. The Service
              is provided as a convenience tool to facilitate coordination among roommates and is not a
              financial service, legal service, or property management company.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. User Content</h2>
            <p className="mb-2">
              You retain ownership of all content you submit, post, or upload to the Service (&quot;User
              Content&quot;), including expense records, messages, photos, and documents. By submitting User
              Content, you grant ApptMasters a limited, non-exclusive, royalty-free license to store,
              display, and process your content solely for the purpose of providing and improving the Service.
            </p>
            <p>
              You are solely responsible for the accuracy, legality, and appropriateness of your User
              Content. You agree not to submit content that is false, misleading, defamatory, harassing,
              or violates any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Financial Disclaimer</h2>
            <p className="mb-2">
              ApptMasters provides expense tracking and payment recording tools for informational purposes
              only. We are not a bank, payment processor, financial advisor, or licensed financial institution.
              We do not hold, transfer, or process any actual money on your behalf.
            </p>
            <p>
              You acknowledge that all financial agreements, expense splits, and payment obligations are
              between you and your roommates. ApptMasters is not a party to any financial arrangement between
              users and bears no responsibility for any disputes, debts, or financial losses that arise from
              the use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Roommate Relationships and Disputes</h2>
            <p>
              ApptMasters facilitates coordination between roommates but is not responsible for any
              interpersonal disputes, disagreements, or legal matters between users. Any disputes arising
              from shared living arrangements, including but not limited to unpaid expenses, lease
              obligations, or property damage, are solely between the users involved. We encourage users
              to resolve disputes amicably or through appropriate legal channels.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Prohibited Conduct</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
              <li>Harass, threaten, intimidate, or abuse other users through the Service.</li>
              <li>Upload or transmit viruses, malware, or any other harmful code.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or other users&apos; accounts.</li>
              <li>Scrape, crawl, or systematically extract data from the Service.</li>
              <li>Impersonate another person or entity.</li>
              <li>Use the Service to send unsolicited communications (spam).</li>
              <li>Submit false, fraudulent, or misleading expense records or financial information.</li>
              <li>Share your account credentials with others outside your apartment group.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Intellectual Property</h2>
            <p>
              The Service, including its software, design, text, graphics, logos, and other materials
              (excluding User Content), is owned by ApptMasters and protected by applicable intellectual
              property laws. You may not copy, modify, distribute, sell, or create derivative works from
              any part of the Service without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Termination</h2>
            <p>
              You may close your account at any time by contacting us at{" "}
              <a href="mailto:apptmasters@gmail.com" className="text-blue-600 hover:underline">apptmasters@gmail.com</a>.
              We reserve the right to suspend or permanently terminate your access to the Service, without
              notice, if we determine in our sole discretion that you have violated these Terms or that your
              continued use poses a risk to other users or to us. Upon termination, your right to use the
              Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER
              EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, APPTMASTERS DISCLAIMS ALL
              WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
              SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, APPTMASTERS SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS,
              DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF WE
              HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ALL
              CLAIMS ARISING FROM THE USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE
              TWELVE MONTHS PRECEDING THE CLAIM, OR $50, WHICHEVER IS GREATER.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. Changes to These Terms</h2>
            <p>
              We may update these Terms at any time. When we make material changes, we will notify you by
              email or through a prominent notice within the Service at least 14 days before the changes
              take effect. Your continued use of the Service after the effective date of updated Terms
              constitutes your acceptance of the changes. If you do not agree to the updated Terms, you
              must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">14. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable law. Any disputes
              arising under these Terms shall be resolved through good-faith negotiation first. If a dispute
              cannot be resolved informally, it shall be submitted to binding arbitration or a court of
              competent jurisdiction, as required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">15. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-gray-900">ApptMasters</p>
              <p>Email: <a href="mailto:apptmasters@gmail.com" className="text-blue-600 hover:underline">apptmasters@gmail.com</a></p>
              <p>Website: <a href="https://apptmasters.com" className="text-blue-600 hover:underline">apptmasters.com</a></p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
          <Link href="/register" className="text-blue-600 hover:underline">Create an account</Link>
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </div>
      </main>
    </div>
  );
}
