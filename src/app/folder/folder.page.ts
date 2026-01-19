import { Component, inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, MenuController, ToastController } from '@ionic/angular';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { AnalyticsService, PlanWiseEarning, UserAnalytics, EarningsAnalytics, BestsellerPlan } from '../services/analytics.service';

Chart.register(...registerables);

interface SubscriptionPlan {
  plan: string;
  purchases: number;
  revenue: number;
}

@Component({
  selector: 'app-folder',
  templateUrl: './folder.page.html',
  styleUrls: ['./folder.page.scss'],
  standalone: false,
})
export class FolderPage implements OnInit, AfterViewInit, OnDestroy {
  public folder!: string;
  private activatedRoute = inject(ActivatedRoute);
  
  @ViewChild('barChartCanvas', { static: false }) barChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutChartCanvas', { static: false }) doughnutChartCanvas!: ElementRef<HTMLCanvasElement>;
  
  subscriptionData: SubscriptionPlan[] = [];
  filteredData: SubscriptionPlan[] = [];
  selectedDateRange: string = '30';
  isLoading: boolean = false;
  
  // Dashboard analytics properties
  userAnalytics: UserAnalytics | null = null;
  earningsAnalytics: EarningsAnalytics | null = null;
  bestsellerPlan: BestsellerPlan | null = null;
  isLoadingAnalytics: boolean = false;
  
  barChart: Chart | null = null;
  doughnutChart: Chart | null = null;
  
  insights = {
    bestSellingPlan: '',
    highestRevenuePlan: '',
    averageValue: 0
  };
  
  showCustomDatePicker: boolean = false;

  constructor(
    private menuController: MenuController,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private analyticsService: AnalyticsService
  ) {}

  ngOnInit() {
    this.folder = this.activatedRoute.snapshot.paramMap.get('id') as string;
    this.loadDashboardAnalytics();
    this.loadSubscriptionData();
  }

  ngAfterViewInit() {
    // Wait for view to be fully initialized
    setTimeout(() => {
      if (this.filteredData.length > 0) {
        this.initializeCharts();
      }
    }, 200);
  }

  ngOnDestroy() {
    this.destroyCharts();
  }

  ionViewDidEnter() {
    this.menuController.enable(true);
  }

  async loadDashboardAnalytics() {
    this.isLoadingAnalytics = true;
    
    try {
      // Fetch all analytics data in parallel
      const [userData, earningsData, bestsellerData] = await Promise.all([
        this.analyticsService.getUserAnalytics().toPromise(),
        this.analyticsService.getEarningsAnalytics().toPromise(),
        this.analyticsService.getBestsellerPlans().toPromise()
      ]);
      
      // Assign data
      if (userData) {
        this.userAnalytics = userData;
      }
      
      if (earningsData) {
        this.earningsAnalytics = earningsData;
      }
      
      if (bestsellerData && bestsellerData.bestsellerPlan) {
        this.bestsellerPlan = bestsellerData.bestsellerPlan;
      }
      
      this.isLoadingAnalytics = false;
    } catch (error: any) {
      this.isLoadingAnalytics = false;
      const errorMessage = error?.message || 'Failed to load dashboard analytics. Please try again.';
      this.presentToast(errorMessage, 'danger');
      console.error('Error loading dashboard analytics:', error);
      
      // Set default values on error
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
    }
  }

  async loadSubscriptionData() {
    this.isLoading = true;
    
    try {
      const dateRange = this.getDateRange(this.selectedDateRange);
      
      // Fetch bestseller plans data
      const bestsellerData = await this.analyticsService.getBestsellerPlans(
        dateRange.startDate,
        dateRange.endDate
      ).toPromise();
      
      // Fetch earnings data for revenue
      const earningsData = await this.analyticsService.getEarningsAnalytics(
        dateRange.startDate,
        dateRange.endDate
      ).toPromise();
      
      // Map backend data to frontend format
      this.subscriptionData = this.mapBestsellerToSubscriptionPlan(
        bestsellerData?.topPlans || [],
        earningsData?.planWiseEarnings || []
      );
      
      this.onDateRangeChange(this.selectedDateRange);
      this.calculateInsights();
      this.isLoading = false;
      
      // Initialize charts after data is loaded and view is ready
      setTimeout(() => {
        this.initializeCharts();
      }, 300);
    } catch (error: any) {
      this.isLoading = false;
      const errorMessage = error?.message || 'Failed to load analytics data. Please try again.';
      this.presentToast(errorMessage, 'danger');
      console.error('Error loading subscription data:', error);
      
      // Use empty data on error
      this.subscriptionData = [];
      this.filteredData = [];
    }
  }
  
