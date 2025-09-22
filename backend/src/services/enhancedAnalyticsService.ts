import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';

export interface AnalyticsFilter {
  startDate?: string;
  endDate?: string;
  country?: string;
  referer?: string;
  device?: string;
  browser?: string;
}

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueClicks: number;
  uniqueCountries: number;
  uniqueReferrers: number;
  averageClicksPerDay: number;
  peakHour: number;
  peakDay: string;
}

export interface AnalyticsBreakdown {
  byCountry: Array<{ country: string; clicks: number; percentage: number }>;
  byReferrer: Array<{ referer: string; clicks: number; percentage: number }>;
  byDevice: Array<{ device: string; clicks: number; percentage: number }>;
  byBrowser: Array<{ browser: string; clicks: number; percentage: number }>;
  byHour: Array<{ hour: number; clicks: number }>;
  byDate: Array<{ date: string; clicks: number; uniqueClicks: number }>;
  byDayOfWeek: Array<{ dayOfWeek: number; dayName: string; clicks: number }>;
}

export interface DetailedAnalytics {
  summary: AnalyticsSummary;
  breakdown: AnalyticsBreakdown;
  trends: {
    clickGrowth: number; // percentage growth compared to previous period
    topGrowthCountries: Array<{ country: string; growth: number }>;
    hourlyDistribution: Array<{ hour: number; percentage: number }>;
  };
}

export class AnalyticsService {
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Get comprehensive analytics for a URL
   */
  static async getDetailedAnalytics(
    shortCode: string,
    filter: AnalyticsFilter = {}
  ): Promise<DetailedAnalytics | null> {
    try {
      // Check cache first
      const cacheKey = `detailed_analytics:${shortCode}:${JSON.stringify(filter)}`;
      const cached = await CacheService.getCachedAnalytics(cacheKey);
      if (cached) {
        return cached;
      }

      const url = await prisma.url.findFirst({
        where: { OR: [{ shortCode }, { customAlias: shortCode }] },
        select: { id: true },
      });

      if (!url) return null;

      const whereClause = this.buildWhereClause(url.id, filter);

      const [summary, breakdown, trends] = await Promise.all([
        this.getAnalyticsSummary(url.id, whereClause),
        this.getAnalyticsBreakdown(url.id, whereClause),
        this.getAnalyticsTrends(url.id, filter),
      ]);

      const result: DetailedAnalytics = {
        summary,
        breakdown,
        trends,
      };

      // Cache the result
      await CacheService.cacheAnalytics(cacheKey, result);

      return result;
    } catch (error) {
      logger.error('Error getting detailed analytics:', error);
      return null;
    }
  }

  /**
   * Get analytics summary
   */
  private static async getAnalyticsSummary(
    urlId: number,
    whereClause: any
  ): Promise<AnalyticsSummary> {
    const [
      totalClicks,
      uniqueClicks,
      uniqueCountries,
      uniqueReferrers,
      hourlyData,
      dailyData,
    ] = await Promise.all([
      prisma.analytics.count({ where: whereClause }),
      prisma.analytics
        .groupBy({
          by: ['ipAddress'],
          where: whereClause,
        })
        .then((rows) => rows.length),
      prisma.analytics
        .groupBy({
          by: ['country'],
          where: whereClause,
        })
        .then((rows) => rows.length),
      prisma.analytics
        .groupBy({
          by: ['referer'],
          where: whereClause,
        })
        .then((rows) => rows.length),
      prisma.analytics.groupBy({
        by: ['clickedAt'],
        where: whereClause,
        _count: true,
      }),
      prisma.analytics.groupBy({
        by: ['clickedAt'],
        where: whereClause,
        _count: true,
      }),
    ]);

    // Calculate peak hour
    const hourlyClicks = hourlyData.reduce(
      (acc: Record<number, number>, row) => {
        const hour = new Date(row.clickedAt).getHours();
        acc[hour] = (acc[hour] || 0) + (row._count || 0);
        return acc;
      },
      {}
    );

    const peakHour = Object.entries(hourlyClicks).reduce(
      (max, [hour, clicks]) =>
        clicks > (hourlyClicks[max] || 0) ? parseInt(hour) : max,
      0
    );

    // Calculate peak day
    const dailyClicks = dailyData.reduce((acc: Record<string, number>, row) => {
      const date = row.clickedAt.toISOString().slice(0, 10);
      acc[date] = (acc[date] || 0) + (row._count || 0);
      return acc;
    }, {});

    const peakDay = Object.entries(dailyClicks).reduce(
      (max, [date, clicks]) => (clicks > (dailyClicks[max] || 0) ? date : max),
      ''
    );

    // Calculate average clicks per day
    const uniqueDays = Object.keys(dailyClicks).length;
    const averageClicksPerDay = uniqueDays > 0 ? totalClicks / uniqueDays : 0;

    return {
      totalClicks,
      uniqueClicks,
      uniqueCountries,
      uniqueReferrers,
      averageClicksPerDay: Math.round(averageClicksPerDay * 100) / 100,
      peakHour,
      peakDay,
    };
  }

