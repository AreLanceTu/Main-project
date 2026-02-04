import { motion } from "framer-motion";
import { Search, UserCheck, MessageSquare, ThumbsUp } from "lucide-react";

const HowItWorksSection = () => {
  const steps = [
    {
      icon: Search,
      step: "01",
      title: "Find a Service",
      description:
        "Browse through thousands of services or use our powerful search to find exactly what you need.",
    },
    {
      icon: UserCheck,
      step: "02",
      title: "Choose a Freelancer",
      description:
        "Compare ratings, reviews, and portfolios to find the perfect match for your project.",
    },
    {
      icon: MessageSquare,
      step: "03",
      title: "Collaborate & Communicate",
      description:
        "Work directly with your freelancer through our secure messaging system.",
    },
    {
      icon: ThumbsUp,
      step: "04",
      title: "Get Results & Pay Securely",
      description:
        "Receive your completed work and release payment only when you're 100% satisfied.",
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-background relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-y-1/2 translate-x-1/2" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How GigFlow Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Getting started is easy. Follow these simple steps to find and hire the perfect freelancer for your project.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-border to-transparent" />
              )}

              <div className="text-center">
                {/* Step Number */}
                <span className="inline-block text-6xl font-bold text-gradient opacity-20 mb-2">
                  {step.step}
                </span>

                {/* Icon */}
                <div className="w-20 h-20 rounded-2xl bg-secondary mx-auto mb-6 flex items-center justify-center group-hover:bg-primary transition-colors">
                  <step.icon className="w-9 h-9 text-primary" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;