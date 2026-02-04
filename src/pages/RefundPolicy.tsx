import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const RefundPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Refund Policy | GigFlow</title>
        <meta
          name="description"
          content="Refund Policy for GigFlow - refunds for duplicate payments or technical failures, India."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <header className="max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">Refund Policy</h1>
              <p className="mt-2 text-sm text-muted-foreground">Effective date: January 12, 2026</p>
              <p className="mt-4 text-muted-foreground">
                This Refund Policy explains when GigFlow will process refunds for payments made on the
                Platform.
              </p>
            </header>

            <section className="mt-10 max-w-3xl space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-foreground">1. Eligible Refund Cases</h2>
                <div className="mt-3 text-muted-foreground">
                  <p>Refunds are only provided in the following cases:</p>
                  <ul className="mt-2 list-disc pl-6 space-y-2">
                    <li>Duplicate payment (you were charged more than once for the same order)</li>
                    <li>Technical failure (payment succeeded but the order was not created due to a system error)</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">2. Non-Refundable Cases</h2>
                <div className="mt-3 text-muted-foreground">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>No refunds once a service is delivered.</li>
                    <li>Refunds are not provided for change of mind or dissatisfaction after delivery.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">3. How to Request a Refund</h2>
                <div className="mt-3 text-muted-foreground space-y-3">
                  <p>
                    To request a refund, email us at{" "}
                    <a className="text-primary underline" href="mailto:help.gigflow@gmail.com">help.gigflow@gmail.com</a>{" "}
                    with your registered email address and the payment/order reference.
                  </p>
                  <p>
                    We may ask for additional information (such as a payment confirmation screenshot) to
                    verify the claim.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">4. Refund Processing Timeline</h2>
                <p className="mt-3 text-muted-foreground">
                  Approved refunds are processed within 5–7 working days. The time taken for the refunded
                  amount to reflect in your account may vary depending on your bank/payment method.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">5. Payments via Third-Party Gateways</h2>
                <p className="mt-3 text-muted-foreground">
                  Payments on GigFlow are processed via third-party payment gateways (such as Razorpay or
                  other providers). Refunds, when approved, are initiated back to the original payment
                  method as per the gateway’s process.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">6. Contact</h2>
                <p className="mt-3 text-muted-foreground">
                  For refund-related queries, contact{" "}
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

export default RefundPolicy;
