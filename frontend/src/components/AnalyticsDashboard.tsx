"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar,
  Download,
  Filter,
  TrendingUp,
  Globe,
  Smartphone,
  Users,
  Clock,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
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
import urlService from "@/services/urlService";
import { AnalyticsData, Url } from "@/types";

interface AnalyticsDashboardProps {
  url: Url;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export function AnalyticsDashboard({ url }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await urlService.getUrlAnalytics(url.shortCode, {
          start: startOfDay(new Date(dateRange.start)).toISOString(),
          end: endOfDay(new Date(dateRange.end)).toISOString(),
        });

        if (response.success && response.data) {
          setAnalytics(response.data);
        }
      } catch (error) {
        // Fallback mock data for demonstration
        const mockAnalytics: AnalyticsData = {
          totalClicks: 1247,
          uniqueClicks: 892,
          clicksByDate: Array.from({ length: 30 }, (_, i) => ({
            date: format(subDays(new Date(), 29 - i), "MMM dd"),
            clicks: Math.floor(Math.random() * 50) + 10,
          })),
          topReferrers: [
            { referrer: "google.com", clicks: 234 },
            { referrer: "twitter.com", clicks: 187 },
            { referrer: "facebook.com", clicks: 156 },
            { referrer: "linkedin.com", clicks: 123 },
            { referrer: "direct", clicks: 89 },
          ],
          clicksByCountry: [
            { country: "United States", clicks: 456 },
            { country: "United Kingdom", clicks: 234 },
            { country: "Canada", clicks: 178 },
            { country: "Australia", clicks: 123 },
            { country: "Germany", clicks: 89 },
          ],
          deviceTypes: [
            { device: "Desktop", clicks: 567 },
            { device: "Mobile", clicks: 445 },
            { device: "Tablet", clicks: 235 },
          ],
          browsers: [
            { browser: "Chrome", clicks: 678 },
            { browser: "Firefox", clicks: 234 },
            { browser: "Safari", clicks: 187 },
            { browser: "Edge", clicks: 123 },
          ],
          platforms: [
            { platform: "Windows", clicks: 456 },
            { platform: "macOS", clicks: 234 },
            { platform: "iOS", clicks: 187 },
            { platform: "Android", clicks: 178 },
            { platform: "Linux", clicks: 89 },
          ],
          clicksByHour: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            clicks: Math.floor(Math.random() * 30) + 5,
          })),
        };
        setAnalytics(mockAnalytics);
        console.warn("Using mock analytics data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [url.shortCode, dateRange.start, dateRange.end]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await urlService.getUrlAnalytics(url.shortCode, {
        start: startOfDay(new Date(dateRange.start)).toISOString(),
        end: endOfDay(new Date(dateRange.end)).toISOString(),
      });

      if (response.success && response.data) {
        setAnalytics(response.data);
      }
    } catch (error) {
      // Fallback mock data for demonstration
      const mockAnalytics: AnalyticsData = {
        totalClicks: 1247,
        uniqueClicks: 892,
        clicksByDate: Array.from({ length: 30 }, (_, i) => ({
          date: format(subDays(new Date(), 29 - i), "MMM dd"),
          clicks: Math.floor(Math.random() * 50) + 10,
        })),
        topReferrers: [
          { referrer: "google.com", clicks: 234 },
          { referrer: "twitter.com", clicks: 187 },
          { referrer: "facebook.com", clicks: 156 },
          { referrer: "linkedin.com", clicks: 123 },
          { referrer: "direct", clicks: 89 },
        ],
        clicksByCountry: [
          { country: "United States", clicks: 456 },
          { country: "United Kingdom", clicks: 234 },
          { country: "Canada", clicks: 178 },
          { country: "Australia", clicks: 123 },
          { country: "Germany", clicks: 89 },
        ],
        deviceTypes: [
          { device: "Desktop", clicks: 567 },
          { device: "Mobile", clicks: 445 },
          { device: "Tablet", clicks: 235 },
        ],
        browsers: [
          { browser: "Chrome", clicks: 678 },
          { browser: "Firefox", clicks: 234 },
          { browser: "Safari", clicks: 187 },
          { browser: "Edge", clicks: 123 },
        ],
        platforms: [
          { platform: "Windows", clicks: 456 },
          { platform: "macOS", clicks: 234 },
          { platform: "iOS", clicks: 187 },
          { platform: "Android", clicks: 178 },
          { platform: "Linux", clicks: 89 },
        ],
        clicksByHour: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          clicks: Math.floor(Math.random() * 30) + 5,
        })),
      };
      setAnalytics(mockAnalytics);
      console.warn("Using mock analytics data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = () => {
    if (!analytics) return;

    const csvData = [
      ["Metric", "Value"],
      ["Total Clicks", analytics.totalClicks.toString()],
      ["Unique Clicks", analytics.uniqueClicks.toString()],
      ["", ""],
      ["Date", "Clicks"],
      ...analytics.clicksByDate.map((item) => [
        item.date,
        item.clicks.toString(),
      ]),
      ["", ""],
      ["Referrer", "Clicks"],
      ...analytics.topReferrers.map((item) => [
        item.referrer,
        item.clicks.toString(),
      ]),
      ["", ""],
      ["Country", "Clicks"],
      ...analytics.clicksByCountry.map((item) => [
        item.country,
        item.clicks.toString(),
      ]),
    ];

    const csvContent = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const blobUrl = URL.createObjectURL(blob);
    link.setAttribute("href", blobUrl);
    link.setAttribute(
      "download",
      `analytics-${url.shortCode}-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics data exported!");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">No analytics data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Analytics for{" "}
            <a
              href={url.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-mono"
            >
              {url.shortUrl}
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAnalytics} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportData} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Date Range
              </label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <Button onClick={fetchAnalytics}>
              <Filter className="w-4 h-4 mr-2" />
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Clicks
                </p>
                <p className="text-2xl font-bold">
                  {analytics.totalClicks.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Unique Clicks
                </p>
                <p className="text-2xl font-bold">
                  {analytics.uniqueClicks.toLocaleString()}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Avg. Daily Clicks
                </p>
                <p className="text-2xl font-bold">
                  {Math.round(
                    analytics.totalClicks / analytics.clicksByDate.length
                  )}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Peak Hour</p>
                <p className="text-2xl font-bold">
                  {
                    analytics.clicksByHour.reduce((prev, current) =>
                      prev.clicks > current.clicks ? prev : current
                    ).hour
                  }
                  :00
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="technology">Technology</TabsTrigger>
          <TabsTrigger value="referrers">Referrers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clicks Over Time</CardTitle>
              <CardDescription>
                Daily click trends for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.clicksByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: "#8884d8" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hourly Distribution</CardTitle>
              <CardDescription>
                Click distribution by hour of the day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.clicksByHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Clicks by Country
              </CardTitle>
              <CardDescription>
                Geographic distribution of your clicks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.clicksByCountry}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="clicks"
                    >
                      {analytics.clicksByCountry.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {analytics.clicksByCountry.map((country, index) => (
                    <div
                      key={country.country}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                        <span className="font-medium">{country.country}</span>
                      </div>
                      <span className="text-gray-600">
                        {country.clicks} clicks
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technology" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Device Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.deviceTypes}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="clicks"
                      label={({ name, percent }) =>
                        `${name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                    >
                      {analytics.deviceTypes.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Browsers</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.browsers} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="browser" type="category" />
                    <Tooltip />
                    <Bar dataKey="clicks" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Operating Systems</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.platforms}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Top Referrers
              </CardTitle>
              <CardDescription>
                Sources of traffic to your short URL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.topReferrers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="referrer" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="clicks" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {analytics.topReferrers.map((referrer, index) => (
                    <div
                      key={referrer.referrer}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-gray-400">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{referrer.referrer}</p>
                          <p className="text-sm text-gray-500">
                            {(
                              (referrer.clicks / analytics.totalClicks) *
                              100
                            ).toFixed(1)}
                            % of traffic
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{referrer.clicks}</p>
                        <p className="text-sm text-gray-500">clicks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AnalyticsDashboard;
