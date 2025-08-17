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
  Eye,
  EyeOff,
  Globe,
  Lock,
  Calendar,
  Settings,
  ChevronDown,
  ChevronUp,
  Save,
  Share2,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import Image from "next/image";

import { useAuth } from "../../contexts/AuthContext";
import { UrlService, QRCodeService, UrlUtils } from "../../services/urlService";
import { CreateUrlRequest, Url, QRCodeConfig } from "../../types";

// ==================== VALIDATION SCHEMA ====================

const createUrlSchema = z.object({
  originalUrl: z
    .string()
    .url("Please enter a valid URL")
    .min(1, "URL is required"),
  customAlias: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[a-zA-Z0-9_-]+$/.test(val),
      "Custom alias can only contain letters, numbers, underscores, and hyphens"
    ),
  customDomain: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val),
      "Please enter a valid domain"
    ),
  title: z
    .string()
    .max(100, "Title must be less than 100 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  password: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.length >= 6,
      "Password must be at least 6 characters"
    ),
  expiresAt: z.string().optional(),
  generateQR: z.boolean().optional(),
});

type CreateUrlForm = z.infer<typeof createUrlSchema>;

// ==================== MAIN COMPONENT ====================

interface EnhancedUrlShortenerProps {
  onUrlCreated?: (url: Url) => void;
  editingUrl?: Url;
  onCancelEdit?: () => void;
  className?: string;
}

