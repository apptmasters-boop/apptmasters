import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ApptMasters",
};

const EFFECTIVE_DATE = "June 11, 2025";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-blue-600">ApptMasters</Link>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
            <Link href="/login" className="hover:text-blue-600 transition-colors">Sign in</Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              ApptMasters (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy
              Policy explains what information we collect, how we use it, who we share it with, and your
              rights regarding your data when you use our roommate management platform at{" "}
              <a href="https://apptmasters.com" className="text-blue-600 hover:underline">apptmasters.com</a>.
            </p>
            <p className="mt-2">
              By using the Service, you consent to the practices described in this Privacy Policy. If you
              do not agree with this policy, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Information We Collect</h2>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">a) Account Information</h3>
            <p>
              When you register, we collect your name, email address, and password (stored as a secure
              one-way hash). You may also optionally provide a profile photo.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">b) Apartment and Roommate Data</h3>
            <p>
              To provide the core Service, we collect information you enter about your apartment, including
              its name, address description, and the membership and roles of roommates in your group.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">c) Financial Data</h3>
            <p>
              We collect expense records you create, including titles, amounts, categories, split methods,
              receipts, and payment status. We also store settlement records and balance information between
              roommates. We do not collect or store credit card numbers, bank account numbers, or any
              payment instrument details.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">d) Communications</h3>
            <p>
              We store messages sent through the group chat and direct messaging features, including text
              content, audio messages, and any attached files. These messages are visible to other members
              of your apartment group.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">e) Files and Media</h3>
            <p>
              We store files you upload, including expense receipts, cleaning proof photos, and profile
              pictures. Audio messages are automatically deleted 48 hours after they are sent.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">f) Usage and Technical Data</h3>
            <p>
              We may automatically collect technical information such as your IP address, browser type,
              device type, operating system, and pages visited within the Service. This information is
              used for security, analytics, and improving the Service.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">g) Notification Preferences</h3>
            <p>
              We store your notification preferences (email and push notifications) and any device tokens
              used to deliver push notifications to your device.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide, operate, and maintain the Service.</li>
              <li>Process and display expense records, balances, and chore assignments.</li>
              <li>Send notifications (email and push) about activity in your apartment group.</li>
              <li>Authenticate your identity and maintain account security.</li>
              <li>Respond to your support requests and communicate with you about the Service.</li>
              <li>Detect, investigate, and prevent fraudulent transactions and other illegal activity.</li>
              <li>Analyze usage patterns to improve the Service (using aggregated, anonymized data).</li>
              <li>Comply with legal obligations.</li>
            </ul>
            <p className="mt-2">
              We do not use your personal data to serve third-party advertisements or sell it to
              data brokers or marketing companies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Information Sharing</h2>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">a) Within Your Apartment Group</h3>
            <p>
              Information you add to the Service — such as expenses, chores, messages, maintenance
              requests, and your profile — is visible to other active members of your apartment group.
              By joining or creating an apartment on ApptMasters, you consent to sharing this information
              with your roommates.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">b) Service Providers</h3>
            <p>
              We may share your information with trusted third-party service providers who assist us in
              operating the Service, subject to confidentiality agreements. These may include:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Hosting:</strong> Our servers are hosted on Amazon Web Services (AWS).</li>
              <li><strong>Email delivery:</strong> We use Resend to send transactional emails.</li>
              <li><strong>Database:</strong> Your data is stored in a PostgreSQL database on our servers.</li>
            </ul>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">c) Legal Requirements</h3>
            <p>
              We may disclose your information if required to do so by law, court order, or governmental
              authority, or when we believe disclosure is necessary to protect our rights, protect your
              safety or the safety of others, or investigate fraud.
            </p>

            <h3 className="font-medium text-gray-800 mt-4 mb-2">d) We Do Not Sell Your Data</h3>
            <p>
              We do not sell, rent, or trade your personal information to third parties for their
              commercial purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you request deletion
              of your account, we will delete or anonymize your personal information within 30 days,
              except where we are required to retain it for legal compliance, dispute resolution, or
              enforcement of our agreements.
            </p>
            <p className="mt-2">
              Audio messages are automatically deleted 48 hours after being sent. Expense records and
              financial history may be retained for longer periods to maintain the integrity of shared
              financial records within your apartment group.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>HTTPS/TLS encryption for all data transmitted between your device and our servers.</li>
              <li>Passwords stored using bcrypt hashing (never stored in plaintext).</li>
              <li>JWT-based authentication with secure token handling.</li>
              <li>Optional two-factor authentication (2FA) for your account.</li>
              <li>Access controls limiting which employees can access user data.</li>
            </ul>
            <p className="mt-2">
              While we take these precautions, no method of transmission over the Internet is 100% secure.
              We cannot guarantee absolute security and encourage you to use a strong, unique password and
              enable 2FA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Cookies and Local Storage</h2>
            <p>
              We use browser local storage to store your authentication token so you remain signed in
              across sessions. We may use cookies for session management and security purposes. We do not
              use third-party tracking cookies or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Your Rights and Choices</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information in your profile settings.</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated personal data.</li>
              <li><strong>Portability:</strong> Request your expense data in CSV or PDF format (available in the Finance section).</li>
              <li><strong>Notification preferences:</strong> Manage email and push notification settings in your account settings at any time.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:apptmasters@gmail.com" className="text-blue-600 hover:underline">apptmasters@gmail.com</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to individuals under the age of 18. We do not knowingly collect
              personal information from children under 18. If you believe a child has provided us with
              personal information, please contact us immediately and we will take steps to delete such
              information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will
              notify you by email or through a notice within the Service before the changes take effect.
              We encourage you to review this policy periodically. Your continued use of the Service after
              any changes constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contact Us</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data
              practices, please contact us:
            </p>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="font-medium text-gray-900">ApptMasters — Privacy Team</p>
              <p>Email: <a href="mailto:apptmasters@gmail.com" className="text-blue-600 hover:underline">apptmasters@gmail.com</a></p>
              <p>Website: <a href="https://apptmasters.com" className="text-blue-600 hover:underline">apptmasters.com</a></p>
            </div>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
          <Link href="/register" className="text-blue-600 hover:underline">Create an account</Link>
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </div>
      </main>
    </div>
  );
}