  /**
   * Get detailed analytics breakdown
   */
  private static async getAnalyticsBreakdown(
    urlId: number,
    whereClause: any
  ): Promise<AnalyticsBreakdown> {
    const [
      byCountry,
      byReferrer,
      byDevice,
      byBrowser,
      byHour,
      byDate,
      byDayOfWeek,
    ] = await Promise.all([
      this.getCountryBreakdown(whereClause),
      this.getReferrerBreakdown(whereClause),
      this.getDeviceBreakdown(whereClause),
      this.getBrowserBreakdown(whereClause),
      this.getHourlyBreakdown(whereClause),
      this.getDailyBreakdown(whereClause),
      this.getDayOfWeekBreakdown(whereClause),
    ]);

    return {
      byCountry,
      byReferrer,
      byDevice,
      byBrowser,
      byHour,
      byDate,
      byDayOfWeek,
    };
  }

  /**
   * Get analytics trends
   */
  private static async getAnalyticsTrends(
    urlId: number,
    filter: AnalyticsFilter
  ): Promise<DetailedAnalytics['trends']> {
    // Calculate growth compared to previous period
    const currentPeriodClicks = await prisma.analytics.count({
      where: this.buildWhereClause(urlId, filter),
    });

    // Get previous period for comparison
    const previousFilter = this.getPreviousPeriodFilter(filter);
    const previousPeriodClicks = await prisma.analytics.count({
      where: this.buildWhereClause(urlId, previousFilter),
    });

    const clickGrowth =
      previousPeriodClicks > 0
        ? ((currentPeriodClicks - previousPeriodClicks) /
            previousPeriodClicks) *
          100
        : 0;

    // Get top growth countries (simplified for now)
    const topGrowthCountries: Array<{ country: string; growth: number }> = [];

    // Get hourly distribution
    const hourlyData = await prisma.analytics.groupBy({
      by: ['clickedAt'],
      where: this.buildWhereClause(urlId, filter),
      _count: true,
    });

    const totalHourlyClicks = hourlyData.reduce(
      (sum, row) => sum + (row._count || 0),
      0
    );
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const clicks = hourlyData
        .filter((row) => new Date(row.clickedAt).getHours() === hour)
        .reduce((sum, row) => sum + (row._count || 0), 0);

      return {
        hour,
        percentage:
          totalHourlyClicks > 0 ? (clicks / totalHourlyClicks) * 100 : 0,
      };
    });

    return {
      clickGrowth: Math.round(clickGrowth * 100) / 100,
      topGrowthCountries,
      hourlyDistribution,
    };
  }

  /**
   * Helper methods for breakdowns
   */
  private static async getCountryBreakdown(whereClause: any) {
    const data = await prisma.analytics.groupBy({
      by: ['country'],
      where: whereClause,
      _count: true,
      orderBy: { _count: { country: 'desc' } },
      take: 10,
    });

    const total = data.reduce((sum, row) => sum + (row._count || 0), 0);

    return data.map((row) => ({
      country: row.country || 'Unknown',
      clicks: row._count || 0,
      percentage: total > 0 ? ((row._count || 0) / total) * 100 : 0,
    }));
  }

  private static async getReferrerBreakdown(whereClause: any) {
    const data = await prisma.analytics.groupBy({
      by: ['referer'],
      where: whereClause,
      _count: true,
      orderBy: { _count: { referer: 'desc' } },
      take: 10,
    });

    const total = data.reduce((sum, row) => sum + (row._count || 0), 0);

    return data.map((row) => ({
      referer: row.referer || 'Direct',
      clicks: row._count || 0,
      percentage: total > 0 ? ((row._count || 0) / total) * 100 : 0,
    }));
  }

  private static async getDeviceBreakdown(whereClause: any) {
    // Device field doesn't exist in schema, return empty array for now
    // This could be enhanced by parsing userAgent field
    return [];
  }

  private static async getBrowserBreakdown(whereClause: any) {
    // Browser field doesn't exist in schema, return empty array for now
    // This could be enhanced by parsing userAgent field
    return [];
  }

  private static async getHourlyBreakdown(whereClause: any) {
    const data = await prisma.analytics.groupBy({
      by: ['clickedAt'],
      where: whereClause,
      _count: true,
    });

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      clicks: data
        .filter((row) => new Date(row.clickedAt).getHours() === hour)
        .reduce((sum, row) => sum + (row._count || 0), 0),
    }));
  }

  private static async getDailyBreakdown(whereClause: any) {
    const data = await prisma.analytics.groupBy({
      by: ['clickedAt'],
      where: whereClause,
      _count: true,
    });

    const dailyData = data.reduce(
      (acc: Record<string, { clicks: number; ips: Set<string> }>, row) => {
        const date = row.clickedAt.toISOString().slice(0, 10);
        if (!acc[date]) {
          acc[date] = { clicks: 0, ips: new Set() };
        }
        acc[date].clicks += row._count || 0;
        return acc;
      },
      {}
    );

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        clicks: data.clicks,
        uniqueClicks: data.ips.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private static async getDayOfWeekBreakdown(whereClause: any) {
    const data = await prisma.analytics.groupBy({
      by: ['clickedAt'],
      where: whereClause,
      _count: true,
    });

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    return Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      dayName: dayNames[dayOfWeek] || 'Unknown',
      clicks: data
        .filter((row) => new Date(row.clickedAt).getDay() === dayOfWeek)
        .reduce((sum, row) => sum + (row._count || 0), 0),
    }));
  }

  /**
   * Build where clause for analytics queries
   */
  private static buildWhereClause(urlId: number, filter: AnalyticsFilter): any {
    const where: any = { urlId };

    if (filter.startDate || filter.endDate) {
      where.clickedAt = {};
      if (filter.startDate) {
        where.clickedAt.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.clickedAt.lte = new Date(filter.endDate);
      }
    }

    if (filter.country) {
      where.country = filter.country;
    }

    if (filter.referer) {
      where.referer = filter.referer;
    }

    if (filter.device) {
      where.device = filter.device;
    }

    if (filter.browser) {
      where.browser = filter.browser;
    }

    return where;
  }

  /**
   * Get previous period filter for comparison
   */
  private static getPreviousPeriodFilter(
    filter: AnalyticsFilter
  ): AnalyticsFilter {
    if (!filter.startDate || !filter.endDate) {
      // If no date range specified, use last 30 days vs previous 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      return {
        ...filter,
        startDate: sixtyDaysAgo.toISOString(),
        endDate: thirtyDaysAgo.toISOString(),
      };
    }

    const start = new Date(filter.startDate);
    const end = new Date(filter.endDate);
    const duration = end.getTime() - start.getTime();

    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(start.getTime() - duration);

    return {
      ...filter,
      startDate: previousStart.toISOString(),
      endDate: previousEnd.toISOString(),
    };
  }

  /**
   * Get analytics for multiple URLs (user dashboard)
   */
  static async getUserAnalyticsSummary(userId: number): Promise<{
    totalUrls: number;
    totalClicks: number;
    uniqueClicks: number;
    topUrls: Array<{ shortCode: string; clicks: number; originalUrl: string }>;
    recentActivity: Array<{
      shortCode: string;
      clickedAt: Date;
      country: string;
    }>;
  }> {
    try {
      const [totalUrls, clicksData, topUrls, recentActivity] =
        await Promise.all([
          prisma.url.count({ where: { userId, isActive: true } }),

          prisma.analytics.aggregate({
            where: {
              url: { userId, isActive: true },
            },
            _count: { _all: true },
          }),

          prisma.url.findMany({
            where: { userId, isActive: true },
            select: {
              shortCode: true,
              originalUrl: true,
              _count: { select: { analytics: true } },
            },
            orderBy: { analytics: { _count: 'desc' } },
            take: 5,
          }),

          prisma.analytics.findMany({
            where: {
              url: { userId, isActive: true },
            },
            select: {
              clickedAt: true,
              country: true,
              url: { select: { shortCode: true } },
            },
            orderBy: { clickedAt: 'desc' },
            take: 10,
          }),
        ]);

      const uniqueClicks = await prisma.analytics
        .groupBy({
          by: ['ipAddress'],
          where: { url: { userId, isActive: true } },
        })
        .then((rows) => rows.length);

      return {
        totalUrls,
        totalClicks: clicksData._count._all || 0,
        uniqueClicks,
        topUrls: topUrls.map((url) => ({
          shortCode: url.shortCode,
          clicks: url._count.analytics,
          originalUrl: url.originalUrl,
        })),
        recentActivity: recentActivity.map((activity) => ({
          shortCode: activity.url.shortCode,
          clickedAt: activity.clickedAt,
          country: activity.country || 'Unknown',
        })),
      };
    } catch (error) {
      logger.error('Error getting user analytics summary:', error);
      throw error;
    }
  }
}
