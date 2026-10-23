import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MenuController, ToastController } from '@ionic/angular';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import {
  AnalyticsService,
  UserAnalytics,
  EarningsAnalytics,
  BestsellerPlan,
  SubscriptionAnalyticsDashboard,
  PlanBreakdownItem
} from '../services/analytics.service';
import { firstValueFrom } from 'rxjs';

Chart.register(...registerables);

type DateRangeKey = 'today' | '7' | '30' | 'custom' | 'all';

interface ChartPlanRow {
  plan: string;
  planTitle: string;
  durationMonths: number;
  purchases: number;
  revenue: number;
}

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
  standalone: false,
})
export class FolderPage implements OnInit, OnDestroy {
  public folder!: string;
  private activatedRoute = inject(ActivatedRoute);

  @ViewChild('trendChartCanvas', { static: false }) trendChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChartCanvas', { static: false }) barChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutChartCanvas', { static: false }) doughnutChartCanvas!: ElementRef<HTMLCanvasElement>;

  selectedDateRange: DateRangeKey = '30';
  periodLabel = '';
  customStartDate = '';
  customEndDate = '';
  showCustomDatePicker = false;
  isLoading = false;
  loadError: string | null = null;

  chartData: ChartPlanRow[] = [];
  analyticsData: SubscriptionAnalyticsDashboard | null = null;

  userAnalytics: UserAnalytics | null = null;
  earningsAnalytics: EarningsAnalytics | null = null;
  bestsellerPlan: BestsellerPlan | null = null;
  isLoadingAnalytics = false;

  trendChart: Chart | null = null;
  private chartInitAttempts = 0;
  barChart: Chart | null = null;
  doughnutChart: Chart | null = null;

  insights = {
    bestSellingPlan: '',
    highestRevenuePlan: '',
    averageValue: 0
  };

  private filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private menuController: MenuController,
    private toastController: ToastController,
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.folder = this.activatedRoute.snapshot.paramMap.get('id') as string;
    this.loadDashboardAnalytics();
    this.loadSubscriptionAnalytics();
  }

  ngOnDestroy() {
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }
    this.destroyCharts();
  }

  ionViewDidEnter() {
    this.menuController.enable(true);
  }

  async loadDashboardAnalytics() {
    this.isLoadingAnalytics = true;
    try {
      const [userData, earningsData, bestsellerData] = await Promise.all([
        firstValueFrom(this.analyticsService.getUserAnalytics()),
        firstValueFrom(this.analyticsService.getEarningsAnalytics()),
        firstValueFrom(this.analyticsService.getBestsellerPlans())
      ]);

      if (userData) this.userAnalytics = userData;
      if (earningsData) this.earningsAnalytics = earningsData;
      if (bestsellerData?.bestsellerPlan) this.bestsellerPlan = bestsellerData.bestsellerPlan;
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load dashboard analytics. Please try again.';
      this.presentToast(errorMessage, 'danger');
      this.userAnalytics = {
        totalUsers: 0,
        liveUsers: 0,
        subscribedUsers: 0,
        blockedUsers: 0,
        unsubscribedUsers: 0
      };
      this.earningsAnalytics = {
        todayEarnings: 0,
        monthlyEarnings: 0,
        totalEarnings: 0,
        planWiseEarnings: []
      };
      this.bestsellerPlan = null;
    } finally {
      this.isLoadingAnalytics = false;
    }
  }

  onDateRangeChange(range: DateRangeKey) {
    if (this.isLoading) return;
    this.selectedDateRange = range;
    this.showCustomDatePicker = range === 'custom';
    if (range !== 'custom') {
      this.debouncedLoadSubscriptionAnalytics();
    }
  }

  applyCustomDateRange() {
    if (!this.customStartDate || !this.customEndDate) {
      this.presentToast('Please select both start and end dates', 'warning');
      return;
    }
    if (this.customEndDate < this.customStartDate) {
      this.presentToast('End date must be on or after start date', 'warning');
      return;
    }
    const start = new Date(this.customStartDate);
    const end = new Date(this.customEndDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 365) {
      this.presentToast('Date range cannot exceed 365 days', 'warning');
      return;
    }
    this.selectedDateRange = 'custom';
    this.debouncedLoadSubscriptionAnalytics();
  }

  clearDateFilter() {
    this.selectedDateRange = '30';
    this.customStartDate = '';
    this.customEndDate = '';
    this.showCustomDatePicker = false;
    this.debouncedLoadSubscriptionAnalytics();
  }

  retryLoadAnalytics() {
    this.loadSubscriptionAnalytics();
  }

  private debouncedLoadSubscriptionAnalytics() {
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }
    this.filterDebounceTimer = setTimeout(() => {
      this.loadSubscriptionAnalytics();
    }, 300);
  }

  async loadSubscriptionAnalytics() {
    this.destroyCharts();
    this.isLoading = true;
    this.loadError = null;

    try {
      const { startDate, endDate } = this.getDateRange(this.selectedDateRange);
      const data = await firstValueFrom(
        this.analyticsService.getSubscriptionAnalytics(startDate, endDate)
      );

      this.analyticsData = data;
      this.periodLabel = data.period?.label || this.buildPeriodLabel(startDate, endDate);
      this.chartData = this.mapPlanBreakdownToChart(data.planBreakdown || []);
      this.calculateInsights();
      this.isLoading = false;
      this.refreshCharts();
    } catch (error: any) {
      this.isLoading = false;
      this.loadError = error?.message || 'Failed to load analytics data. Please try again.';
      this.analyticsData = null;
      this.chartData = [];
      this.presentToast(this.loadError!, 'danger');
      this.destroyCharts();
    }
  }

  private mapPlanBreakdownToChart(plans: PlanBreakdownItem[]): ChartPlanRow[] {
    return plans
      .filter(p => p.purchases > 0 || p.revenue > 0)
      .map(plan => ({
        plan: this.getDurationLabel(plan.durationInMonths),
        planTitle: plan.planTitle,
        durationMonths: plan.durationInMonths,
        purchases: plan.purchases,
        revenue: plan.revenue
      }));
  }

  private getDurationLabel(months: number): string {
    switch (months) {
      case 1: return '1 Month';
      case 3: return '3 Months';
      case 6: return '6 Months';
      case 12: return '12 Months';
      default: return `${months} Month${months > 1 ? 's' : ''}`;
    }
  }

  private formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildPeriodLabel(startDate?: string, endDate?: string): string {
    if (startDate && endDate) return `${startDate} – ${endDate}`;
    return 'All time';
  }

  private getDateRange(range: DateRangeKey): { startDate?: string; endDate?: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = this.formatLocalDate(today);

    if (range === 'all') {
      return {};
    }

    if (range === 'custom') {
      return {
        startDate: this.customStartDate || undefined,
        endDate: this.customEndDate || undefined
      };
    }

    const start = new Date(today);
    if (range === 'today') {
      return { startDate: endDate, endDate };
    }
    if (range === '7') {
      start.setDate(start.getDate() - 6);
      return { startDate: this.formatLocalDate(start), endDate };
    }
    if (range === '30') {
      start.setDate(start.getDate() - 29);
      return { startDate: this.formatLocalDate(start), endDate };
    }

    return {};
  }

  private refreshCharts(): void {
    this.destroyCharts();
    if (!this.analyticsData) return;
    this.cdr.detectChanges();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.initializeCharts());
    });
  }

  initializeCharts() {
    if (this.hasTrendData && !this.trendChartCanvas) {
      if (this.chartInitAttempts < 5) {
        this.chartInitAttempts++;
        this.cdr.detectChanges();
        setTimeout(() => this.initializeCharts(), 50);
        return;
      }
    }
    this.chartInitAttempts = 0;
    this.initializeTrendChart();
    this.initializeBarChart();
    this.initializeDoughnutChart();
  }

  private initializeTrendChart() {
    if (!this.trendChartCanvas || !this.analyticsData?.timeSeries?.length) return;

    const ctx = this.trendChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.analyticsData.timeSeries.map(p => p.date);
    const revenueData = this.analyticsData.timeSeries.map(p => p.revenue);
    const purchaseData = this.analyticsData.timeSeries.map(p => p.purchases);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue (₹)',
            data: revenueData,
            borderColor: '#0f1115',
            backgroundColor: 'rgba(15, 17, 21, 0.08)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Purchases',
            data: purchaseData,
            borderColor: '#4c5160',
            backgroundColor: 'transparent',
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom' }
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'Revenue (₹)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Purchases' }
          }
        }
      }
    };

    this.trendChart = new Chart(ctx, config);
  }

  private initializeBarChart() {
    if (!this.barChartCanvas || this.chartData.length === 0) return;

    const ctx = this.barChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const bestSeller = this.chartData.reduce((prev, current) =>
      prev.purchases > current.purchases ? prev : current
    );

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: this.chartData.map(d => d.plan),
        datasets: [{
          label: 'Purchases',
          data: this.chartData.map(d => d.purchases),
          backgroundColor: this.chartData.map(d =>
            d.plan === bestSeller.plan ? '#0f1115' : '#4c5160'
          ),
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    };

    this.barChart = new Chart(ctx, config);
  }

  private initializeDoughnutChart() {
    if (!this.doughnutChartCanvas || this.chartData.length === 0) return;

    const ctx = this.doughnutChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const totalRevenue = this.getTotalRevenue();
    const colors = ['#0f1115', '#4c5160', '#6a7182', '#9aa0ad'];

    const config: any = {
      type: 'doughnut',
      data: {
        labels: this.chartData.map(d => d.plan),
        datasets: [{
          data: this.chartData.map(d => d.revenue),
          backgroundColor: colors,
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const value = context.parsed;
                const pct = totalRevenue > 0 ? ((value / totalRevenue) * 100).toFixed(1) : '0';
                return `${context.label}: ₹${this.formatCurrency(value)} (${pct}%)`;
              }
            }
          }
        }
      }
    };

    this.doughnutChart = new Chart(ctx, config);
  }

  destroyCharts() {
    if (this.trendChart) {
      this.trendChart.destroy();
      this.trendChart = null;
    }
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
    if (this.doughnutChart) {
      this.doughnutChart.destroy();
      this.doughnutChart = null;
    }
  }

  calculateInsights() {
    if (this.chartData.length === 0) {
      this.insights = { bestSellingPlan: '', highestRevenuePlan: '', averageValue: 0 };
      return;
    }

    const bestSeller = this.chartData.reduce((prev, current) =>
      prev.purchases > current.purchases ? prev : current
    );
    const highestRevenue = this.chartData.reduce((prev, current) =>
      prev.revenue > current.revenue ? prev : current
    );

    this.insights.bestSellingPlan = bestSeller.planTitle || bestSeller.plan;
    this.insights.highestRevenuePlan = highestRevenue.planTitle || highestRevenue.plan;
    this.insights.averageValue = this.analyticsData?.summary?.averageOrderValue || 0;
  }

  formatCurrency(value: number): string {
    if (value >= 10000000) return (value / 10000000).toFixed(2) + ' Cr';
    if (value >= 100000) return (value / 100000).toFixed(2) + ' L';
    return value.toLocaleString('en-IN');
  }

  formatChangePct(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}%`;
  }

  getTotalRevenue(): number {
    return this.analyticsData?.summary?.totalRevenue ?? 0;
  }

  getBestSellerPlan(): string {
    if (this.chartData.length === 0) return '';
    const best = this.chartData.reduce((prev, current) =>
      prev.purchases > current.purchases ? prev : current
    );
    return best.planTitle || best.plan;
  }

  getPlanSharePct(revenue: number): string {
    const total = this.getTotalRevenue();
    if (!total) return '0%';
    return `${((revenue / total) * 100).toFixed(1)}%`;
  }

  get tableRows(): PlanBreakdownItem[] {
    return this.analyticsData?.planBreakdown || [];
  }

  get hasChartData(): boolean {
    return (this.analyticsData?.summary?.totalPurchases || 0) > 0;
  }

  get hasTrendData(): boolean {
    return (this.analyticsData?.timeSeries?.length || 0) > 0;
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    toast.present();
  }
}
