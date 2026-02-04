import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import CategoriesSection from "@/components/home/CategoriesSection";
import FeaturedGigsSection from "@/components/home/FeaturedGigsSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import CTASection from "@/components/home/CTASection";
import ChatbotWidget from "@/components/home/ChatbotWidget";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>GigFlow - Find the Perfect Freelance Services</title>
        <meta
          name="description"
          content="Connect with talented freelancers from around the world. Find expert services in design, development, marketing, writing, and more on GigFlow."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-1">
          <HeroSection />
          <CategoriesSection />
          <FeaturedGigsSection />
          <HowItWorksSection />
          <TestimonialsSection />
          <CTASection />
        </main>

        <ChatbotWidget />

        <Footer />
      </div>
    </>
  );
};

export default Index;