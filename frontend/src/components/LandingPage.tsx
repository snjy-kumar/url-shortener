"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Link,
  Zap,
  BarChart3,
  Shield,
  Globe,
  Smartphone,
  Users,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import UrlShortener from "@/components/UrlShortener";
import UrlManager from "@/components/UrlManager";

export function LandingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"home" | "create" | "manage">(
    "home"
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUrlCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast",
      description: "Create short URLs instantly with our optimized backend",
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Analytics & Insights",
      description: "Track clicks, geographic data, and referrer information",
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with 99.9% uptime guarantee",
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "Custom Domains",
      description: "Use your own domain for branded short URLs",
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Mobile Optimized",
      description: "Perfect experience across all devices and platforms",
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Team Collaboration",
      description: "Share and manage URLs with your team members",
    },
  ];

  const stats = [
    { number: "50M+", label: "URLs Shortened" },
    { number: "1B+", label: "Clicks Tracked" },
    { number: "100K+", label: "Active Users" },
    { number: "99.9%", label: "Uptime" },
  ];

  const pricingPlans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Perfect for personal use",
      features: [
        "1,000 URLs per month",
        "Basic analytics",
        "Custom short codes",
        "Community support",
      ],
      popular: false,
    },
    {
      name: "Pro",
      price: "$9",
      period: "/month",
      description: "For growing businesses",
      features: [
        "50,000 URLs per month",
        "Advanced analytics",
        "Custom domains",
        "Team collaboration",
        "Priority support",
        "API access",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
      features: [
        "Unlimited URLs",
        "Advanced analytics & reporting",
        "Multiple custom domains",
        "SSO integration",
        "Dedicated support",
        "SLA guarantee",
      ],
      popular: false,
    },
  ];

  if (activeTab === "create") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pt-20">
        <div className="container mx-auto px-4 py-8">
          <nav className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => setActiveTab("home")}
              className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
            >
              ← Back
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab("manage")}
              className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
            >
              Manage
            </Button>
          </nav>
          <UrlShortener onUrlCreated={handleUrlCreated} />
        </div>
      </div>
    );
  }

  if (activeTab === "manage") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pt-20">
        <div className="container mx-auto px-4 py-8">
          <nav className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => setActiveTab("home")}
              className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
            >
              ← Back
            </Button>
            <Button
              variant="outline"
              onClick={() => setActiveTab("create")}
              className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
            >
              Create
            </Button>
          </nav>
          <UrlManager key={refreshTrigger} />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 pt-16">
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Shorten URLs, Amplify Reach
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto">
            Create short, powerful links in seconds. Track analytics, customize
            aliases, and manage your digital presence with ease.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              onClick={() => setActiveTab("create")}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg cursor-pointer transition-colors"
            >
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => router.push("/auth/register")}
              variant="outline"
              className="px-8 py-3 border-2 border-blue-400 text-blue-400 hover:bg-blue-400/10 font-semibold rounded-lg cursor-pointer"
            >
              Sign Up Free
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-400 mb-2">
                  {stat.number}
                </div>
                <div className="text-slate-400 text-sm md:text-base">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-16 px-4 bg-slate-800/50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Powerful Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="p-6 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-blue-400/50 transition-colors"
              >
                <div className="text-blue-400 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Simple, Transparent Pricing
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, idx) => (
              <div
                key={idx}
                className={`p-8 rounded-lg border transition-all ${
                  plan.popular
                    ? "bg-blue-600/20 border-blue-400 shadow-lg shadow-blue-400/20"
                    : "bg-slate-700/50 border-slate-600"
                }`}
              >
                {plan.popular && (
                  <div className="mb-4 inline-block px-3 py-1 bg-blue-400 text-slate-900 text-sm font-semibold rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-slate-300">{plan.period}</span>
                </div>
                <p className="text-slate-300 mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fidx) => (
                    <li
                      key={fidx}
                      className="flex items-center gap-2 text-slate-300"
                    >
                      <CheckCircle className="w-4 h-4 text-blue-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full cursor-pointer font-semibold ${
                    plan.popular
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-slate-600 hover:bg-slate-500 text-white"
                  }`}
                >
                  Get Started
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Simplify Your Links?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of users who trust our platform for their URL
            shortening needs.
          </p>
          <Button
            onClick={() => setActiveTab("create")}
            className="px-8 py-3 bg-white hover:bg-blue-50 text-blue-600 font-semibold rounded-lg cursor-pointer"
          >
            Start Free Today
          </Button>
        </div>
      </section>
    </main>
  );
}
