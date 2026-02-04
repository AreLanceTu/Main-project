import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const CookiePolicy = () => {
  return (
    <>
      <Helmet>
        <title>Cookie Policy | GigFlow</title>
        <meta name="description" content="Cookie Policy for GigFlow (India)." />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <header className="max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">Cookie Policy</h1>
              <p className="mt-2 text-sm text-muted-foreground">Effective date: January 12, 2026</p>
              <p className="mt-4 text-muted-foreground">
                This Cookie Policy explains how GigFlow uses cookies and similar technologies on the
                Platform.
              </p>
            </header>

            <section className="mt-10 max-w-3xl space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-foreground">1. What Are Cookies?</h2>
                <p className="mt-3 text-muted-foreground">
                  Cookies are small text files stored on your device when you visit a website. They help
                  websites remember information about your visit.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">2. How We Use Cookies</h2>
                <div className="mt-3 text-muted-foreground">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>To keep you signed in and maintain session security</li>
                    <li>To remember preferences and improve your experience</li>
                    <li>To understand usage and improve Platform performance</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">3. Managing Cookies</h2>
                <p className="mt-3 text-muted-foreground">
                  You can manage cookies through your browser settings. If you disable cookies, some
                  features of the Platform may not work as intended.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">4. Contact</h2>
                <p className="mt-3 text-muted-foreground">
                  For questions about this Cookie Policy, contact{" "}
                  <a className="text-primary underline" href="mailto:help.gigflow@gmail.com">
                    help.gigflow@gmail.com
                  </a>
                  .
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

export default CookiePolicy;
