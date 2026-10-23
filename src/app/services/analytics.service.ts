import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UserAnalytics {
  totalUsers: number;
  liveUsers: number;
  subscribedUsers: number;
  blockedUsers: number;
  unsubscribedUsers: number;
}

export interface PlanWiseEarning {
  _id: string;
  planTitle: string;
  totalAmount: number;
  purchaseCount: number;
}

export interface EarningsAnalytics {
  todayEarnings: number;
  monthlyEarnings: number;
  totalEarnings: number;
  planWiseEarnings: PlanWiseEarning[];
}

export interface BestsellerPlan {
  _id: string;
  planTitle: string;
  durationInMonths: number;
  price: number;
  purchaseCount: number;
}

export interface BestsellerPlansResponse {
  bestsellerPlan: BestsellerPlan | null;
  topPlans: BestsellerPlan[];
}

export interface SubscriptionAnalyticsPeriod {
  startDate: string | null;
  endDate: string | null;
  label: string;
}

export interface SubscriptionAnalyticsSummary {
  totalPurchases: number;
  totalRevenue: number;
  averageOrderValue: number;
  paidPurchases: number;
  adminAssignedPurchases: number;
}

export interface SubscriptionAnalyticsComparison {
  totalPurchases: number;
  totalRevenue: number;
  purchaseChangePct: number;
  revenueChangePct: number;
}

export interface PlanBreakdownItem {
  planId: string;
  planTitle: string;
  durationInMonths: number;
  purchases: number;
  revenue: number;
}

export interface TimeSeriesPoint {
  date: string;
  purchases: number;
  revenue: number;
}

export interface SubscriptionAnalyticsDashboard {
  period: SubscriptionAnalyticsPeriod;
  summary: SubscriptionAnalyticsSummary;
  comparison: SubscriptionAnalyticsComparison;
  planBreakdown: PlanBreakdownItem[];
  timeSeries: TimeSeriesPoint[];
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly apiUrl = `${environment.API_URL}/api/admin`;

  constructor(private http: HttpClient) {}

  getUserAnalytics(): Observable<UserAnalytics> {
    return this.http.get<AnalyticsResponse<UserAnalytics>>(`${this.apiUrl}/users-analytics`).pipe(
      map(response => response.data),
      catchError(error => throwError(() => this.handleError(error)))
    );
  }

  getEarningsAnalytics(startDate?: string, endDate?: string): Observable<EarningsAnalytics> {
    let httpParams = new HttpParams();
    if (startDate) httpParams = httpParams.set('startDate', startDate);
    if (endDate) httpParams = httpParams.set('endDate', endDate);

    return this.http.get<AnalyticsResponse<EarningsAnalytics>>(`${this.apiUrl}/earnings`, { params: httpParams }).pipe(
      map(response => response.data),
      catchError(error => throwError(() => this.handleError(error)))
    );
  }

  getBestsellerPlans(startDate?: string, endDate?: string): Observable<BestsellerPlansResponse> {
    let httpParams = new HttpParams();
    if (startDate) httpParams = httpParams.set('startDate', startDate);
    if (endDate) httpParams = httpParams.set('endDate', endDate);

    return this.http.get<AnalyticsResponse<BestsellerPlansResponse>>(`${this.apiUrl}/bestseller-plans`, { params: httpParams }).pipe(
      map(response => response.data),
      catchError(error => throwError(() => this.handleError(error)))
    );
  }

