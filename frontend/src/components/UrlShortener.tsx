"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Copy,
  ExternalLink,
  QrCode,
  Calendar,
  Hash,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import urlService from "@/services/urlService";
import { CreateUrlRequest, Url } from "@/types";

const createUrlSchema = z.object({
  originalUrl: z.string().url("Please enter a valid URL"),
  customAlias: z.string().optional(),
  description: z.string().optional(),
  expiresAt: z.string().optional(),
});

type CreateUrlForm = z.infer<typeof createUrlSchema>;

interface UrlShortenerProps {
  onUrlCreated?: (url: Url) => void;
}

export function UrlShortener({ onUrlCreated }: UrlShortenerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<Url | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUrlForm>({
    resolver: zodResolver(createUrlSchema),
  });

  const onSubmit = async (data: CreateUrlForm) => {
    setIsLoading(true);
    try {
      const payload: CreateUrlRequest = {
        originalUrl: data.originalUrl,
        ...(data.customAlias && { customAlias: data.customAlias }),
        ...(data.description && { description: data.description }),
        ...(data.expiresAt && {
          expiresAt: new Date(data.expiresAt).toISOString(),
        }),
      };

      const response = await urlService.createShortUrl(payload);

      if (response.success && response.data) {
        setCreatedUrl(response.data);
        onUrlCreated?.(response.data);
        toast.success("Short URL created successfully!");
        reset();
      }
    } catch (error: unknown) {
      const message =
        (error instanceof Error && error.message) ||
        "Failed to create short URL";
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

  return (
    <div className="space-y-6">
      {/* URL Creation Form */}
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Shorten Your URL</CardTitle>
          <CardDescription className="text-center">
            Create short, shareable links with custom aliases and analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Original URL Input */}
            <div>
              <label className="text-sm font-medium">Long URL</label>
              <Input
                {...register("originalUrl")}
                placeholder="https://example.com/very-long-url"
                className="mt-1"
              />
              {errors.originalUrl && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.originalUrl.message}
                </p>
              )}
            </div>

            {/* Advanced Options Toggle */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full"
            >
              {showAdvanced ? "Hide" : "Show"} Advanced Options
            </Button>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-4 border-t pt-4">
                {/* Custom Alias */}
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    Custom Alias (Optional)
                  </label>
                  <Input
                    {...register("customAlias")}
                    placeholder="my-custom-link"
                    className="mt-1"
                  />
                  {errors.customAlias && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.customAlias.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    3-50 characters, letters, numbers, hyphens, and underscores
                    only
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Description (Optional)
                  </label>
                  <Textarea
                    {...register("description")}
                    placeholder="Brief description of this link"
                    className="mt-1"
                    rows={2}
                  />
                </div>

                {/* Expiration Date */}
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Expiration Date (Optional)
                  </label>
                  <Input
                    {...register("expiresAt")}
                    type="datetime-local"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty for permanent links
                  </p>
                </div>
              </div>
            )}

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Creating..." : "Shorten URL"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Created URL Display */}
      {createdUrl && (
        <Card className="w-full max-w-2xl mx-auto border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">
              URL Created Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Short URL */}
            <div>
              <label className="text-sm font-medium text-green-700">
                Short URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={createdUrl.shortUrl}
                  readOnly
                  className="bg-white border-green-300"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdUrl.shortUrl)}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openUrl(createdUrl.shortUrl)}
                  className="shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Original URL */}
            <div>
              <label className="text-sm font-medium text-green-700">
                Original URL
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={createdUrl.originalUrl}
                  readOnly
                  className="bg-white border-green-300"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => openUrl(createdUrl.originalUrl)}
                  className="shrink-0"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* URL Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-700">Short Code:</span>
                <p className="text-gray-600">{createdUrl.shortCode}</p>
              </div>
              <div>
                <span className="font-medium text-green-700">Created:</span>
                <p className="text-gray-600">
                  {new Date(createdUrl.createdAt).toLocaleDateString()}
                </p>
              </div>
              {createdUrl.customAlias && (
                <div>
                  <span className="font-medium text-green-700">
                    Custom Alias:
                  </span>
                  <p className="text-gray-600">{createdUrl.customAlias}</p>
                </div>
              )}
              {createdUrl.expiresAt && (
                <div>
                  <span className="font-medium text-green-700">Expires:</span>
                  <p className="text-gray-600">
                    {new Date(createdUrl.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {createdUrl.description && (
              <div>
                <span className="font-medium text-green-700">Description:</span>
                <p className="text-gray-600 mt-1">{createdUrl.description}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreatedUrl(null)}
                className="flex-1"
              >
                Create Another
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => toast("QR Code generation coming soon!")}
              >
                <QrCode className="w-4 h-4" />
                QR Code
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default UrlShortener;
