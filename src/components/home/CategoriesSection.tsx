import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Palette,
  Code,
  Megaphone,
  PenTool,
  Video,
  Music,
  BarChart,
  Headphones,
} from "lucide-react";

const CategoriesSection = () => {
  const categories = [
    {
      name: "Graphics & Design",
      icon: Palette,
      description: "Logos, brand identity, and more",
      color: "from-rose-500/10 to-pink-500/10",
      iconColor: "text-rose-500",
      count: "2.5k+ services",
    },
    {
      name: "Programming & Tech",
      icon: Code,
      description: "Web, mobile, and software development",
      color: "from-blue-500/10 to-cyan-500/10",
      iconColor: "text-blue-500",
      count: "3.2k+ services",
    },
    {
      name: "Digital Marketing",
      icon: Megaphone,
      description: "SEO, social media, and advertising",
      color: "from-green-500/10 to-emerald-500/10",
      iconColor: "text-green-500",
      count: "1.8k+ services",
    },
    {
      name: "Writing & Translation",
      icon: PenTool,
      description: "Content, copywriting, and more",
      color: "from-amber-500/10 to-orange-500/10",
      iconColor: "text-amber-500",
      count: "2.1k+ services",
    },
    {
      name: "Video & Animation",
      icon: Video,
      description: "Editing, motion graphics, and more",
      color: "from-purple-500/10 to-violet-500/10",
      iconColor: "text-purple-500",
      count: "1.5k+ services",
    },
    {
      name: "Music & Audio",
      icon: Music,
      description: "Production, mixing, and voice-over",
      color: "from-red-500/10 to-rose-500/10",
      iconColor: "text-red-500",
      count: "980+ services",
    },
    {
      name: "Business",
      icon: BarChart,
      description: "Consulting, planning, and analysis",
      color: "from-teal-500/10 to-cyan-500/10",
      iconColor: "text-teal-500",
      count: "1.2k+ services",
    },
    {
      name: "Lifestyle",
      icon: Headphones,
      description: "Coaching, wellness, and fitness",
      color: "from-indigo-500/10 to-blue-500/10",
      iconColor: "text-indigo-500",
      count: "650+ services",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Explore Popular Categories
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find the right talent for any project. Browse through our most popular service categories.
          </p>
        </motion.div>

        {/* Categories Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {categories.map((category) => (
            <motion.div key={category.name} variants={itemVariants}>
              <Link
                to={`/gigs?category=${encodeURIComponent(category.name)}`}
                className="group block h-full"
              >
                <div className="relative h-full bg-card rounded-2xl p-6 border border-border hover:border-primary/30 transition-all duration-300 card-hover overflow-hidden">
                  {/* Background Gradient */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />

                  {/* Content */}
                  <div className="relative z-10">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <category.icon className={`w-7 h-7 ${category.iconColor}`} />
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>

                    <p className="text-sm text-muted-foreground mb-3">
                      {category.description}
                    </p>

                    <span className="text-xs font-medium text-primary">
                      {category.count}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default CategoriesSection;