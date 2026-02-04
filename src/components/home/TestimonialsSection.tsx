import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const TestimonialsSection = () => {
  const testimonials = [
    {
      id: 1,
      content:
        "GigFlow transformed how we handle design work. Found an amazing logo designer within hours, and the result exceeded our expectations. Highly recommend!",
      author: "Jennifer Martinez",
      role: "Startup Founder",
      company: "TechNova",
      rating: 5,
      avatar: "JM",
    },
    {
      id: 2,
      content:
        "As a freelancer, GigFlow has been incredible. The platform is intuitive, payments are always on time, and I've built amazing long-term client relationships.",
      author: "David Kim",
      role: "Full-Stack Developer",
      company: "Freelancer",
      rating: 5,
      avatar: "DK",
    },
    {
      id: 3,
      content:
        "We've hired over 50 freelancers through GigFlow for various projects. The quality is consistently high, and the support team is always helpful.",
      author: "Sarah Thompson",
      role: "Marketing Director",
      company: "BrandCraft Agency",
      rating: 5,
      avatar: "ST",
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-foreground text-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Loved by Thousands
          </h2>
          <p className="text-lg text-background/70 max-w-2xl mx-auto">
            See what our community of freelancers and clients have to say about their experience.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              <div className="h-full bg-background/5 backdrop-blur-sm rounded-2xl p-6 lg:p-8 border border-background/10 hover:border-background/20 transition-colors">
                {/* Quote Icon */}
                <Quote className="w-10 h-10 text-primary mb-4 opacity-60" />

                {/* Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>

                {/* Content */}
                <p className="text-background/90 leading-relaxed mb-6">
                  "{testimonial.content}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-background">
                      {testimonial.author}
                    </p>
                    <p className="text-sm text-background/60">
                      {testimonial.role} at {testimonial.company}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;