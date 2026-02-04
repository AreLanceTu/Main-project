import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Youtube } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FooterProps = {
  variant?: "default" | "compact";
};

const Footer = ({ variant = "default" }: FooterProps) => {
  const footerLinks = {
    categories: {
      title: "Categories",
      links: [
        { name: "Graphics & Design", href: "/gigs?category=graphics" },
        { name: "Digital Marketing", href: "/gigs?category=marketing" },
        { name: "Writing & Translation", href: "/gigs?category=writing" },
        { name: "Video & Animation", href: "/gigs?category=video" },
        { name: "Programming & Tech", href: "/gigs?category=programming" },
      ],
    },
    about: {
      title: "About",
      links: [
        { name: "About GigFlow", href: "/about" },
        { name: "Careers", href: "/careers" },
        { name: "Press & News", href: "/press" },
        { name: "Partnerships", href: "/partnerships" },
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms & Conditions", href: "/terms" },
        { name: "Refund Policy", href: "/refunds" },
      ],
    },
    support: {
      title: "Support",
      links: [
        { name: "Help & Support", href: "/help" },
        { name: "Trust & Safety", href: "/trust" },
        { name: "Selling on GigFlow", href: "/selling" },
        { name: "Buying on GigFlow", href: "/buying" },
        { name: "Contact Us", href: "/contact" },
      ],
    },
    community: {
      title: "Community",
      links: [
        { name: "Events", href: "/events" },
        { name: "Blog", href: "/blog" },
        { name: "Forum", href: "/forum" },
        { name: "Podcast", href: "/podcast" },
        { name: "Affiliates", href: "/affiliates" },
      ],
    },
  };

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Instagram, href: "#", label: "Instagram" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Youtube, href: "#", label: "YouTube" },
  ];

  if (variant === "compact") {
    return (
      <footer className="bg-foreground text-background">
        <div className="border-t border-background/10">
          <div className="container mx-auto px-4 py-2 sm:py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-background/60 text-xs sm:text-sm">
                © {new Date().getFullYear()} GigFlow. All rights reserved.
              </p>
              <div className="flex items-center gap-4 text-xs sm:text-sm">
                <Link to="/terms" className="text-background/60 hover:text-background transition-colors">
                  Terms
                </Link>
                <Link to="/privacy" className="text-background/60 hover:text-background transition-colors">
                  Privacy
                </Link>
                <Link to="/refunds" className="text-background/60 hover:text-background transition-colors">
                  Refunds
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-foreground text-background">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-10 sm:py-16">
        {/* Mobile: accordion to keep footer short */}
        <div className="sm:hidden">
          <div className="mb-6">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-full bg-black p-1 ring-1 ring-white/20">
                <img
                  src="/LOGO.png"
                  alt="GigFlow logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-xl font-bold">GigFlow</span>
            </Link>
            <p className="text-background/70 text-sm mb-4">
              The world's largest freelance marketplace connecting talented freelancers with businesses.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {Object.entries(footerLinks).map(([key, section]) => (
              <AccordionItem key={key} value={key} className="border-background/10">
                <AccordionTrigger className="text-sm font-semibold uppercase tracking-wider hover:no-underline">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 pb-2">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          to={link.href}
                          className="text-background/70 hover:text-background text-sm transition-colors"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Desktop/tablet: multi-column layout */}
        <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-6 sm:mb-8 lg:mb-0">
            <Link to="/" className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="h-8 w-8 rounded-full bg-black p-1 ring-1 ring-white/20">
                <img
                  src="/LOGO.png"
                  alt="GigFlow logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-xl font-bold">GigFlow</span>
            </Link>
            <p className="text-background/70 text-sm mb-4 sm:mb-6">
              The world's largest freelance marketplace connecting talented freelancers with businesses.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-background/10 hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-3 sm:mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2 sm:space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.href}
                      className="text-background/70 hover:text-background text-sm transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-background/10">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="sm:hidden flex items-center justify-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-8 h-8 rounded-full bg-background/10 hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
            <p className="text-background/60 text-sm">
              © {new Date().getFullYear()} GigFlow. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/terms" className="text-background/60 hover:text-background transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-background/60 hover:text-background transition-colors">
                Privacy Policy
              </Link>
              <Link to="/refunds" className="text-background/60 hover:text-background transition-colors">
                Refund Policy
              </Link>
              <Link to="/cookies" className="text-background/60 hover:text-background transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;