"use client";

import React, { useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import UrlShortener from "@/components/UrlShortener";
import UrlManager from "@/components/UrlManager";

export function LandingPage() {
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <nav className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={() => setActiveTab("home")}
                className="text-blue-600"
              >
                ← Back to Home
              </Button>
              <Button variant="ghost" onClick={() => setActiveTab("manage")}>
                Manage URLs
              </Button>
            </nav>
          </div>

          <UrlShortener onUrlCreated={handleUrlCreated} />
        </div>
      </div>
    );
  }

  if (activeTab === "manage") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <nav className="flex items-center gap-4 mb-6">
              <Button
                variant="ghost"
                onClick={() => setActiveTab("home")}
                className="text-blue-600"
              >
                ← Back to Home
              </Button>
              <Button variant="ghost" onClick={() => setActiveTab("create")}>
                Create URL
              </Button>
            </nav>
          </div>

          <UrlManager refreshTrigger={refreshTrigger} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-blue-200 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Link className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">
                UrlShortener
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setActiveTab("create")}>
                Shorten URL
              </Button>
              <Button variant="ghost" onClick={() => setActiveTab("manage")}>
                Manage URLs
              </Button>
              <Button variant="outline">Sign In</Button>
              <Button>Get Started</Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Shorten URLs, <span className="text-blue-600">Amplify Impact</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Create powerful short links with advanced analytics, custom
            branding, and enterprise-grade reliability. Perfect for marketers,
            businesses, and developers.
          </p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Button
              size="lg"
              onClick={() => setActiveTab("create")}
              className="text-lg px-8"
            >
              Start Shortening
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8">
              View Demo
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {stat.number}
                </div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Businesses
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to create, manage, and analyze your short URLs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="border-0 shadow-lg bg-white/80 backdrop-blur-sm"
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Get started in seconds with our simple process
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Paste Your URL</h3>
              <p className="text-gray-600">
                Simply paste your long URL into our shortener tool
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Customize & Create</h3>
              <p className="text-gray-600">
                Add custom aliases, descriptions, and expiration dates
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Share & Track</h3>
              <p className="text-gray-600">
                Share your short URL and track detailed analytics
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Choose the plan that fits your needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`relative ${
                  plan.popular
                    ? "border-blue-500 border-2 shadow-xl"
                    : "border-gray-200"
                } bg-white`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                  <CardDescription className="mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-center gap-3"
                      >
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full mt-6"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.name === "Enterprise"
                      ? "Contact Sales"
                      : "Get Started"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses already using our URL shortener to
            boost their marketing efforts.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => setActiveTab("create")}
              className="text-lg px-8"
            >
              Start Free Trial
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Link className="w-6 h-6" />
                <span className="text-lg font-bold">UrlShortener</span>
              </div>
              <p className="text-gray-400">
                The most powerful URL shortener for modern businesses.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentation
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Status
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 UrlShortener. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
