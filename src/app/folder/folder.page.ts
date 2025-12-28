import { Component, inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, MenuController, ToastController } from '@ionic/angular';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

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
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.folder = this.activatedRoute.snapshot.paramMap.get('id') as string;
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

  loadSubscriptionData() {
    this.isLoading = true;
    // Mock API data
    setTimeout(() => {
      this.subscriptionData = [
        {
          plan: '1 Month',
          purchases: 120,
          revenue: 24000
        },
        {
          plan: '3 Months',
          purchases: 280,
          revenue: 126000
        },
        {
          plan: '6 Months',
          purchases: 180,
          revenue: 162000
        },
        {
          plan: '12 Months',
          purchases: 90,
          revenue: 216000
        }
      ];
      this.onDateRangeChange(this.selectedDateRange);
      this.calculateInsights();
      this.isLoading = false;
      
      // Initialize charts after data is loaded and view is ready
      setTimeout(() => {
        this.initializeCharts();
      }, 300);
    }, 500);
  }

  onDateRangeChange(range: string) {
    this.selectedDateRange = range;
    this.isLoading = true;
    
    // Simulate filtering based on date range
    setTimeout(() => {
      // For demo, we'll use the same data but could filter here
      this.filteredData = [...this.subscriptionData];
      this.calculateInsights();
      
      if (this.barChart && this.doughnutChart) {
        this.updateCharts();
      }
      this.isLoading = false;
    }, 300);
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

  onCustomDateChange(event: any) {
    this.showCustomDatePicker = false;
    // For now, just apply 30 days filter
    // In production, this would filter based on selected date range
    this.onDateRangeChange('30');
  }
}
