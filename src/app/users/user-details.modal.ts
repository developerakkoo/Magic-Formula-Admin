import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { User, UsersService } from './users.service';
import { UserFormModalComponent } from './user-form.modal';
import { SubscriptionService, Plan } from '../services/subscription.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.modal.html',
  styleUrls: ['./user-details.modal.scss'],
  standalone: false
})
export class UserDetailsModalComponent implements OnInit {
  @Input() user!: User;
  availablePlans: Plan[] = [];
  isLoadingPlans: boolean = false;
  selectedPlanId: string = '';

  constructor(
    private modalController: ModalController,
    private usersService: UsersService,
    private subscriptionService: SubscriptionService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  async ngOnInit() {
    await this.loadPlans();
  }

  async loadPlans() {
    this.isLoadingPlans = true;
    try {
      const plans = await this.subscriptionService.getAllPlans().toPromise();
      this.availablePlans = (plans || []).filter(plan => plan.isActive);
    } catch (error) {
      console.error('Error loading plans:', error);
      this.availablePlans = [];
    } finally {
      this.isLoadingPlans = false;
    }
  }

  /**
   * Allow the user to login from a new device by resetting stored deviceId.
   */
  async resetDevice() {
    if (!this.user?._id) {
      this.presentToast('Invalid user', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Reset Device',
      message: 'This will allow the user to login from a new device. Proceed?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reset',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Resetting device...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await firstValueFrom(this.usersService.allowNewDevice(this.user._id!));
              this.presentToast('Device reset successfully', 'success');
              this.modalController.dismiss({ refresh: true });
            } catch (error: any) {
              const msg = error?.message || 'Failed to reset device. Please try again.';
              this.presentToast(msg, 'danger');
            } finally {
              loading.dismiss();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async editUser() {
    const modal = await this.modalController.create({
      component: UserFormModalComponent,
      componentProps: { user: this.user }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        this.modalController.dismiss({ refresh: true });
      }
    });

    await modal.present();
  }

  async assignSubscription() {
    if (!this.selectedPlanId) {
      this.presentToast('Please select a plan', 'warning');
      return;
    }

    if (!this.user._id) {
      this.presentToast('Invalid user', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Assignment',
      message: 'This will replace the user\'s current subscription. Continue?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Assign',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Assigning subscription...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.usersService.assignSubscription(this.user._id!, this.selectedPlanId).toPromise();
              loading.dismiss();
              this.presentToast('Subscription assigned successfully', 'success');
              this.selectedPlanId = '';
              this.modalController.dismiss({ refresh: true });
            } catch (error: any) {
              loading.dismiss();
              const errorMessage = error?.message || 'Failed to assign subscription. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  close() {
    this.modalController.dismiss();
  }

  isPlanActive(): boolean {
    if (!this.user?.planExpiry) {
      return false;
    }
    const expiryDate = this.user.planExpiry instanceof Date 
      ? this.user.planExpiry 
      : new Date(this.user.planExpiry);
    return expiryDate > new Date();
  }

  async approveRegistration() {
    if (!this.user?._id) return;
    const loading = await this.loadingController.create({ message: 'Approving registration...' });
    await loading.present();
    try {
      await firstValueFrom(this.usersService.approveRegistration(this.user._id));
      this.presentToast('Registration approved', 'success');
      this.modalController.dismiss({ refresh: true });
    } catch (error: any) {
      this.presentToast(error?.message || 'Failed to approve registration', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async rejectRegistration() {
    if (!this.user?._id) return;

    const alert = await this.alertController.create({
      header: 'Reject Registration',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Rejection reason (optional)'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          role: 'destructive',
          handler: async (data) => {
            const loading = await this.loadingController.create({ message: 'Rejecting registration...' });
            await loading.present();
            try {
              await firstValueFrom(
                this.usersService.rejectRegistration(this.user._id!, data?.reason)
              );
              this.presentToast('Registration rejected', 'success');
              this.modalController.dismiss({ refresh: true });
            } catch (error: any) {
              this.presentToast(error?.message || 'Failed to reject registration', 'danger');
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
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