  getSubscriptionAnalytics(startDate?: string, endDate?: string): Observable<SubscriptionAnalyticsDashboard> {
    let httpParams = new HttpParams();
    if (startDate) httpParams = httpParams.set('startDate', startDate);
    if (endDate) httpParams = httpParams.set('endDate', endDate);

    return this.http.get<AnalyticsResponse<SubscriptionAnalyticsDashboard>>(
      `${this.apiUrl}/subscription-analytics`,
      { params: httpParams }
    ).pipe(
      map(response => response.data),
      catchError(error => {
        // Production may not have the unified endpoint yet — fall back to legacy APIs
        if (error.status === 404) {
          return this.buildLegacySubscriptionAnalytics(startDate, endDate);
        }
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Compose dashboard-shaped data from legacy earnings + bestseller endpoints.
   * Used when GET /subscription-analytics is not deployed yet.
   */
  private buildLegacySubscriptionAnalytics(
    startDate?: string,
    endDate?: string
  ): Observable<SubscriptionAnalyticsDashboard> {
    return forkJoin({
      bestseller: this.getBestsellerPlans(startDate, endDate),
      earnings: this.getEarningsAnalytics(startDate, endDate)
    }).pipe(
      map(({ bestseller, earnings }) =>
        this.mapLegacyToDashboard(bestseller, earnings, startDate, endDate)
      )
    );
  }

  private mapLegacyToDashboard(
    bestseller: BestsellerPlansResponse,
    earnings: EarningsAnalytics,
    startDate?: string,
    endDate?: string
  ): SubscriptionAnalyticsDashboard {
    const earningsMap = new Map(
      (earnings.planWiseEarnings || []).map(e => [String(e._id), e])
    );
    const seen = new Set<string>();

    const planBreakdown: PlanBreakdownItem[] = (bestseller.topPlans || []).map(plan => {
      const id = String(plan._id);
      seen.add(id);
      const earning = earningsMap.get(id);
      return {
        planId: id,
        planTitle: plan.planTitle,
        durationInMonths: plan.durationInMonths,
        purchases: plan.purchaseCount || earning?.purchaseCount || 0,
        revenue: earning?.totalAmount || (plan.price * plan.purchaseCount) || 0
      };
    });

    (earnings.planWiseEarnings || []).forEach(earning => {
      const id = String(earning._id);
      if (seen.has(id)) return;
      const plan = bestseller.topPlans?.find(p => String(p._id) === id);
      planBreakdown.push({
        planId: id,
        planTitle: earning.planTitle || plan?.planTitle || 'Unknown',
        durationInMonths: plan?.durationInMonths ?? 0,
        purchases: earning.purchaseCount || 0,
        revenue: earning.totalAmount || 0
      });
    });

    planBreakdown.sort((a, b) => b.purchases - a.purchases);

    const totalPurchases = planBreakdown.reduce((sum, p) => sum + p.purchases, 0);
    const totalRevenue =
      earnings.totalEarnings ||
      planBreakdown.reduce((sum, p) => sum + p.revenue, 0);

    const timeSeries = this.buildLegacyTimeSeries(
      startDate,
      endDate,
      totalPurchases,
      totalRevenue
    );

    return {
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
        label: startDate && endDate ? `${startDate} – ${endDate}` : 'All time'
      },
      summary: {
        totalPurchases,
        totalRevenue,
        averageOrderValue:
          totalPurchases > 0 ? Math.round(totalRevenue / totalPurchases) : 0,
        paidPurchases: 0,
        adminAssignedPurchases: 0
      },
      comparison: {
        totalPurchases: 0,
        totalRevenue: 0,
        purchaseChangePct: 0,
        revenueChangePct: 0
      },
      planBreakdown,
      timeSeries
    };
  }

  /**
   * Legacy earnings/bestseller APIs lack daily breakdown — spread totals across the
   * selected range so the trend chart still renders until subscription-analytics is deployed.
   */
  private buildLegacyTimeSeries(
    startDate: string | undefined,
    endDate: string | undefined,
    totalPurchases: number,
    totalRevenue: number
  ): TimeSeriesPoint[] {
    if (totalPurchases === 0 && totalRevenue === 0) {
      return [];
    }

    const formatLocalDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    if (!startDate || !endDate) {
      return [{
        date: formatLocalDate(new Date()),
        purchases: totalPurchases,
        revenue: totalRevenue
      }];
    }

    const dates: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cursor <= end) {
      dates.push(formatLocalDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    if (dates.length === 0) {
      return [{ date: endDate, purchases: totalPurchases, revenue: totalRevenue }];
    }

    let purchaseRemainder = totalPurchases;
    let revenueRemainder = totalRevenue;
    return dates.map((date, index) => {
      const isLast = index === dates.length - 1;
      const purchases = isLast
        ? purchaseRemainder
        : Math.floor(totalPurchases / dates.length);
      const revenue = isLast
        ? revenueRemainder
        : Math.round(totalRevenue / dates.length);
      purchaseRemainder -= purchases;
      revenueRemainder -= revenue;
      return { date, purchases, revenue };
    });
  }

  private handleError(error: any): any {
    if (error.error?.message) {
      return { ...error, message: error.error.message };
    }
    if (error.status === 0) {
      return { ...error, message: 'Network error. Please check your connection and try again.' };
    }
    if (error.status === 404) {
      return { ...error, message: 'Analytics data not found.' };
    }
    if (error.status === 500) {
      return { ...error, message: 'Server error. Please try again later.' };
    }
    return { ...error, message: 'An unexpected error occurred. Please try again.' };
  }
}
