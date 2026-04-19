import { Component, OnInit, OnDestroy } from '@angular/core';
import { ModalController, ToastController, AlertController, LoadingController } from '@ionic/angular';
import { PlanFormModalComponent } from './plan-form.modal';
import { SubscriptionService, Plan } from '../services/subscription.service';

@Component({
  selector: 'app-subscriptions',
  templateUrl: './subscriptions.page.html',
  styleUrls: ['./subscriptions.page.scss'],
  standalone: false
})
export class SubscriptionsPage implements OnInit, OnDestroy {
  plans: Plan[] = [];
  filteredPlans: Plan[] = [];
  isLoading: boolean = false;
  searchQuery: string = '';
  filterActive: 'all' | 'active' | 'inactive' = 'all';
  private countdownInterval: any;

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private subscriptionService: SubscriptionService
  ) {}

  ngOnInit() {
    this.loadPlans();
    this.startCountdownTimer();
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  loadPlans() {
    this.isLoading = true;
    this.subscriptionService.getAllPlans().subscribe({
      next: (plans) => {
        // Convert date strings to Date objects
        this.plans = plans.map(plan => ({
          ...plan,
          offerStartAt: plan.offerStartAt ? new Date(plan.offerStartAt) : undefined,
          offerEndAt: plan.offerEndAt ? new Date(plan.offerEndAt) : undefined,
          createdAt: plan.createdAt ? new Date(plan.createdAt) : undefined,
          updatedAt: plan.updatedAt ? new Date(plan.updatedAt) : undefined
        }));
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        const errorMessage = error?.message || 'Failed to load plans. Please try again.';
        this.presentToast(errorMessage, 'danger');
      }
    });
  }

  applyFilters() {
    let result = [...this.plans];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(plan => 
        plan.title.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (this.filterActive !== 'all') {
      result = result.filter(plan => {
        return this.filterActive === 'active' ? plan.isActive : !plan.isActive;
      });
    }

    this.filteredPlans = result;
  }

  onSearch() {
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  isOfferActive(plan: Plan): boolean {
    if (!plan.showOfferBadge || !plan.offerStartAt || !plan.offerEndAt) {
      return false;
    }
    const now = new Date();
    const start = new Date(plan.offerStartAt);
    const end = new Date(plan.offerEndAt);
    return now >= start && now <= end;
  }

  getTimeRemaining(plan: Plan): string {
    if (!this.isOfferActive(plan) || !plan.offerEndAt) {
      return '';
    }

    const now = new Date();
    const end = new Date(plan.offerEndAt);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Expired';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  getOfferStatus(plan: Plan): string {
    if (!plan.offerStartAt || !plan.offerEndAt) {
      return 'Not configured';
    }

    const now = new Date();
    const start = new Date(plan.offerStartAt);
    const end = new Date(plan.offerEndAt);

    if (now < start) {
      return 'Starts soon';
    } else if (now > end) {
      return 'Expired';
    } else {
      return this.getTimeRemaining(plan) + ' remaining';
    }
  }

  startCountdownTimer() {
    // Update countdown every minute
    this.countdownInterval = setInterval(() => {
      // Trigger change detection for countdown updates
      this.filteredPlans = [...this.filteredPlans];
    }, 60000);
  }

  async addSubscription() {
    const modal = await this.modalController.create({
      component: PlanFormModalComponent,
      componentProps: { existingPlans: [...this.plans] }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        if (data.data.plan) {
          this.addPlan(data.data.plan);
        }
      }
    });

    return await modal.present();
  }

  async editPlan(plan: Plan) {
    // Create a deep copy of the plan to avoid mutating the original
    const planCopy: Plan = {
      ...plan,
      description: [...plan.description],
      offerStartAt: plan.offerStartAt ? new Date(plan.offerStartAt) : undefined,
      offerEndAt: plan.offerEndAt ? new Date(plan.offerEndAt) : undefined,
      createdAt: plan.createdAt ? new Date(plan.createdAt) : undefined,
      updatedAt: plan.updatedAt ? new Date(plan.updatedAt) : undefined
    };

    const modal = await this.modalController.create({
      component: PlanFormModalComponent,
      componentProps: { plan: planCopy, existingPlans: [...this.plans] }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        if (data.data.plan) {
          this.updatePlan(data.data.plan);
        }
      }
    });

    return await modal.present();
  }

  async deletePlan(plan: Plan) {
    if (!plan._id) {
      this.presentToast('Invalid plan', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${plan.title}"? This will deactivate the plan.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting plan...',
              spinner: 'crescent'
            });
            await loading.present();

            this.subscriptionService.deletePlan(plan._id!).subscribe({
              next: () => {
                loading.dismiss();
                // Reload all plans from API to ensure we have the latest data
                this.loadPlans();
                this.presentToast('Plan deleted successfully', 'success');
              },
              error: (error) => {
                loading.dismiss();
                const errorMessage = error?.message || 'Failed to delete plan. Please try again.';
                this.presentToast(errorMessage, 'danger');
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  async togglePlanStatus(plan: Plan) {
    if (!plan._id) {
      this.presentToast('Invalid plan', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: `${plan.isActive ? 'Deactivating' : 'Activating'} plan...`,
      spinner: 'crescent'
    });
    await loading.present();

    const newStatus = !plan.isActive;
    this.subscriptionService.updatePlan(plan._id, { isActive: newStatus }).subscribe({
      next: () => {
        loading.dismiss();
        // Reload all plans from API to ensure we have the latest data
        this.loadPlans();
        this.presentToast(
          `Plan ${newStatus ? 'activated' : 'deactivated'} successfully`,
          'success'
        );
      },
      error: (error) => {
        loading.dismiss();
        const errorMessage = error?.message || 'Failed to update plan status. Please try again.';
        this.presentToast(errorMessage, 'danger');
      }
    });
  }

  async addPlan(plan: Plan) {
    const loading = await this.loadingController.create({
      message: 'Creating plan...',
      spinner: 'crescent'
    });
    await loading.present();

    this.subscriptionService.createPlan(plan).subscribe({
      next: () => {
        loading.dismiss();
        // Reload all plans from API to ensure we have the latest data
        this.loadPlans();
        this.presentToast('Plan created successfully', 'success');
      },
      error: (error) => {
        loading.dismiss();
        const errorMessage = error?.message || 'Failed to create plan. Please try again.';
        this.presentToast(errorMessage, 'danger');
      }
    });
  }

  async updatePlan(updatedPlan: Plan) {
    if (!updatedPlan._id) {
      this.presentToast('Invalid plan', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Updating plan...',
      spinner: 'crescent'
    });
    await loading.present();

    this.subscriptionService.updatePlan(updatedPlan._id, updatedPlan).subscribe({
      next: () => {
        loading.dismiss();
        // Reload all plans from API to ensure we have the latest data
        this.loadPlans();
        this.presentToast('Plan updated successfully', 'success');
      },
      error: (error) => {
        loading.dismiss();
        const errorMessage = error?.message || 'Failed to update plan. Please try again.';
        this.presentToast(errorMessage, 'danger');
      }
    });
  }

  getDurationBadge(duration: number): { text: string; color: string } {
    const badges: { [key: number]: { text: string; color: string } } = {
      1: { text: '1 Month', color: 'primary' },
      3: { text: '3 Months', color: 'success' },
      6: { text: '6 Months', color: 'warning' },
      12: { text: '12 Months', color: 'danger' }
    };
    return badges[duration] || { text: `${duration}M`, color: 'medium' };
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    toast.present();
  }
}
