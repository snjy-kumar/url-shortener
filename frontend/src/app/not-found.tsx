"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-6">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
          <p className="text-2xl font-semibold text-gray-700 mb-4">
            Page Not Found
          </p>
        </div>

        <p className="text-gray-600 mb-8">
          Oops! The page you are looking for does not exist or has been moved.
          Let us get you back on track.
        </p>

        <div className="space-y-4">
          <Link href="/" className="block">
            <Button className="w-full cursor-pointer" size="lg">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
          </Link>

          <Link href="/dashboard" className="block">
            <Button
              variant="outline"
              className="w-full cursor-pointer"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="mt-12 p-6 bg-white rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-3">Need help?</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact our support team or
            try again later.
          </p>
        </div>
      </div>
    </div>
  );
}
