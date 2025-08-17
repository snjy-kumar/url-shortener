"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Filter,
  Download,
  Settings,
  LogOut,
  User,
  BarChart3,
  Link,
  QrCode,
  Globe,
  Lock,
  Calendar,
  TrendingUp,
  Eye,
  MousePointer,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";

import { useAuth, ProtectedRoute } from "../../contexts/AuthContext";
import { EnhancedUrlShortener } from "../../components/enhanced/EnhancedUrlShortener";
import { UrlService, QRCodeService, UrlUtils } from "../../services/urlService";
import { Url, UrlFilters, PaginationParams } from "../../types";
import toast from "react-hot-toast";

// ==================== URL LIST COMPONENT ====================

interface UrlListProps {
  urls: Url[];
  onEdit: (url: Url) => void;
  onDelete: (url: Url) => void;
  onGenerateQR: (url: Url) => void;
  isLoading?: boolean;
}

const UrlList: React.FC<UrlListProps> = ({
  urls,
  onEdit,
  onDelete,
  onGenerateQR,
  isLoading = false,
}) => {
  const copyToClipboard = async (text: string, label: string = "Link") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      console.error("Copy failed:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (urls.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Link className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No URLs yet
          </h3>
          <p className="text-gray-600 mb-4">
            Create your first short URL to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {urls.map((url) => (
        <Card key={url.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {/* URL Title and Description */}
                <div className="mb-3">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {url.title || url.shortCode}
                  </h3>
                  {url.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {url.description}
                    </p>
                  )}
                </div>

                {/* URLs */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">
                      Short:
                    </span>
                    <button
                      onClick={() => copyToClipboard(url.shortUrl)}
                      className="text-blue-600 hover:text-blue-800 font-mono text-sm truncate"
                    >
                      {url.shortUrl}
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">
                      Original:
                    </span>
                    <button
                      onClick={() => copyToClipboard(url.originalUrl)}
                      className="text-gray-600 hover:text-gray-800 text-sm truncate"
                    >
                      {UrlUtils.truncateUrl(url.originalUrl, 60)}
                    </button>
                  </div>
                </div>

                {/* Metadata Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {url.hasPassword && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Protected
                    </Badge>
                  )}
                  {url.customDomain && (
                    <Badge variant="secondary" className="text-xs">
                      <Globe className="w-3 h-3 mr-1" />
                      Custom Domain
                    </Badge>
                  )}
                  {url.expiresAt && (
                    <Badge
                      variant={
                        UrlUtils.isExpired(url.expiresAt)
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      {UrlUtils.isExpired(url.expiresAt)
                        ? "Expired"
                        : "Expires"}
                    </Badge>
                  )}
                  <Badge
                    variant={url.isActive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {url.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <MousePointer className="w-4 h-4" />
                    <span>
                      {UrlUtils.formatClickCount(url.clickCount)} clicks
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Created {UrlUtils.getRelativeTime(url.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateQR(url)}
                >
                  <QrCode className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(url.shortUrl, "_blank")}
                >
                  <Eye className="w-4 h-4" />
                </Button>

                <Button variant="outline" size="sm" onClick={() => onEdit(url)}>
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ==================== MAIN DASHBOARD COMPONENT ====================

export default function DashboardPage() {
  const [urls, setUrls] = useState<Url[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUrl, setEditingUrl] = useState<Url | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { user, logout } = useAuth();

  // Load URLs
  const loadUrls = async (page: number = 1, search?: string) => {
    try {
      setIsLoading(true);

      const params: PaginationParams & UrlFilters = {
        page,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      };

      if (search) {
        params.search = search;
      }

      const response = await UrlService.getUrls(params);

      if (response.success && response.data) {
        setUrls(response.data.urls);
        setCurrentPage(response.data.pagination.currentPage);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Failed to load URLs:", error);
      toast.error("Failed to load URLs");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadUrls();
  }, []);

  // Search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadUrls(1, searchQuery);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleUrlCreated = (url: Url) => {
    setUrls((prev) => [url, ...prev]);
    setShowCreateDialog(false);
    setEditingUrl(null);
    toast.success("URL created successfully!");
  };

  const handleUrlUpdated = (url: Url) => {
    setUrls((prev) => prev.map((u) => (u.id === url.id ? url : u)));
    setEditingUrl(null);
    toast.success("URL updated successfully!");
  };

  const handleDelete = async (url: Url) => {
    if (!confirm("Are you sure you want to delete this URL?")) return;

    try {
      await UrlService.deleteUrl(url.id);
      setUrls((prev) => prev.filter((u) => u.id !== url.id));
      toast.success("URL deleted successfully!");
    } catch (error) {
      console.error("Failed to delete URL:", error);
      toast.error("Failed to delete URL");
    }
  };

  const handleGenerateQR = async (url: Url) => {
    try {
      const response = await QRCodeService.generateQRCode({
        shortCode: url.shortCode,
        size: 256,
        format: "PNG",
      });

      if (response.success && response.data) {
        // Create download link
        const blob = await QRCodeService.downloadQRCode(url.shortCode, "PNG");
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${url.shortCode}-qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        toast.success("QR code downloaded!");
      }
    } catch (error) {
      console.error("Failed to generate QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Link className="w-8 h-8 text-blue-600 mr-3" />
                <h1 className="text-xl font-semibold text-gray-900">
                  URL Shortener
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Welcome, {user?.name || user?.email}
                </span>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="flex items-center space-x-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Total URLs
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {urls.length}
                      </p>
                    </div>
                    <Link className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Total Clicks
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {UrlUtils.formatClickCount(
                          urls.reduce((sum, url) => sum + url.clickCount, 0)
                        )}
                      </p>
                    </div>
                    <MousePointer className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Active URLs
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {urls.filter((url) => url.isActive).length}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">
                        Protected URLs
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {urls.filter((url) => url.hasPassword).length}
                      </p>
                    </div>
                    <Lock className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search URLs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
              </div>

              <Dialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
              >
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Create Short URL</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Short URL</DialogTitle>
                    <DialogDescription>
                      Create a new short URL with advanced features and
                      customization options.
                    </DialogDescription>
                  </DialogHeader>
                  <EnhancedUrlShortener onUrlCreated={handleUrlCreated} />
                </DialogContent>
              </Dialog>
            </div>

            {/* URL List */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Your URLs
                </h2>
              </div>

              <UrlList
                urls={urls}
                onEdit={setEditingUrl}
                onDelete={handleDelete}
                onGenerateQR={handleGenerateQR}
                isLoading={isLoading}
              />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => loadUrls(currentPage - 1, searchQuery)}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => loadUrls(currentPage + 1, searchQuery)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Edit URL Dialog */}
        <Dialog open={!!editingUrl} onOpenChange={() => setEditingUrl(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit URL</DialogTitle>
              <DialogDescription>
                Update your URL settings and configuration.
              </DialogDescription>
            </DialogHeader>
            {editingUrl && (
              <EnhancedUrlShortener
                editingUrl={editingUrl}
                onUrlCreated={handleUrlUpdated}
                onCancelEdit={() => setEditingUrl(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
