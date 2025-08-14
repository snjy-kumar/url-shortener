"use client";

import React, { useState, useEffect } from "react";
import {
  Copy,
  ExternalLink,
  Trash2,
  Calendar,
  BarChart3,
  Hash,
  Clock,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import urlService from "@/services/urlService";
import { Url } from "@/types";

interface UrlManagerProps {
  refreshTrigger?: number;
}

export function UrlManager({ refreshTrigger }: UrlManagerProps) {
  const [urls, setUrls] = useState<Url[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUrls = async () => {
    try {
      setLoading(true);
      const response = await urlService.getUrls(
        currentPage,
        10,
        sortBy,
        sortOrder
      );

      if (response.success) {
        setUrls(response.data.urls);
        setTotalPages(response.data.pagination.totalPages);
        setTotalCount(response.data.pagination.totalCount);
      }
    } catch (error) {
      toast.error("Failed to fetch URLs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, [currentPage, sortBy, sortOrder, refreshTrigger]);

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

  const deleteUrl = async (shortCode: string) => {
    if (!confirm("Are you sure you want to delete this URL?")) return;

    try {
      const response = await urlService.deleteUrl(shortCode);
      if (response.success) {
        toast.success("URL deleted successfully");
        fetchUrls();
      }
    } catch (error) {
      toast.error("Failed to delete URL");
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const filteredUrls = urls.filter(
    (url) =>
      url.originalUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      url.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (url.description &&
        url.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading URLs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Manage URLs</CardTitle>
              <CardDescription>
                {totalCount} total URLs • Page {currentPage} of {totalPages}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split("-");
                  setSortBy(field);
                  setSortOrder(order as "asc" | "desc");
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="clickCount-desc">Most Clicks</option>
                <option value="clickCount-asc">Least Clicks</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search URLs, short codes, or descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* URLs List */}
      <div className="space-y-4">
        {filteredUrls.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              {searchTerm
                ? "No URLs found matching your search."
                : "No URLs created yet."}
            </CardContent>
          </Card>
        ) : (
          filteredUrls.map((url) => (
            <Card
              key={url.id}
              className={`${
                isExpired(url.expiresAt) ? "opacity-60 border-red-200" : ""
              }`}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* URL Info */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-sm font-medium">
                            {url.shortCode}
                          </span>
                          {url.customAlias && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Custom
                            </span>
                          )}
                          {isExpired(url.expiresAt) && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <ExternalLink className="w-4 h-4" />
                          <span className="truncate">{url.originalUrl}</span>
                        </div>
                        {url.description && (
                          <p className="text-sm text-gray-600">
                            {url.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(url.shortUrl)}
                          title="Copy short URL"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openUrl(url.shortUrl)}
                          title="Open short URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toast.info("Analytics coming soon!")}
                          title="View analytics"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteUrl(url.shortCode)}
                          title="Delete URL"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Short URL */}
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-mono text-blue-600">
                          {url.shortUrl}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(url.shortUrl)}
                          className="text-xs"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        <span>{url.clickCount} clicks</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          Created{" "}
                          {format(new Date(url.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      {url.expiresAt && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            Expires{" "}
                            {format(new Date(url.expiresAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default UrlManager;
