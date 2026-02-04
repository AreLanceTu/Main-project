import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const ContactUs = () => {
  return (
    <>
      <Helmet>
        <title>Contact Us | GigFlow</title>
        <meta name="description" content="Contact GigFlow support in India." />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <header className="max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
              <p className="mt-4 text-muted-foreground">
                Need help or have a question? Reach out and our support team will get back to you.
              </p>
            </header>

            <section className="mt-10 max-w-3xl space-y-6">
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground">Support Email</h2>
                <p className="mt-2 text-muted-foreground">
                  <a className="text-primary underline" href="mailto:help.gigflow@gmail.com">help.gigflow@gmail.com</a>
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground">Location</h2>
                <p className="mt-2 text-muted-foreground">India</p>
              </div>
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ContactUs;