  /**
   * Map bestseller plans and earnings data to SubscriptionPlan format
   */
  private mapBestsellerToSubscriptionPlan(
    bestsellerPlans: any[],
    planWiseEarnings: PlanWiseEarning[]
  ): SubscriptionPlan[] {
    // Create a map of plan earnings by plan ID
    const earningsMap = new Map<string, PlanWiseEarning>();
    planWiseEarnings.forEach(earning => {
      earningsMap.set(earning._id.toString(), earning);
    });
    
    // Map bestseller plans to SubscriptionPlan format
    return bestsellerPlans.map(plan => {
      const earning = earningsMap.get(plan._id.toString());
      const durationLabel = this.getDurationLabel(plan.durationInMonths);
      
      return {
        plan: durationLabel,
        purchases: plan.purchaseCount || 0,
        revenue: earning?.totalAmount || (plan.price * plan.purchaseCount) || 0
      };
    });
  }
  
  /**
   * Get duration label from months
   */
  private getDurationLabel(months: number): string {
    switch (months) {
      case 1:
        return '1 Month';
      case 3:
        return '3 Months';
      case 6:
        return '6 Months';
      case 12:
        return '12 Months';
      default:
        return `${months} Month${months > 1 ? 's' : ''}`;
    }
  }
  
  /**
   * Get date range based on selected range
   */
  private getDateRange(range: string): { startDate?: string; endDate?: string } {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const endDate = today.toISOString().split('T')[0];
    
    let startDate: Date;
    
    switch (range) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate
        };
      case '7':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate
        };
      case '30':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate
        };
      default:
        return {};
    }
  }
  
  /**
   * Present toast notification
   */
  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    toast.present();
  }

  async onDateRangeChange(range: string) {
    this.selectedDateRange = range;
    this.isLoading = true;
    
    try {
      const dateRange = this.getDateRange(range);
      
      // Fetch bestseller plans data with date filter
      const bestsellerData = await this.analyticsService.getBestsellerPlans(
        dateRange.startDate,
        dateRange.endDate
      ).toPromise();
      
      // Fetch earnings data for revenue
      const earningsData = await this.analyticsService.getEarningsAnalytics(
        dateRange.startDate,
        dateRange.endDate
      ).toPromise();
      
      // Map backend data to frontend format
      this.subscriptionData = this.mapBestsellerToSubscriptionPlan(
        bestsellerData?.topPlans || [],
        earningsData?.planWiseEarnings || []
      );
      
      this.filteredData = [...this.subscriptionData];
      this.calculateInsights();
      
      if (this.barChart && this.doughnutChart) {
        this.updateCharts();
      } else if (this.filteredData.length > 0) {
        // Initialize charts if they don't exist yet
        setTimeout(() => {
          this.initializeCharts();
        }, 100);
      }
      
      this.isLoading = false;
    } catch (error: any) {
      this.isLoading = false;
      const errorMessage = error?.message || 'Failed to load analytics data. Please try again.';
      this.presentToast(errorMessage, 'danger');
      console.error('Error loading analytics data:', error);
    }
  }

  initializeCharts() {
    if (!this.barChartCanvas || !this.doughnutChartCanvas) {
      return;
    }

    // Destroy existing charts if they exist
    this.destroyCharts();

    const barCtx = this.barChartCanvas.nativeElement.getContext('2d');
    const doughnutCtx = this.doughnutChartCanvas.nativeElement.getContext('2d');

    if (!barCtx || !doughnutCtx || this.filteredData.length === 0) {
      return;
    }

    // Find best selling plan
    const bestSeller = this.filteredData.reduce((prev, current) => 
      (prev.purchases > current.purchases) ? prev : current
    );

    // Bar Chart Configuration
    const barConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: this.filteredData.map(d => d.plan),
        datasets: [{
          label: 'Purchases',
          data: this.filteredData.map(d => d.purchases),
          backgroundColor: this.filteredData.map(d => 
            d.plan === bestSeller.plan ? '#0f1115' : '#4c5160'
          ),
          borderColor: this.filteredData.map(d => 
            d.plan === bestSeller.plan ? '#0f1115' : '#4c5160'
          ),
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f1115',
            padding: 12,
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#e3e6ee',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                return `${context.parsed.y} purchases`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#e3e6ee'
            },
            ticks: {
              color: '#4c5160',
              font: {
                size: 12
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#4c5160',
              font: {
                size: 12
              }
            }
          }
        }
      }
    };

    // Doughnut Chart Configuration
    const totalRevenue = this.filteredData.reduce((sum, d) => sum + d.revenue, 0);
    const colors = ['#0f1115', '#4c5160', '#6a7182', '#9aa0ad'];

    const doughnutConfig: any = {
      type: 'doughnut',
      data: {
        labels: this.filteredData.map(d => d.plan),
        datasets: [{
          data: this.filteredData.map(d => d.revenue),
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
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f1115',
            padding: 12,
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#e3e6ee',
            borderWidth: 1,
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed;
                const percentage = ((value / totalRevenue) * 100).toFixed(1);
                return `${label}: ₹${this.formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    this.barChart = new Chart(barCtx, barConfig);
    this.doughnutChart = new Chart(doughnutCtx, doughnutConfig);
  }

  updateCharts() {
    if (!this.barChart || !this.doughnutChart) {
      return;
    }

    const bestSeller = this.filteredData.reduce((prev, current) => 
      (prev.purchases > current.purchases) ? prev : current
    );

    // Update bar chart
    this.barChart.data.labels = this.filteredData.map(d => d.plan);
    this.barChart.data.datasets[0].data = this.filteredData.map(d => d.purchases);
    this.barChart.data.datasets[0].backgroundColor = this.filteredData.map(d => 
      d.plan === bestSeller.plan ? '#0f1115' : '#4c5160'
    );
    this.barChart.data.datasets[0].borderColor = this.filteredData.map(d => 
      d.plan === bestSeller.plan ? '#0f1115' : '#4c5160'
    );
    this.barChart.update();

    // Update doughnut chart
    const totalRevenue = this.filteredData.reduce((sum, d) => sum + d.revenue, 0);
    this.doughnutChart.data.labels = this.filteredData.map(d => d.plan);
    this.doughnutChart.data.datasets[0].data = this.filteredData.map(d => d.revenue);
    this.doughnutChart.update();
  }

  destroyCharts() {
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
    if (this.filteredData.length === 0) {
      return;
    }

    // Best selling plan
    const bestSeller = this.filteredData.reduce((prev, current) => 
      (prev.purchases > current.purchases) ? prev : current
    );
    this.insights.bestSellingPlan = bestSeller.plan;

    // Highest revenue plan
    const highestRevenue = this.filteredData.reduce((prev, current) => 
      (prev.revenue > current.revenue) ? prev : current
    );
    this.insights.highestRevenuePlan = highestRevenue.plan;

    // Average subscription value
    const totalRevenue = this.filteredData.reduce((sum, d) => sum + d.revenue, 0);
    const totalPurchases = this.filteredData.reduce((sum, d) => sum + d.purchases, 0);
    this.insights.averageValue = totalPurchases > 0 ? Math.round(totalRevenue / totalPurchases) : 0;
  }

  formatCurrency(value: number): string {
    // Indian numbering system
    if (value >= 10000000) {
      return (value / 10000000).toFixed(2) + ' Cr';
    } else if (value >= 100000) {
      return (value / 100000).toFixed(2) + ' L';
    } else {
      return value.toLocaleString('en-IN');
    }
  }

  getTotalRevenue(): number {
    return this.filteredData.reduce((sum, d) => sum + d.revenue, 0);
  }

  getBestSellerPlan(): string {
    if (this.filteredData.length === 0) return '';
    const bestSeller = this.filteredData.reduce((prev, current) => 
      (prev.purchases > current.purchases) ? prev : current
    );
    return bestSeller.plan;
  }

  async onCustomDateChange(event: any) {
    this.showCustomDatePicker = false;
    const selectedDate = event.detail.value;
    
    if (selectedDate) {
      const date = new Date(selectedDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const startDate = date.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      this.isLoading = true;
      
      try {
        // Fetch data with custom date range
        const bestsellerData = await this.analyticsService.getBestsellerPlans(
          startDate,
          endDate
        ).toPromise();
        
        const earningsData = await this.analyticsService.getEarningsAnalytics(
          startDate,
          endDate
        ).toPromise();
        
        this.subscriptionData = this.mapBestsellerToSubscriptionPlan(
          bestsellerData?.topPlans || [],
          earningsData?.planWiseEarnings || []
        );
        
        this.filteredData = [...this.subscriptionData];
        this.calculateInsights();
        
        if (this.barChart && this.doughnutChart) {
          this.updateCharts();
        } else if (this.filteredData.length > 0) {
          setTimeout(() => {
            this.initializeCharts();
          }, 100);
        }
        
        this.isLoading = false;
      } catch (error: any) {
        this.isLoading = false;
        const errorMessage = error?.message || 'Failed to load analytics data. Please try again.';
        this.presentToast(errorMessage, 'danger');
        console.error('Error loading custom date analytics:', error);
      }
    }
  }
}
