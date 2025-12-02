"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TokenManager } from "@/lib/api";

export default function EmailVerifiedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUserData } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const success = searchParams.get("success");
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refreshToken");

    if (success === "true" && token && refreshToken) {
      // Store tokens
      TokenManager.setTokens(token, refreshToken);

      // Refresh user data
      refreshUserData()
        .then(() => {
          setStatus("success");
          setMessage("Your email has been verified successfully!");

          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push("/dashboard");
          }, 2000);
        })
        .catch((error) => {
          console.error("Error refreshing user data:", error);
          setStatus("error");
          setMessage(
            "Email verified but failed to load user data. Please try logging in."
          );
        });
    } else {
      setStatus("error");
      setMessage("Invalid verification link or verification failed.");
    }
  }, [searchParams, router, refreshUserData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Email Verification
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Processing your verification..."}
            {status === "success" && "Verification successful!"}
            {status === "error" && "Verification failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 text-blue-600 animate-spin" />
              <p className="text-gray-600">Please wait...</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="h-16 w-16 text-green-600" />
              <p className="text-center text-gray-700">{message}</p>
              <p className="text-sm text-gray-500">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 text-red-600" />
              <p className="text-center text-gray-700">{message}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => router.push("/auth/login")}
                  variant="outline"
                >
                  Go to Login
                </Button>
                <Button onClick={() => router.push("/")} variant="default">
                  Go to Home
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
