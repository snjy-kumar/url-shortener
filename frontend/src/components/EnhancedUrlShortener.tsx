"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Copy,
  ExternalLink,
  QrCode,
  Hash,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { urlService } from "@/services/urlService";
import { CreateUrlRequest, Url, AIOptimization } from "@/types";
import { QRCodeGenerator } from "./QRCodeGenerator";

const createUrlSchema = z.object({
  originalUrl: z.string().url("Please enter a valid URL"),
  customAlias: z.string().optional(),
  customDomain: z.string().optional(),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
  password: z.string().optional(),
  enableExpiration: z.boolean().optional(),
  enablePassword: z.boolean().optional(),
});

type CreateUrlForm = z.infer<typeof createUrlSchema>;

interface EnhancedUrlShortenerProps {
  onUrlCreated?: (url: Url) => void;
}

export function EnhancedUrlShortener({
  onUrlCreated,
}: EnhancedUrlShortenerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<Url | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [aiOptimization, setAIOptimization] = useState<AIOptimization | null>(
    null
  );
  const [isGettingAISuggestions, setIsGettingAISuggestions] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateUrlForm>({
    resolver: zodResolver(createUrlSchema),
    defaultValues: {
      enableExpiration: false,
      enablePassword: false,
    },
  });

  const watchedUrl = watch("originalUrl");
  const watchedAlias = watch("customAlias");
  const enableExpiration = watch("enableExpiration");
  const enablePassword = watch("enablePassword");

  // Get AI suggestions when URL changes
  useEffect(() => {
    const getAISuggestions = async () => {
      if (watchedUrl && watchedUrl.length > 10) {
        try {
          setIsGettingAISuggestions(true);
          const response = await urlService.getAIOptimization(watchedUrl);
          if (response.success && response.data) {
            setAIOptimization(response.data);
          }
        } catch {
          console.error("Failed to get AI suggestions");
        } finally {
          setIsGettingAISuggestions(false);
        }
      }
    };

    const debounceTimer = setTimeout(getAISuggestions, 1000);
    return () => clearTimeout(debounceTimer);
  }, [watchedUrl]);

  const onSubmit = async (data: CreateUrlForm) => {
    setIsLoading(true);
    try {
      const payload: CreateUrlRequest = {
        originalUrl: data.originalUrl,
        ...(data.customAlias && { customAlias: data.customAlias }),
        ...(data.customDomain && { customDomain: data.customDomain }),
        ...(data.description && { description: data.description }),
        ...(data.enableExpiration &&
          data.expiresAt && {
            expiresAt: new Date(data.expiresAt).toISOString(),
          }),
        ...(data.enablePassword &&
          data.password && { password: data.password }),
      };

      const response = await urlService.createShortUrl(payload);

      if (response.success && response.data) {
        setCreatedUrl(response.data);
        onUrlCreated?.(response.data);
        toast.success("Short URL created successfully!");
        reset();
        setAIOptimization(null);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message || "Failed to create short URL"
          : "Failed to create short URL";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const openUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const applySuggestedSlug = (slug: string) => {
    setValue("customAlias", slug);
    toast.success("AI suggestion applied!");
  };

  const generateShortUrl = (
    baseUrl: string,
    alias?: string,
    domain?: string
  ) => {
    const selectedDomain = domain || "short.ly";
    return `https://${selectedDomain}/${alias || "abc123"}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Create Short URL
          </CardTitle>
          <CardDescription>
            Transform long URLs into short, manageable links with advanced
            features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Original URL *</label>
              <Input
                {...register("originalUrl")}
                placeholder="https://example.com/very-long-url"
                className="w-full"
              />
              {errors.originalUrl && (
                <p className="text-sm text-red-500">
                  {errors.originalUrl.message}
                </p>
              )}
            </div>

            {/* AI Optimization Panel */}
            {aiOptimization && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">
                    AI Suggestions
                  </h3>
                </div>
                {isGettingAISuggestions ? (
                  <p className="text-sm text-blue-600">
                    Getting AI suggestions...
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-blue-700 mb-2">
                        Suggested Slugs:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {aiOptimization.suggestedSlugs.map((slug, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => applySuggestedSlug(slug)}
                            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md border border-blue-300"
                          >
                            {slug}
                          </button>
                        ))}
                      </div>
                    </div>
                    {aiOptimization.bestSharingTimes.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-blue-700 mb-2">
                          Best Sharing Times:
                        </p>
                        <div className="space-y-1">
                          {aiOptimization.bestSharingTimes
                            .slice(0, 3)
                            .map((time, index) => (
                              <p key={index} className="text-sm text-blue-600">
                                {time.platform}: {time.time} (Score:{" "}
                                {time.score})
                              </p>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Preview */}
            {(watchedUrl || watchedAlias) && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Preview:</p>
                <p className="font-mono text-sm">
                  {generateShortUrl(
                    "short.ly",
                    watchedAlias,
                    watch("customDomain")
                  )}
                </p>
              </div>
            )}

            {/* Basic Customization */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Alias</label>
                <Input
                  {...register("customAlias")}
                  placeholder="my-custom-link"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Leave empty for auto-generated alias
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Domain</label>
                <Input
                  {...register("customDomain")}
                  placeholder="brand.co"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">Use your branded domain</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Description (Optional)
              </label>
              <Textarea
                {...register("description")}
                placeholder="Campaign description or notes"
                className="w-full"
                rows={2}
              />
            </div>

            {/* Advanced Options Toggle */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full"
            >
              {showAdvanced ? <ChevronUp /> : <ChevronDown />}
              Advanced Options
            </Button>

            {showAdvanced && (
              <div className="space-y-4 p-4 border rounded-lg">
                {/* Expiration Date */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enableExpiration"
                      checked={enableExpiration}
                      onCheckedChange={(checked) =>
                        setValue("enableExpiration", !!checked)
                      }
                    />
                    <label
                      htmlFor="enableExpiration"
                      className="text-sm font-medium"
                    >
                      Set Expiration Date
                    </label>
                  </div>
                  {enableExpiration && (
                    <Input
                      {...register("expiresAt")}
                      type="datetime-local"
                      className="w-full"
                    />
                  )}
                </div>

                {/* Password Protection */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enablePassword"
                      checked={enablePassword}
                      onCheckedChange={(checked) =>
                        setValue("enablePassword", !!checked)
                      }
                    />
                    <label
                      htmlFor="enablePassword"
                      className="text-sm font-medium"
                    >
                      Password Protection
                    </label>
                  </div>
                  {enablePassword && (
                    <Input
                      {...register("password")}
                      type="password"
                      placeholder="Enter password"
                      className="w-full"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Creating..." : "Create Short URL"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Created URL Display */}
      {createdUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">
              URL Created Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <code className="flex-1 text-sm">{createdUrl.shortUrl}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(createdUrl.shortUrl)}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openUrl(createdUrl.shortUrl)}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowQRGenerator(true)}
                className="flex-1"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR Code
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(`/analytics/${createdUrl.shortCode}`, "_blank")
                }
                className="flex-1"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Generator Modal */}
      {showQRGenerator && createdUrl && (
        <QRCodeGenerator
          shortCode={createdUrl.shortCode}
          shortUrl={createdUrl.shortUrl}
          isOpen={showQRGenerator}
          onClose={() => setShowQRGenerator(false)}
        />
      )}
    </div>
  );
}

export default EnhancedUrlShortener;
