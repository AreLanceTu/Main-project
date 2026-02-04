import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const TermsAndConditions = () => {
  return (
    <>
      <Helmet>
        <title>Terms & Conditions | GigFlow</title>
        <meta
          name="description"
          content="Terms & Conditions for using GigFlow, a freelance marketplace platform in India."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <header className="max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">Terms &amp; Conditions</h1>
              <p className="mt-2 text-sm text-muted-foreground">Effective date: January 12, 2026</p>
              <p className="mt-4 text-muted-foreground">
                These Terms &amp; Conditions ("Terms") govern your access to and use of GigFlow (the
                "Platform"). By using GigFlow, you agree to these Terms.
              </p>
            </header>

            <section className="mt-10 max-w-3xl space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-foreground">1. About GigFlow</h2>
                <p className="mt-3 text-muted-foreground">
                  GigFlow is an online marketplace connecting clients ("Clients") with freelancers
                  ("Freelancers") for delivery of digital and professional services ("Services"). GigFlow
                  is a platform provider and does not itself deliver Services unless explicitly stated.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">2. Eligibility and Account</h2>
                <div className="mt-3 text-muted-foreground space-y-3">
                  <p>
                    You must be legally capable of entering into a contract under Indian law to use the
                    Platform.
                  </p>
                  <p>
                    You are responsible for maintaining the confidentiality of your account and for all
                    activities that happen under your account.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">3. Platform Rules</h2>
                <div className="mt-3 text-muted-foreground">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Provide accurate information and do not impersonate others.</li>
                    <li>Do not upload unlawful, misleading, abusive, or infringing content.</li>
                    <li>Do not attempt to bypass Platform fees, payment flows, or security measures.</li>
                    <li>Do not use the Platform for money laundering, fraud, or illegal activity.</li>
                    <li>Respect other users and communicate professionally.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">4. Client Responsibilities</h2>
                <div className="mt-3 text-muted-foreground">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Provide clear requirements, timelines, and any necessary materials.</li>
                    <li>Review deliverables in a timely manner and communicate feedback clearly.</li>
                    <li>Make payments for orders as required through the Platform.</li>
                    <li>Use delivered work only according to the agreed scope and applicable law.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">5. Freelancer Responsibilities</h2>
                <div className="mt-3 text-muted-foreground">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Provide accurate service descriptions, pricing, and delivery timelines.</li>
                    <li>Deliver work that matches the agreed scope and quality standards.</li>
                    <li>Communicate promptly about questions, delays, or changes in requirements.</li>
                    <li>Ensure you have the rights to share any content you upload or deliver.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">6. Payments</h2>
                <div className="mt-3 text-muted-foreground space-y-3">
                  <p>
                    Payments are processed securely via third-party payment gateways (such as Razorpay or
                    other providers). GigFlow does not store full card details.
                  </p>
                  <p>
                    You agree to pay all applicable charges for orders you place. Any taxes, if applicable,
                    may be added as per law.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">7. Cancellations and Refunds</h2>
                <p className="mt-3 text-muted-foreground">
                  Refunds are governed by our Refund Policy available on the Platform. In general, refunds
                  are only provided for duplicate payments or technical failures, and not once a service is
                  delivered.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">8. Intellectual Property</h2>
                <p className="mt-3 text-muted-foreground">
                  Unless agreed otherwise between the Client and Freelancer, ownership and usage rights of
                  deliverables depend on the agreed scope and applicable law. Each party retains rights to
                  their pre-existing intellectual property.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">9. Disclaimer</h2>
                <p className="mt-3 text-muted-foreground">
                  GigFlow provides the Platform on an "as is" and "as available" basis. We do not guarantee
                  that the Platform will be uninterrupted or error-free, or that any Freelancer will deliver
                  a particular outcome.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">10. Limitation of Liability</h2>
                <p className="mt-3 text-muted-foreground">
                  To the maximum extent permitted by law, GigFlow will not be liable for any indirect,
                  incidental, special, consequential, or punitive damages, or any loss of profits, data, or
                  goodwill. GigFlow’s total liability for any claim relating to the Platform will not exceed
                  the amount of platform fees (if any) paid to GigFlow by you in the three (3) months prior
                  to the event giving rise to the claim.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">11. Termination</h2>
                <p className="mt-3 text-muted-foreground">
                  We may suspend or terminate access to the Platform if we reasonably believe you have
                  violated these Terms, or if required to protect the Platform, users, or comply with law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">12. Governing Law</h2>
                <p className="mt-3 text-muted-foreground">
                  These Terms are governed by the laws of India. Any disputes will be subject to the
                  exclusive jurisdiction of competent courts in India.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">13. Contact</h2>
                <p className="mt-3 text-muted-foreground">
                  For questions about these Terms, contact us at{" "}
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

export default TermsAndConditions;