export const EnhancedUrlShortener: React.FC<EnhancedUrlShortenerProps> = ({
  onUrlCreated,
  editingUrl,
  onCancelEdit,
  className = "",
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<Url | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);

  const { isAuthenticated, user } = useAuth();
  const isEditing = !!editingUrl;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CreateUrlForm>({
    resolver: zodResolver(createUrlSchema),
    defaultValues: {
      originalUrl: editingUrl?.originalUrl || "",
      customAlias: editingUrl?.customAlias || "",
      customDomain: editingUrl?.customDomain || "",
      title: editingUrl?.title || "",
      description: editingUrl?.description || "",
      password: "",
      expiresAt: editingUrl?.expiresAt
        ? new Date(editingUrl.expiresAt).toISOString().slice(0, 16)
        : "",
      generateQR: false,
    },
  });

  const watchedUrl = watch("originalUrl");
  const watchedAlias = watch("customAlias");
  const watchedPassword = watch("password");
  const watchedExpiresAt = watch("expiresAt");

  // Reset form when editing changes
  useEffect(() => {
    if (editingUrl) {
      setValue("originalUrl", editingUrl.originalUrl);
      setValue("customAlias", editingUrl.customAlias || "");
      setValue("customDomain", editingUrl.customDomain || "");
      setValue("title", editingUrl.title || "");
      setValue("description", editingUrl.description || "");
      setValue(
        "expiresAt",
        editingUrl.expiresAt
          ? new Date(editingUrl.expiresAt).toISOString().slice(0, 16)
          : ""
      );
      setShowAdvanced(true);
    }
  }, [editingUrl, setValue]);

  // Generate short code preview
  const generatePreview = () => {
    if (watchedAlias) {
      return watchedAlias;
    }
    return UrlUtils.generateShortCode(6);
  };

  const onSubmit = async (data: CreateUrlForm) => {
    try {
      setIsLoading(true);

      const urlData: CreateUrlRequest = {
        originalUrl: data.originalUrl,
        title: data.title,
        description: data.description,
      };

      if (data.customAlias) urlData.customAlias = data.customAlias;
      if (data.customDomain) urlData.customDomain = data.customDomain;
      if (data.password) urlData.password = data.password;
      if (data.expiresAt)
        urlData.expiresAt = new Date(data.expiresAt).toISOString();

      let result: Url;

      if (isEditing && editingUrl) {
        // Update existing URL
        const response = await UrlService.updateUrl(editingUrl.id, urlData);
        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to update URL");
        }
        result = response.data;
        toast.success("URL updated successfully!");
      } else {
        // Create new URL
        const response = await UrlService.createUrl(urlData);
        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to create URL");
        }
        result = response.data;
        toast.success("Short URL created successfully!");
      }

      setCreatedUrl(result);

      // Generate QR code if requested
      if (data.generateQR && !isEditing) {
        await generateQRCode(result.shortCode);
      }

      // Call callback
      if (onUrlCreated) {
        onUrlCreated(result);
      }

      // Reset form for new URLs
      if (!isEditing) {
        reset();
        setShowAdvanced(false);
      }
    } catch (error) {
      console.error("URL creation/update error:", error);
      const errorMessage = (error as Error).message || "An error occurred";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const generateQRCode = async (shortCode: string) => {
    try {
      const qrConfig: QRCodeConfig = {
        shortCode,
        size: 256,
        format: "PNG",
        color: "#000000",
        backgroundColor: "#FFFFFF",
      };

      const response = await QRCodeService.generateQRCode(qrConfig);
      if (response.success && response.data) {
        setQrCodeData(response.data.qrCodeData);
        setShowQRDialog(true);
      }
    } catch (error) {
      console.error("QR code generation error:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const copyToClipboard = async (text: string, label: string = "Link") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const downloadQRCode = async () => {
    if (!createdUrl) return;

    try {
      const blob = await QRCodeService.downloadQRCode(
        createdUrl.shortCode,
        "PNG"
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${createdUrl.shortCode}-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("QR code downloaded!");
    } catch (error) {
      console.error("QR download error:", error);
      toast.error("Failed to download QR code");
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Hash className="w-5 h-5 text-blue-600" />
            <span>{isEditing ? "Edit URL" : "Create Short URL"}</span>
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Update your existing short URL settings"
              : "Enter a long URL to create a short, shareable link"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="originalUrl" className="text-sm font-medium">
                Original URL *
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  id="originalUrl"
                  type="url"
                  placeholder="https://example.com/very-long-url"
                  className="pl-10"
                  {...register("originalUrl")}
                  disabled={isLoading}
                />
              </div>
              {errors.originalUrl && (
                <p className="text-sm text-red-600">
                  {errors.originalUrl.message}
                </p>
              )}
            </div>

            {/* URL Preview */}
            {watchedUrl && UrlUtils.isValidUrl(watchedUrl) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  Preview:{" "}
                  {process.env.NEXT_PUBLIC_APP_URL || "https://short.ly"}/
                  {generatePreview()}
                </p>
              </div>
            )}

            {/* Advanced Options Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center space-x-1"
                >
                  <Settings className="w-4 h-4" />
                  <span>Advanced Options</span>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>

                {isAuthenticated && (
                  <span className="text-xs text-green-600 flex items-center space-x-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>Signed in as {user?.email}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Custom Alias */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="customAlias"
                      className="text-sm font-medium"
                    >
                      Custom Alias
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="customAlias"
                        placeholder="my-custom-link"
                        className="pl-10"
                        {...register("customAlias")}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.customAlias && (
                      <p className="text-sm text-red-600">
                        {errors.customAlias.message}
                      </p>
                    )}
                  </div>

                  {/* Custom Domain */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="customDomain"
                      className="text-sm font-medium"
                    >
                      Custom Domain
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="customDomain"
                        placeholder="mydomain.com"
                        className="pl-10"
                        {...register("customDomain")}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.customDomain && (
                      <p className="text-sm text-red-600">
                        {errors.customDomain.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Title (Optional)
                  </Label>
                  <Input
                    id="title"
                    placeholder="Give your link a memorable title"
                    {...register("title")}
                    disabled={isLoading}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this link is about"
                    rows={3}
                    {...register("description")}
                    disabled={isLoading}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600">
                      {errors.description.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Password Protection */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password Protection
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Set a password (optional)"
                        className="pl-10 pr-10"
                        {...register("password")}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-red-600">
                        {errors.password.message}
                      </p>
                    )}
                    {watchedPassword && (
                      <p className="text-xs text-blue-600">
                        🔒 This link will require a password to access
                      </p>
                    )}
                  </div>

                  {/* Expiration Date */}
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt" className="text-sm font-medium">
                      Expiration Date
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <Input
                        id="expiresAt"
                        type="datetime-local"
                        className="pl-10"
                        {...register("expiresAt")}
                        disabled={isLoading}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                    {watchedExpiresAt && (
                      <p className="text-xs text-orange-600">
                        ⏰ This link will expire on{" "}
                        {new Date(watchedExpiresAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* QR Code Generation */}
                {!isEditing && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="generateQR"
                      {...register("generateQR")}
                      disabled={isLoading}
                    />
                    <Label htmlFor="generateQR" className="text-sm font-medium">
                      Generate QR Code automatically
                    </Label>
                  </div>
                )}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center space-x-3">
              <Button
                type="submit"
                disabled={isLoading || (!isDirty && isEditing)}
                className="flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{isEditing ? "Updating..." : "Creating..."}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{isEditing ? "Update URL" : "Create Short URL"}</span>
                  </>
                )}
              </Button>

              {isEditing && onCancelEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelEdit}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              )}

              {!isAuthenticated && (
                <p className="text-xs text-gray-500">
                  <a
                    href="/auth/login"
                    className="text-blue-600 hover:underline"
                  >
                    Sign in
                  </a>{" "}
                  to access advanced features and analytics
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Result Card */}
      {createdUrl && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center space-x-2">
              <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                ✓
              </span>
              <span>{isEditing ? "URL Updated!" : "Short URL Created!"}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Short URL Display */}
            <div className="p-4 bg-white border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">Your short URL:</p>
                  <p className="text-lg font-mono text-gray-900 break-all">
                    {createdUrl.shortUrl}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(createdUrl.shortUrl)}
                  className="ml-4"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* URL Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Clicks:</span>
                <span className="ml-2 font-medium">
                  {createdUrl.clickCount}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Created:</span>
                <span className="ml-2 font-medium">
                  {UrlUtils.getRelativeTime(createdUrl.createdAt)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <span
                  className={`ml-2 font-medium ${
                    createdUrl.isActive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {createdUrl.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateQRCode(createdUrl.shortCode)}
              >
                <QrCode className="w-4 h-4 mr-1" />
                Generate QR
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(createdUrl.shortUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(createdUrl.originalUrl, "Original URL")
                }
              >
                <Share2 className="w-4 h-4 mr-1" />
                Copy Original
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code Generated</DialogTitle>
            <DialogDescription>
              Scan this QR code to access your short URL
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {qrCodeData && (
              <div className="flex justify-center">
                <Image
                  src={qrCodeData}
                  alt="QR Code"
                  width={256}
                  height={256}
                  className="border border-gray-200 rounded-lg"
                />
              </div>
            )}

            <div className="flex space-x-2">
              <Button onClick={downloadQRCode} className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Download PNG
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  createdUrl && copyToClipboard(createdUrl.shortUrl)
                }
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy URL
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnhancedUrlShortener;
