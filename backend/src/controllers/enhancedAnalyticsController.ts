import { Request, Response } from 'express';
import {
  AnalyticsService,
  AnalyticsFilter,
} from '../services/enhancedAnalyticsService';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/logger';

export class EnhancedAnalyticsController {
  /**
   * Get detailed analytics for a URL
   * GET /api/v1/analytics/:shortCode/detailed
   */
  static async getDetailedAnalytics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { shortCode } = req.params;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      const filter: AnalyticsFilter = {
        startDate: req.query['startDate'] as string,
        endDate: req.query['endDate'] as string,
        country: req.query['country'] as string,
        referer: req.query['referer'] as string,
        device: req.query['device'] as string,
        browser: req.query['browser'] as string,
      };

      // Remove undefined values
      Object.keys(filter).forEach((key) => {
        if (filter[key as keyof AnalyticsFilter] === undefined) {
          delete filter[key as keyof AnalyticsFilter];
        }
      });

      const analytics = await AnalyticsService.getDetailedAnalytics(
        shortCode,
        filter
      );

      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'URL not found',
        });
        return;
      }

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Error getting detailed analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get user analytics summary (dashboard)
   * GET /api/v1/analytics/dashboard
   */
  static async getUserDashboard(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user!.id;

      const summary = await AnalyticsService.getUserAnalyticsSummary(userId);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error getting user analytics dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Export analytics data
   * GET /api/v1/analytics/:shortCode/export
   */
  static async exportAnalytics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { shortCode } = req.params;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      const format = (req.query['format'] as string) || 'json';

      const filter: AnalyticsFilter = {
        startDate: req.query['startDate'] as string,
        endDate: req.query['endDate'] as string,
        country: req.query['country'] as string,
        referer: req.query['referer'] as string,
        device: req.query['device'] as string,
        browser: req.query['browser'] as string,
      };

      // Remove undefined values
      Object.keys(filter).forEach((key) => {
        if (filter[key as keyof AnalyticsFilter] === undefined) {
          delete filter[key as keyof AnalyticsFilter];
        }
      });

      const analytics = await AnalyticsService.getDetailedAnalytics(
        shortCode,
        filter
      );

      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'URL not found',
        });
        return;
      }

      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(analytics);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="analytics-${shortCode}.csv"`
        );
        res.send(csv);
      } else {
        // Return JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="analytics-${shortCode}.json"`
        );
        res.json({
          success: true,
          data: analytics,
          exportedAt: new Date().toISOString(),
          shortCode,
        });
      }
    } catch (error) {
      logger.error('Error exporting analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get analytics comparison between multiple URLs
   * POST /api/v1/analytics/compare
   */
  static async compareAnalytics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { shortCodes } = req.body;

      if (!Array.isArray(shortCodes) || shortCodes.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Short codes array is required and must not be empty',
        });
        return;
      }

      if (shortCodes.length > 10) {
        res.status(400).json({
          success: false,
          message: 'Maximum 10 URLs can be compared at once',
        });
        return;
      }

      const filter: AnalyticsFilter = {
        startDate: req.body.startDate,
        endDate: req.body.endDate,
      };

      const comparisons = await Promise.all(
        shortCodes.map(async (shortCode: string) => {
          const analytics = await AnalyticsService.getDetailedAnalytics(
            shortCode,
            filter
          );
          return {
            shortCode,
            analytics: analytics ? analytics.summary : null,
          };
        })
      );

      // Filter out null results
      const validComparisons = comparisons.filter(
        (comp) => comp.analytics !== null
      );

      if (validComparisons.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No valid URLs found for comparison',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          comparisons: validComparisons,
          summary: {
            totalUrls: validComparisons.length,
            totalClicks: validComparisons.reduce(
              (sum, comp) => sum + (comp.analytics?.totalClicks || 0),
              0
            ),
            totalUniqueClicks: validComparisons.reduce(
              (sum, comp) => sum + (comp.analytics?.uniqueClicks || 0),
              0
            ),
          },
        },
      });
    } catch (error) {
      logger.error('Error comparing analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Get real-time analytics
   * GET /api/v1/analytics/:shortCode/realtime
   */
  static async getRealtimeAnalytics(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { shortCode } = req.params;

      if (!shortCode) {
        res.status(400).json({
          success: false,
          message: 'Short code is required',
        });
        return;
      }

      // Get analytics for the last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      const filter: AnalyticsFilter = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      const analytics = await AnalyticsService.getDetailedAnalytics(
        shortCode,
        filter
      );

      if (!analytics) {
        res.status(404).json({
          success: false,
          message: 'URL not found',
        });
        return;
      }

      // Extract real-time relevant data
      const realtimeData = {
        last24Hours: analytics.summary,
        hourlyBreakdown: analytics.breakdown.byHour,
        recentCountries: analytics.breakdown.byCountry.slice(0, 5),
        recentReferrers: analytics.breakdown.byReferrer.slice(0, 5),
        trends: {
          currentHour:
            analytics.breakdown.byHour[new Date().getHours()]?.clicks || 0,
          previousHour:
            analytics.breakdown.byHour[new Date().getHours() - 1]?.clicks || 0,
        },
      };

      res.json({
        success: true,
        data: realtimeData,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting realtime analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }

  /**
   * Convert analytics data to CSV format
   */
  private static convertToCSV(analytics: any): string {
    const headers = ['Metric', 'Value', 'Category', 'Subcategory'];

    const rows: string[][] = [headers];

    // Add summary data
    Object.entries(analytics.summary).forEach(([key, value]) => {
      rows.push(['Summary', String(value), key, '']);
    });

    // Add breakdown data
    Object.entries(analytics.breakdown).forEach(
      ([category, data]: [string, any]) => {
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            const keys = Object.keys(item);
            if (keys.length > 0) {
              const primaryKey = keys[0];
              if (primaryKey && item[primaryKey] !== undefined) {
                const primaryValue = item[primaryKey];
                const clicks = item.clicks || item.percentage || '';
                rows.push([
                  'Breakdown',
                  String(clicks),
                  category,
                  String(primaryValue),
                ]);
              }
            }
          });
        }
      }
    );

    return rows
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
  }
}
