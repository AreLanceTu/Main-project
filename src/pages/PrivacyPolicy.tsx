import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | GigFlow</title>
        <meta
          name="description"
          content="Privacy Policy for GigFlow (India) - what we collect, how we use it, and your choices."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <header className="max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
              <p className="mt-2 text-sm text-muted-foreground">Effective date: January 12, 2026</p>
              <p className="mt-4 text-muted-foreground">
                This Privacy Policy explains how GigFlow ("GigFlow", "we", "our", "us") collects,
                uses, shares, and protects personal information when you use our website and services
                (the "Platform").
              </p>
            </header>

            <section className="mt-10 max-w-3xl space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
                <div className="mt-3 space-y-3 text-muted-foreground">
                  <p>
                    We collect information you provide directly to us and information generated when you
                    use the Platform.
                  </p>
                  <div>
                    <p className="font-medium text-foreground">A) Account and Profile Information</p>
                    <ul className="mt-2 list-disc pl-6">
                      <li>Name</li>
                      <li>Email address</li>
                      <li>Profile details you choose to add (for example, skills, bio, portfolio)</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">B) Payments and Transaction Information</p>
                    <ul className="mt-2 list-disc pl-6">
                      <li>Transaction details such as amount, date/time, and order reference</li>
                      <li>
                        Limited payment-related details needed for reconciliation and support (for example,
                        payment status)
                      </li>
                    </ul>
                    <p className="mt-2">
                      Payments on GigFlow are processed securely by third-party payment gateways (such as
                      Razorpay or other providers). We do not store full card details on our servers.
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">C) Usage and Device Information</p>
                    <ul className="mt-2 list-disc pl-6">
                      <li>IP address, device identifiers, browser type, and operating system</li>
                      <li>Pages viewed, links clicked, and actions taken on the Platform</li>
                      <li>Log data for security, debugging, and analytics</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
                <div className="mt-3 text-muted-foreground">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>To create and manage your account and provide Platform features</li>
                    <li>To facilitate payments and provide transaction support</li>
                    <li>To communicate important updates, service messages, and support responses</li>
                    <li>To improve performance, security, and user experience</li>
                    <li>To detect, prevent, and investigate fraud or misuse</li>
                    <li>To comply with applicable laws and regulatory obligations in India</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">3. Sharing of Information</h2>
                <div className="mt-3 space-y-3 text-muted-foreground">
                  <p>
                    We do not sell your personal information.
                  </p>
                  <p>
                    We may share information only as needed to operate the Platform, for example:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      With payment gateways and banking partners to process transactions securely
                    </li>
                    <li>
                      With service providers who help us run the Platform (hosting, analytics, email
                      delivery, customer support tools)
                    </li>
                    <li>
                      When required by law, regulation, legal process, or a valid government request
                    </li>
                    <li>
                      To protect the rights, safety, and security of GigFlow, our users, or the public
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">4. Data Retention</h2>
                <p className="mt-3 text-muted-foreground">
                  We retain personal information only for as long as necessary to provide the Platform,
                  meet legal or accounting requirements, resolve disputes, and enforce our agreements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">5. Your Choices</h2>
                <div className="mt-3 text-muted-foreground space-y-3">
                  <p>
                    You can review and update some account information from your account settings. You may
                    also request access, correction, or deletion of your personal information, subject to
                    legal and operational requirements.
                  </p>
                  <p>
                    If you have questions about your information or requests related to privacy, contact us
                    at <a className="text-primary underline" href="mailto:help.gigflow@gmail.com">help.gigflow@gmail.com</a>.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">6. Security</h2>
                <p className="mt-3 text-muted-foreground">
                  We use reasonable security measures to protect your information. However, no method of
                  transmission or storage is completely secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">7. Changes to This Policy</h2>
                <p className="mt-3 text-muted-foreground">
                  We may update this Privacy Policy from time to time. If we make material changes, we will
                  post the updated policy on this page with a new effective date.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">8. Contact</h2>
                <p className="mt-3 text-muted-foreground">
                  For privacy-related questions, email us at{" "}
                  <a className="text-primary underline" href="mailto:help.gigflow@gmail.com">help.gigflow@gmail.com</a>.
                </p>
              </section>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default PrivacyPolicy;
