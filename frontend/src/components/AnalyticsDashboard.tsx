"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
  TrendingUp,
  TrendingDown,
  Globe,
  Smartphone,
  Users,
  Clock,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

interface AnalyticsDashboardProps {
  shortCode: string;
}

interface DetailedAnalytics {
  summary: {
    totalClicks: number;
    uniqueClicks: number;
    uniqueCountries: number;
    uniqueReferrers: number;
    averageClicksPerDay: number;
    peakHour: number;
    peakDay: string;
  };
  breakdown: {
    byCountry: Array<{ country: string; clicks: number; percentage: number }>;
    byReferrer: Array<{ referer: string; clicks: number; percentage: number }>;
    byDevice: Array<{ device: string; clicks: number; percentage: number }>;
    byBrowser: Array<{ browser: string; clicks: number; percentage: number }>;
    byHour: Array<{ hour: number; clicks: number }>;
    byDate: Array<{ date: string; clicks: number; uniqueClicks: number }>;
    byDayOfWeek: Array<{
      dayOfWeek: number;
      dayName: string;
      clicks: number;
    }>;
  };
  trends: {
    clickGrowth: number;
    topGrowthCountries: Array<{ country: string; growth: number }>;
    hourlyDistribution: Array<{ hour: number; percentage: number }>;
  };
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function AnalyticsDashboard({ shortCode }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "custom">(
    "30d"
  );
  const [customDateRange, setCustomDateRange] = useState({
    start: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let startDate: string;
      let endDate: string = format(new Date(), "yyyy-MM-dd");

      if (timeRange === "custom") {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
      }

      const response = await api.get(`/analytics/${shortCode}/detailed`, {
        params: { startDate, endDate },
      });

      if (response.data.success && response.data.data) {
        setAnalytics(response.data.data);
      } else {
        throw new Error("Failed to fetch analytics");
      }
    } catch (err: any) {
      console.error("Error fetching analytics:", err);
      setError(err.response?.data?.message || "Failed to load analytics data");
      toast.error("Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  }, [shortCode, timeRange, customDateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = async (format: "csv" | "json") => {
    try {
      let startDate: string;
      let endDate: string = format(new Date(), "yyyy-MM-dd");

      if (timeRange === "custom") {
        startDate = customDateRange.start;
        endDate = customDateRange.end;
      } else {
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
      }

      const response = await api.get(`/analytics/${shortCode}/export`, {
        params: { startDate, endDate, format },
        responseType: format === "csv" ? "blob" : "json",
      });

      if (format === "csv") {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `analytics-${shortCode}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataUri =
          "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
        const link = document.createElement("a");
        link.setAttribute("href", dataUri);
        link.setAttribute("download", `analytics-${shortCode}.json`);
        link.click();
      }

      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error("Failed to export analytics");
      console.error("Export error:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="font-semibold text-red-900">
                Failed to Load Analytics
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {error || "An unknown error occurred"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAnalytics}
                className="mt-3"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Detailed insights for /{shortCode}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex gap-2">
            <Button
              variant={timeRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("7d")}
            >
              7 Days
            </Button>
            <Button
              variant={timeRange === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("30d")}
            >
              30 Days
            </Button>
            <Button
              variant={timeRange === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("90d")}
            >
              90 Days
            </Button>
          </div>

          {/* Custom Date Range */}
          {timeRange === "custom" && (
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={customDateRange.start}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    start: e.target.value,
                  }))
                }
                className="w-40"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={customDateRange.end}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="w-40"
              />
            </div>
          )}

          {/* Refresh & Export */}
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
          >
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clicks</p>
                <p className="text-3xl font-bold">
                  {analytics.summary.totalClicks.toLocaleString()}
                </p>
                {analytics.trends.clickGrowth !== 0 && (
                  <p className="text-sm flex items-center gap-1 mt-1">
                    {analytics.trends.clickGrowth > 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-green-500">
                          +{analytics.trends.clickGrowth.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-red-500">
                          {analytics.trends.clickGrowth.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </p>
                )}
              </div>
              <Users className="w-10 h-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unique Visitors</p>
                <p className="text-3xl font-bold">
                  {analytics.summary.uniqueClicks.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(
                    (analytics.summary.uniqueClicks /
                      analytics.summary.totalClicks) *
                    100
                  ).toFixed(1)}
                  % unique
                </p>
              </div>
              <Smartphone className="w-10 h-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Countries</p>
                <p className="text-3xl font-bold">
                  {analytics.summary.uniqueCountries}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {analytics.breakdown.byCountry[0]?.country || "N/A"} top
                </p>
              </div>
              <Globe className="w-10 h-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg/Day</p>
                <p className="text-3xl font-bold">
                  {analytics.summary.averageClicksPerDay.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Peak: {analytics.summary.peakHour}:00
                </p>
              </div>
              <Clock className="w-10 h-10 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="referrers">Referrers</TabsTrigger>
          <TabsTrigger value="time">Time Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clicks Over Time</CardTitle>
              <CardDescription>Daily click trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.breakdown.byDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Total Clicks"
                  />
                  <Line
                    type="monotone"
                    dataKey="uniqueClicks"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Unique Clicks"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clicks by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.breakdown.byDayOfWeek}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geography Tab */}
        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Top Countries
              </CardTitle>
              <CardDescription>Geographic distribution of clicks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.breakdown.byCountry}
                      dataKey="clicks"
                      nameKey="country"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) =>
                        `${entry.country} (${entry.percentage.toFixed(1)}%)`
                      }
                    >
                      {analytics.breakdown.byCountry.map((entry, index) => (
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
                  {analytics.breakdown.byCountry.slice(0, 10).map((country, index) => (
                    <div
                      key={country.country}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{country.country}</p>
                          <p className="text-sm text-muted-foreground">
                            {country.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{country.clicks}</p>
                        <p className="text-sm text-muted-foreground">clicks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Device Types</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.breakdown.byDevice}
                      dataKey="clicks"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) =>
                        `${entry.device} (${entry.percentage.toFixed(1)}%)`
                      }
                    >
                      {analytics.breakdown.byDevice.map((entry, index) => (
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
                  <BarChart data={analytics.breakdown.byBrowser}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="browser" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="clicks" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Referrers Tab */}
        <TabsContent value="referrers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Top Referrers
              </CardTitle>
              <CardDescription>Sources of traffic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.breakdown.byReferrer.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="referer" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="clicks" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-2">
                  {analytics.breakdown.byReferrer.slice(0, 10).map((ref, index) => (
                    <div
                      key={ref.referer}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg font-bold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{ref.referer}</p>
                          <p className="text-sm text-muted-foreground">
                            {ref.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold">{ref.clicks}</p>
                        <p className="text-sm text-muted-foreground">clicks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Analysis Tab */}
        <TabsContent value="time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clicks by Hour</CardTitle>
              <CardDescription>
                24-hour distribution (Peak: {analytics.summary.peakHour}:00)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.breakdown.byHour}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hour"
                    label={{ value: "Hour of Day", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis label={{ value: "Clicks", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hourly Distribution</CardTitle>
              <CardDescription>Percentage of total clicks per hour</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics.trends.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AnalyticsDashboard;
