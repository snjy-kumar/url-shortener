"use client";

import React, { useState, useEffect } from "react";
import {
  Lightbulb,
  TrendingUp,
  Target,
  Clock,
  X,
  Plus,
  Sparkles,
  Bell,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import urlService from "@/services/urlService";
import { PersonalizedRecommendation, Url } from "@/types";

interface PersonalizedRecommendationsProps {
  onUrlCreated?: (url: Url) => void;
}

export function PersonalizedRecommendations({
  onUrlCreated,
}: PersonalizedRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<
    PersonalizedRecommendation[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingRecommendation, setProcessingRecommendation] = useState<
    string | null
  >(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const response = await urlService.getRecommendations();
      if (response.success && response.data) {
        setRecommendations(response.data);
      }
    } catch (error) {
      // Fallback mock data for demonstration
      const mockRecommendations: PersonalizedRecommendation[] = [
        {
          id: "1",
          type: "trending-topic",
          title: "Create a Black Friday Sale Link",
          description:
            "Black Friday is trending! Create a link for your sales campaign with optimized timing.",
          suggestedSlug: "black-friday-2024",
          targetUrl: "https://example.com/sale",
          priority: "high",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          type: "campaign-optimization",
          title: "Optimize Your Product Launch Link",
          description:
            "Based on your analytics, we suggest creating a new link with better engagement timing.",
          suggestedSlug: "product-launch-v2",
          priority: "medium",
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          id: "3",
          type: "audience-target",
          title: "Target Mobile Users",
          description:
            "Your analytics show 70% mobile traffic. Create a mobile-optimized landing page link.",
          suggestedSlug: "mobile-landing",
          priority: "medium",
          expiresAt: new Date(
            Date.now() + 3 * 24 * 60 * 60 * 1000
          ).toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          id: "4",
          type: "seasonal",
          title: "Valentine's Day Campaign",
          description:
            "Prepare for Valentine's Day with a romantic-themed campaign link.",
          suggestedSlug: "valentines-special",
          priority: "low",
          expiresAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];
      setRecommendations(mockRecommendations);
      console.warn("Using mock recommendations data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecommendedLink = async (
    recommendation: PersonalizedRecommendation
  ) => {
    setProcessingRecommendation(recommendation.id);
    try {
      const response = await urlService.createRecommendedLink(
        recommendation.id
      );
      if (response.success && response.data) {
        onUrlCreated?.(response.data);
        toast.success("Recommended link created successfully!");
        // Remove the recommendation after creating
        setRecommendations((prev) =>
          prev.filter((r) => r.id !== recommendation.id)
        );
      }
    } catch (error) {
      toast.error("Failed to create recommended link");
      console.error("Error creating recommended link:", error);
    } finally {
      setProcessingRecommendation(null);
    }
  };

  const handleDismissRecommendation = async (recommendationId: string) => {
    try {
      await urlService.dismissRecommendation(recommendationId);
      setRecommendations((prev) =>
        prev.filter((r) => r.id !== recommendationId)
      );
      toast.success("Recommendation dismissed");
    } catch (error) {
      toast.error("Failed to dismiss recommendation");
      console.error("Error dismissing recommendation:", error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-red-200 bg-red-50";
      case "medium":
        return "border-yellow-200 bg-yellow-50";
      case "low":
        return "border-blue-200 bg-blue-50";
      default:
        return "border-gray-200 bg-gray-50";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "medium":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "low":
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "trending-topic":
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case "campaign-optimization":
        return <Target className="w-5 h-5 text-blue-600" />;
      case "audience-target":
        return <Sparkles className="w-5 h-5 text-purple-600" />;
      case "seasonal":
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Lightbulb className="w-5 h-5 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Personalized Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Personalized Recommendations
          </CardTitle>
          <CardDescription>
            AI-powered suggestions to optimize your link performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              No recommendations available at the moment
            </p>
            <Button onClick={fetchRecommendations} variant="outline">
              Check for New Recommendations
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Personalized Recommendations
              {recommendations.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">
                  {recommendations.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              AI-powered suggestions to optimize your link performance
            </CardDescription>
          </div>
          <Button onClick={fetchRecommendations} variant="outline" size="sm">
            <Sparkles className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((recommendation) => (
            <div
              key={recommendation.id}
              className={`p-4 rounded-lg border-2 ${getPriorityColor(
                recommendation.priority
              )}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="flex-shrink-0">
                    {getTypeIcon(recommendation.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {recommendation.title}
                      </h3>
                      <div className="flex items-center gap-1">
                        {getPriorityIcon(recommendation.priority)}
                        <span className="text-xs font-medium capitalize">
                          {recommendation.priority}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {recommendation.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        Suggested slug:{" "}
                        <code className="bg-gray-200 px-1 py-0.5 rounded">
                          {recommendation.suggestedSlug}
                        </code>
                      </span>
                      {recommendation.targetUrl && (
                        <span>
                          Target:{" "}
                          <code className="bg-gray-200 px-1 py-0.5 rounded">
                            {recommendation.targetUrl}
                          </code>
                        </span>
                      )}
                      <span>
                        Expires:{" "}
                        {format(
                          new Date(recommendation.expiresAt),
                          "MMM dd, yyyy"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    onClick={() => handleCreateRecommendedLink(recommendation)}
                    disabled={processingRecommendation === recommendation.id}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {processingRecommendation === recommendation.id ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Plus className="w-3 h-3" />
                        Create Link
                      </span>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      handleDismissRecommendation(recommendation.id)
                    }
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">
                Recommendation Stats
              </h4>
              <p className="text-sm text-gray-600">
                {recommendations.filter((r) => r.priority === "high").length}{" "}
                high priority,{" "}
                {recommendations.filter((r) => r.priority === "medium").length}{" "}
                medium priority,{" "}
                {recommendations.filter((r) => r.priority === "low").length} low
                priority
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {recommendations.length}
              </div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PersonalizedRecommendations;
