"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 12 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 50, rotateX: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      delay: i * 0.15,
      type: "spring",
      stiffness: 100,
      damping: 12
    }
  })
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--cloud-50)] overflow-x-hidden font-body">
      {/* Navigation */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[var(--cloud-50)]/90 backdrop-blur-xl shadow-sm shadow-[var(--lavender-200)]/20 py-3"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/memora-logo.png"
              alt="Memora"
              className="h-10 w-auto"
            />
            <div className="hidden sm:block">
              <span className="text-2xl font-bold font-display text-[var(--charcoal-900)]">
                Memora
              </span>
              <p className="text-[10px] uppercase tracking-widest text-[var(--charcoal-800)]/60 -mt-1">
                Your Gift & Wish List Hub
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-[var(--charcoal-900)] hover:text-[var(--lavender-600)] font-medium transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href="/login"
                className="bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white px-6 py-2.5 rounded-full font-semibold shadow-lg shadow-[var(--lavender-400)]/30 hover:shadow-xl hover:shadow-[var(--lavender-400)]/40 transition-all duration-300"
              >
                Get Started
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 pb-20 px-6 overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Lavender blob - top left */}
          <motion.div
            className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-[var(--lavender-300)]/40 rounded-full blur-3xl"
            animate={{
              x: [0, 30, 0],
              y: [0, -20, 0],
              scale: [1, 1.05, 1]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Peach blob - bottom right */}
          <motion.div
            className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-[var(--peach-300)]/50 rounded-full blur-3xl"
            animate={{
              x: [0, -25, 0],
              y: [0, 15, 0]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          {/* Buttercream blob - center */}
          <motion.div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[var(--buttercream-100)]/60 rounded-full blur-3xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          {/* Mint accent - smaller, playful */}
          <motion.div
            className="absolute top-1/4 right-1/4 w-[200px] h-[200px] bg-[var(--mint-300)]/40 rounded-full blur-2xl"
            animate={{
              x: [0, 40, 0],
              y: [0, -30, 0]
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>

        <motion.div
          className="max-w-6xl mx-auto text-center relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={itemVariants}
            className="inline-block mb-6 px-4 py-2 rounded-full bg-[var(--lavender-100)] border border-[var(--lavender-200)]"
          >
            <span className="text-sm font-semibold text-[var(--lavender-600)]">
              Your Gift & Wish List Hub
            </span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl lg:text-8xl font-bold font-display mb-6 leading-tight"
          >
            <span className="text-[var(--charcoal-900)]">
              Create Your Perfect
            </span>
            <br />
            <span className="bg-gradient-to-r from-[var(--lavender-500)] via-[var(--peach-400)] to-[var(--mint-400)] bg-clip-text text-transparent">
              Gift Registry
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-[var(--charcoal-800)] mb-10 max-w-3xl mx-auto font-light leading-relaxed"
          >
            Curate wishlists from anywhere. Let friends contribute together.
            Receive gifts you'll actually love.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href="/login"
                className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--lavender-400)] via-[var(--lavender-500)] to-[var(--lavender-400)] text-white rounded-full font-semibold text-lg shadow-xl shadow-[var(--lavender-400)]/30 overflow-hidden"
              >
                <span className="relative z-10">Start Your Registry</span>
                <svg className="relative z-10 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </Link>
            </motion.div>
            <Link
              href="#how-it-works"
              className="px-8 py-4 bg-white text-[var(--charcoal-900)] rounded-full font-semibold text-lg border-2 border-[var(--lavender-200)] hover:border-[var(--lavender-400)] hover:text-[var(--lavender-600)] transition-all duration-300"
            >
              Learn More
            </Link>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-sm text-[var(--charcoal-800)] font-medium"
          >
            Free forever · No credit card required · Set up in minutes
          </motion.p>
        </motion.div>
      </section>

      {/* Feature Preview Cards */}
      <section className="py-12 px-6 -mt-16 relative z-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                ),
                gradient: "from-[var(--lavender-400)] to-[var(--lavender-500)]",
                title: "Add Any Item",
                description: "From any store, anywhere online"
              },
              {
                icon: (
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                gradient: "from-[var(--peach-400)] to-[var(--peach-500)]",
                title: "Group Gifting",
                description: "Friends contribute together"
              },
              {
                icon: (
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                gradient: "from-[var(--mint-300)] to-[var(--mint-400)]",
                title: "Get What You Want",
                description: "No duplicates, no regrets"
              }
            ].map((card, index) => (
              <motion.div
                key={index}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                whileHover={{
                  y: -8,
                  rotateY: 3,
                  rotateX: -3,
                  transition: { duration: 0.3 }
                }}
                className="relative group"
                style={{ transformPerspective: 1000 }}
              >
                {/* Gradient border effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-[var(--lavender-300)] via-[var(--peach-200)] to-[var(--mint-300)] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />

                <div className="relative bg-white rounded-2xl p-6 shadow-lg shadow-[var(--charcoal-900)]/5 border border-[var(--cloud-100)]">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${card.gradient} mb-4 flex items-center justify-center shadow-lg`}>
                    {card.icon}
                  </div>
                  <h4 className="font-display font-bold text-[var(--charcoal-900)] mb-2 text-lg">{card.title}</h4>
                  <p className="text-sm text-[var(--charcoal-800)]/80 leading-relaxed">{card.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-6 bg-gradient-to-b from-[var(--cloud-50)] to-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-4 text-[var(--charcoal-900)]">
              How It Works
            </h2>
            <p className="text-xl text-[var(--charcoal-800)] font-light max-w-2xl mx-auto">
              Three simple steps to transform how you receive gifts
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                num: "1",
                gradient: "from-[var(--lavender-400)] to-[var(--lavender-500)]",
                title: "Create Your Event",
                description: "Add items from any store, create cash funds, or let our AI suggest perfect gifts based on your interests and preferences."
              },
              {
                num: "2",
                gradient: "from-[var(--peach-400)] to-[var(--peach-500)]",
                title: "Share Your Link",
                description: "Send your beautiful registry page to friends and family via text, email, or social media. They'll love how easy it is to contribute."
              },
              {
                num: "3",
                gradient: "from-[var(--mint-300)] to-[var(--mint-400)]",
                title: "Receive & Celebrate",
                description: "Watch contributions come in real-time. Get the funds directly to buy exactly what you want, when you want it."
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                className="group relative"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--lavender-300)] to-[var(--peach-300)] rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
                <div className="relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 h-full border border-[var(--cloud-100)]">
                  <motion.div
                    className="relative w-16 h-16 mb-6"
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.2 + 0.3, type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)] opacity-20" />
                    <div className={`absolute inset-1 rounded-xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg`}>
                      <span className="text-white text-2xl font-bold font-display">{step.num}</span>
                    </div>
                  </motion.div>
                  <h3 className="text-2xl font-bold font-display mb-4 text-[var(--charcoal-900)]">{step.title}</h3>
                  <p className="text-[var(--charcoal-800)]/80 leading-relaxed font-light">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-4 text-[var(--charcoal-900)]">
              Why Choose Memora?
            </h2>
            <p className="text-xl text-[var(--charcoal-800)] font-light max-w-2xl mx-auto">
              Everything you need for the perfect gift registry experience
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                bg: "from-[var(--lavender-50)] to-[var(--peach-100)]",
                border: "border-[var(--lavender-100)]/50",
                iconBg: "from-[var(--lavender-400)] to-[var(--lavender-500)]",
                icon: (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ),
                title: "No Unwanted Gifts",
                description: "Choose exactly what you want. No more duplicate presents or items you'll never use."
              },
              {
                bg: "from-[var(--peach-100)] to-[var(--buttercream-100)]",
                border: "border-[var(--peach-200)]/50",
                iconBg: "from-[var(--peach-400)] to-[var(--peach-500)]",
                icon: (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                title: "Group Contributions",
                description: "Big gift? Everyone can chip in! Track progress in real-time and see the support roll in."
              },
              {
                bg: "from-[var(--mint-100)] to-[var(--mint-200)]",
                border: "border-[var(--mint-200)]/50",
                iconBg: "from-[var(--mint-300)] to-[var(--mint-400)]",
                icon: (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Keep All Contributions",
                description: "Even if items aren't fully funded, you keep the money. Total flexibility, zero pressure."
              },
              {
                bg: "from-[var(--buttercream-50)] to-[var(--lavender-50)]",
                border: "border-[var(--buttercream-100)]/50",
                iconBg: "from-[var(--lavender-500)] to-[var(--peach-400)]",
                icon: (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
                title: "AI Gift Suggestions",
                description: "Not sure what to add? Our AI suggests perfect gifts based on your interests and style."
              },
              {
                bg: "from-[var(--lavender-100)] to-[var(--mint-100)]",
                border: "border-[var(--lavender-100)]/50",
                iconBg: "from-[var(--lavender-400)] to-[var(--mint-400)]",
                icon: (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ),
                title: "Mobile Optimized",
                description: "Beautiful, responsive design that works perfectly on any device. Create and share on the go."
              },
              {
                bg: "from-[var(--peach-100)] to-[var(--lavender-100)]",
                border: "border-[var(--peach-100)]/50",
                iconBg: "from-[var(--peach-400)] to-[var(--lavender-500)]",
                icon: (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: "Secure & Private",
                description: "Bank-level security for all transactions. Your data is safe, and you control who sees your registry."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className={`bg-gradient-to-br ${feature.bg} rounded-2xl p-8 border ${feature.border} hover:shadow-xl transition-all duration-300`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -5 }}
              >
                <motion.div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.iconBg} flex items-center justify-center mb-6 shadow-lg`}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {feature.icon}
                </motion.div>
                <h3 className="text-xl font-bold font-display mb-3 text-[var(--charcoal-900)]">{feature.title}</h3>
                <p className="text-[var(--charcoal-800)]/80 leading-relaxed font-light">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6 overflow-hidden">
        {/* Gradient mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--lavender-100)] via-[var(--peach-100)] to-[var(--mint-100)]" />

        {/* Decorative blobs */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-[var(--buttercream-100)]/60 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-[var(--lavender-200)]/40 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold font-display text-[var(--charcoal-900)] mb-6"
          >
            Ready to Start Celebrating?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl md:text-2xl text-[var(--charcoal-800)]/80 mb-10 font-light max-w-2xl mx-auto"
          >
            Join thousands making birthdays, weddings, and every celebration more meaningful.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              href="/login"
              className="inline-block px-10 py-5 bg-[var(--lavender-500)] text-white rounded-full font-bold text-lg shadow-2xl shadow-[var(--lavender-500)]/30 hover:bg-[var(--lavender-600)] transition-colors"
            >
              Create Your Registry Now
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-[var(--charcoal-800)]/70 mt-6 text-sm font-medium"
          >
            Free forever · No credit card · Set up in 2 minutes
          </motion.p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-[var(--charcoal-900)] text-[var(--cloud-50)] py-16 px-6">
        {/* Gradient top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--lavender-400)] via-[var(--peach-400)] to-[var(--mint-400)]" />

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/memora-logo.png"
                  alt="Memora"
                  className="h-8 w-auto brightness-0 invert"
                />
                <span className="text-xl font-bold font-display text-white">Memora</span>
              </div>
              <p className="text-[var(--cloud-100)]/70 text-sm font-light">
                The modern way to create and share gift registries.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm font-light">
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Features</a></li>
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Pricing</a></li>
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Examples</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm font-light">
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">About</a></li>
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Blog</a></li>
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm font-light">
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Privacy</a></li>
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Terms</a></li>
                <li><a href="#" className="text-[var(--cloud-100)]/70 hover:text-[var(--peach-300)] transition-colors duration-200">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[var(--charcoal-800)] pt-8 text-center text-sm text-[var(--cloud-100)]/60 font-light">
            <p>© 2025 Memora. All rights reserved. Making celebrations better, one gift at a time.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
