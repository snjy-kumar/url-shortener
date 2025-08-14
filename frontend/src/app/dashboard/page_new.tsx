"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  BarChart3,
  Link,
  Settings,
  User,
  Search,
  Filter,
  Download,
  ExternalLink,
  Copy,
  Edit,
  Trash2,
  QrCode,
  Eye,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import urlService from "@/services/urlService";
import { Url, UrlListResponse } from "@/types";
import EnhancedUrlShortener from "@/components/EnhancedUrlShortener";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import PersonalizedRecommendations from "@/components/PersonalizedRecommendations";
import QRCodeGenerator from "@/components/QRCodeGenerator";

export default function Dashboard() {
  const [urls, setUrls] = useState<Url[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<Url | null>(null);
  const [activeTab, setActiveTab] = useState("create");
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [qrUrl, setQrUrl] = useState<Url | null>(null);

  const fetchUrls = useCallback(async () => {
    setIsLoading(true);
    try {
      const response: UrlListResponse = await urlService.getUrls(
        pagination.currentPage,
        10,
        "createdAt",
        "desc"
      );

      if (response.success && response.data) {
        setUrls(response.data.urls);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      // Fallback mock data for demonstration
      const mockUrls: Url[] = [
        {
          id: "1",
          shortCode: "abc123",
          originalUrl:
            "https://example.com/very-long-url-that-needs-shortening",
          shortUrl: "https://short.ly/abc123",
          customAlias: "example-link",
          description: "Example demonstration link",
          clickCount: 142,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "2",
          shortCode: "xyz789",
          originalUrl: "https://docs.example.com/api/documentation",
          shortUrl: "https://short.ly/xyz789",
          customAlias: "api-docs",
          description: "API Documentation",
          clickCount: 89,
          isActive: true,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "3",
          shortCode: "def456",
          originalUrl: "https://blog.example.com/how-to-use-url-shortener",
          shortUrl: "https://short.ly/def456",
          description: "Blog post about URL shortening",
          clickCount: 234,
          isActive: true,
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          createdAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
          updatedAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      ];
      setUrls(mockUrls);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: mockUrls.length,
        hasNext: false,
        hasPrev: false,
      });
      console.warn("Using mock URLs data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.currentPage]);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls, searchTerm]);

  const handleUrlCreated = (newUrl: Url) => {
    setUrls((prev) => [newUrl, ...prev]);
    toast.success("URL created successfully!");
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied to clipboard!");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleDeleteUrl = async (shortCode: string) => {
    if (!confirm("Are you sure you want to delete this URL?")) return;

    try {
      await urlService.deleteUrl(shortCode);
      setUrls((prev) => prev.filter((url) => url.shortCode !== shortCode));
      toast.success("URL deleted successfully!");
    } catch {
      toast.error("Failed to delete URL");
    }
  };

  const openAnalytics = (url: Url) => {
    setSelectedUrl(url);
    setShowAnalytics(true);
  };

  const openQRGenerator = (url: Url) => {
    setQrUrl(url);
    setShowQRGenerator(true);
  };

  const filteredUrls = urls.filter(
    (url) =>
      url.originalUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      url.customAlias?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      url.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalClicks = urls.reduce((sum, url) => sum + url.clickCount, 0);
  const activeUrls = urls.filter((url) => url.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Link className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">
                  URL Shortener
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total URLs
                  </p>
                  <p className="text-2xl font-bold">{urls.length}</p>
                </div>
                <Link className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Clicks
                  </p>
                  <p className="text-2xl font-bold">
                    {totalClicks.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Active URLs
                  </p>
                  <p className="text-2xl font-bold">{activeUrls}</p>
                </div>
                <Eye className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Avg. Clicks
                  </p>
                  <p className="text-2xl font-bold">
                    {urls.length > 0
                      ? Math.round(totalClicks / urls.length)
                      : 0}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create URL
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              Manage URLs
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="recommendations"
              className="flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Recommendations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <EnhancedUrlShortener onUrlCreated={handleUrlCreated} />
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Manage URLs</CardTitle>
                    <CardDescription>
                      View and manage all your shortened URLs
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search URLs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Filter className="w-4 h-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredUrls.length === 0 ? (
                  <div className="text-center py-8">
                    <Link className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No URLs found</p>
                    <Button onClick={() => setActiveTab("create")}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First URL
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredUrls.map((url) => (
                      <div
                        key={url.id}
                        className="border rounded-lg p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">
                                {url.customAlias || url.shortCode}
                              </h3>
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                {url.clickCount} clicks
                              </span>
                              {url.expiresAt && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                  <Calendar className="w-3 h-3 inline mr-1" />
                                  Expires{" "}
                                  {format(new Date(url.expiresAt), "MMM dd")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {url.originalUrl}
                            </p>
                            <p className="text-sm font-mono text-blue-600 mb-2">
                              {url.shortUrl}
                            </p>
                            {url.description && (
                              <p className="text-sm text-gray-500">
                                {url.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>
                                Created{" "}
                                {format(
                                  new Date(url.createdAt),
                                  "MMM dd, yyyy"
                                )}
                              </span>
                              <span>
                                Updated{" "}
                                {format(
                                  new Date(url.updatedAt),
                                  "MMM dd, yyyy"
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopyUrl(url.shortUrl)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(url.shortUrl, "_blank")
                              }
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openQRGenerator(url)}
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAnalytics(url)}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteUrl(url.shortCode)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {selectedUrl ? (
              <AnalyticsDashboard url={selectedUrl} />
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">
                    Select a URL to view its analytics
                  </p>
                  <Button onClick={() => setActiveTab("manage")}>
                    Go to Manage URLs
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <PersonalizedRecommendations onUrlCreated={handleUrlCreated} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Analytics Modal */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analytics Dashboard</DialogTitle>
          </DialogHeader>
          {selectedUrl && <AnalyticsDashboard url={selectedUrl} />}
        </DialogContent>
      </Dialog>

      {/* QR Code Generator Modal */}
      {showQRGenerator && qrUrl && (
        <QRCodeGenerator
          shortCode={qrUrl.shortCode}
          shortUrl={qrUrl.shortUrl}
          isOpen={showQRGenerator}
          onClose={() => setShowQRGenerator(false)}
        />
      )}
    </div>
  );
}
