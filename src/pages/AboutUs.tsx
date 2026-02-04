import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const AboutUs = () => {
  return (
    <>
      <Helmet>
        <title>About Us | GigFlow</title>
        <meta
          name="description"
          content="About GigFlow - an online marketplace connecting businesses with skilled freelancers."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1">
          <div className="container mx-auto px-4 py-12">
            <header className="max-w-3xl">
              <h1 className="text-3xl font-bold text-foreground">About Us</h1>
              <p className="mt-4 text-muted-foreground">
                GigFlow is an online marketplace connecting businesses with skilled freelancers across a
                wide range of digital and professional services.
              </p>
            </header>

            <section className="mt-10 max-w-3xl space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-foreground">What We Do</h2>
                <p className="mt-3 text-muted-foreground">
                  We help clients find the right talent and help freelancers showcase their skills and grow
                  their independent careers—on one transparent platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">Our Focus</h2>
                <div className="mt-3 text-muted-foreground">
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <span className="text-foreground font-medium">Quality:</span> Encourage clear service
                      listings and professional delivery.
                    </li>
                    <li>
                      <span className="text-foreground font-medium">Transparency:</span> Clear expectations,
                      pricing, and communication.
                    </li>
                    <li>
                      <span className="text-foreground font-medium">Secure Payments:</span> Payments are
                      processed through trusted third-party payment gateways.
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground">Built for Trust</h2>
                <p className="mt-3 text-muted-foreground">
                  GigFlow is designed to support safe interactions, reduce fraud, and provide a smooth
                  experience for both Clients and Freelancers.
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

export default AboutUs;
