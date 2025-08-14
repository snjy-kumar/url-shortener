"use client";

import React, { useState, useRef } from "react";
import { Download, Palette, Upload, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QRCodeConfig } from "@/types";

interface QRCodeGeneratorProps {
  shortCode: string;
  shortUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeGenerator({
  shortCode,
  shortUrl,
  isOpen,
  onClose,
}: QRCodeGeneratorProps) {
  const [config, setConfig] = useState<QRCodeConfig>({
    shortCode,
    size: 256,
    color: "#000000",
    backgroundColor: "#ffffff",
    format: "PNG",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [enableAR, setEnableAR] = useState(false);
  const [arData, setArData] = useState<{
    type: "business-card" | "product-preview" | "model";
    name: string;
    title: string;
    company: string;
    email: string;
    phone: string;
    website: string;
  }>({
    type: "business-card",
    name: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    website: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      // Fallback to a public QR API for demo purposes
      const color = config.color?.replace("#", "") || "000000";
      const bgcolor = config.backgroundColor?.replace("#", "") || "ffffff";
      const size = config.size || 256;

      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
        shortUrl
      )}&color=${color}&bgcolor=${bgcolor}`;

      setQrCodeUrl(qrApiUrl);
      toast.success("QR Code generated successfully!");
    } catch {
      toast.error("Failed to generate QR Code");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = async () => {
    if (!qrCodeUrl) return;

    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${shortCode}.${(config.format || "PNG").toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("QR Code downloaded!");
    } catch {
      toast.error("Failed to download QR Code");
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error("Logo file size should be less than 1MB");
        return;
      }
      setConfig({ ...config, logo: file });
      toast.success("Logo uploaded!");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            QR Code Generator
          </DialogTitle>
          <DialogDescription>
            Create a customized QR code for your short URL with optional AR
            features
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                QR Code Size
              </label>
              <Input
                type="number"
                value={config.size}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    size: parseInt(e.target.value) || 256,
                  })
                }
                min="128"
                max="512"
                step="32"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Foreground Color
              </label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.color}
                  onChange={(e) =>
                    setConfig({ ...config, color: e.target.value })
                  }
                  className="w-16 h-10 p-1 rounded"
                />
                <Input
                  type="text"
                  value={config.color}
                  onChange={(e) =>
                    setConfig({ ...config, color: e.target.value })
                  }
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Background Color
              </label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.backgroundColor}
                  onChange={(e) =>
                    setConfig({ ...config, backgroundColor: e.target.value })
                  }
                  className="w-16 h-10 p-1 rounded"
                />
                <Input
                  type="text"
                  value={config.backgroundColor}
                  onChange={(e) =>
                    setConfig({ ...config, backgroundColor: e.target.value })
                  }
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
              <select
                value={config.format}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    format: e.target.value as "PNG" | "SVG",
                  })
                }
                className="w-full p-2 border rounded-md"
              >
                <option value="PNG">PNG</option>
                <option value="SVG">SVG</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Logo (Optional)
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Logo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Max 1MB, recommended 64x64px
              </p>
            </div>

            {/* AR Options */}
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="enableAR"
                  checked={enableAR}
                  onCheckedChange={(checked) => setEnableAR(!!checked)}
                />
                <label htmlFor="enableAR" className="text-sm font-medium">
                  Enable AR Experience
                </label>
              </div>

              {enableAR && (
                <div className="space-y-3 pl-6">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      AR Type
                    </label>
                    <select
                      value={arData.type}
                      onChange={(e) =>
                        setArData({
                          ...arData,
                          type: e.target.value as
                            | "business-card"
                            | "product-preview"
                            | "model",
                        })
                      }
                      className="w-full p-2 border rounded-md text-sm"
                    >
                      <option value="business-card">Business Card</option>
                      <option value="product-preview">Product Preview</option>
                      <option value="model">3D Model</option>
                    </select>
                  </div>

                  {arData.type === "business-card" && (
                    <div className="space-y-2">
                      <Input
                        placeholder="Full Name"
                        value={arData.name}
                        onChange={(e) =>
                          setArData({ ...arData, name: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Job Title"
                        value={arData.title}
                        onChange={(e) =>
                          setArData({ ...arData, title: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Company"
                        value={arData.company}
                        onChange={(e) =>
                          setArData({ ...arData, company: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Email"
                        value={arData.email}
                        onChange={(e) =>
                          setArData({ ...arData, email: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Phone"
                        value={arData.phone}
                        onChange={(e) =>
                          setArData({ ...arData, phone: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-sm font-medium mb-3">Preview</h3>
              {qrCodeUrl ? (
                <div className="inline-block p-4 bg-gray-50 rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="max-w-full h-auto"
                    style={{ maxWidth: "200px" }}
                  />
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center"
                  style={{ height: "200px" }}
                >
                  <p className="text-gray-500 text-sm">
                    Generate QR code to preview
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                onClick={generateQRCode}
                disabled={isGenerating}
                className="w-full"
              >
                <Palette className="w-4 h-4 mr-2" />
                {isGenerating ? "Generating..." : "Generate QR Code"}
              </Button>

              {qrCodeUrl && (
                <Button
                  onClick={downloadQRCode}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </Button>
              )}
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <strong>Short URL:</strong> {shortUrl}
              </p>
              <p>
                <strong>Short Code:</strong> {shortCode}
              </p>
              {enableAR && (
                <p className="text-blue-600">
                  <strong>AR Enabled:</strong> This QR code will show an
                  interactive AR experience when scanned
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QRCodeGenerator;
