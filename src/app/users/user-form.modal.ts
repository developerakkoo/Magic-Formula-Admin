import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController, LoadingController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UsersService, User } from './users.service';
import { SubscriptionService, Plan } from '../services/subscription.service';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.modal.html',
  styleUrls: ['./user-form.modal.scss'],
  standalone: false
})
export class UserFormModalComponent implements OnInit {
  @Input() user?: User;
  userForm: FormGroup;
  isEditMode: boolean = false;
  availablePlans: Plan[] = [];
  isLoadingPlans: boolean = false;
  selectedPlanId: string = '';

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private usersService: UsersService,
    private subscriptionService: SubscriptionService,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {
    this.userForm = this.formBuilder.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],
      whatsapp: [''],
      assignPlan: ['']
    });
  }

  async ngOnInit() {
    await this.loadPlans();
    
    if (this.user) {
      this.isEditMode = true;
      this.userForm.patchValue({
        fullName: this.user.fullName || '',
        email: this.user.email || '',
        mobile: this.user.mobile || '',
        whatsapp: this.user.whatsapp || ''
      });
      // Disable mobile in edit mode since it's unique and shouldn't be changed
      this.userForm.get('mobile')?.disable();
      // Note: Don't set assignPlan for edit mode - subscription assignment should be done separately
    }
  }

  async loadPlans() {
    this.isLoadingPlans = true;
    try {
      const plans = await this.subscriptionService.getAllPlans().toPromise();
      this.availablePlans = (plans || []).filter(plan => plan.isActive);
      // Filter only active plans
    } catch (error: any) {
      console.error('Error loading plans:', error);
      this.availablePlans = [];
    } finally {
      this.isLoadingPlans = false;
    }
  }

  async onSubmit() {
    if (this.userForm.valid) {
      const loading = await this.loadingController.create({
        message: this.isEditMode ? 'Updating user...' : 'Creating user...',
        spinner: 'crescent'
      });
      await loading.present();

      try {
        const formData: any = {
          fullName: this.userForm.value.fullName,
          email: this.userForm.value.email,
          whatsapp: this.userForm.value.whatsapp || undefined
        };

        // Include mobile only for new users (it's disabled in edit mode)
        if (!this.isEditMode) {
          formData.mobile = this.userForm.value.mobile;
        }

        let createdOrUpdatedUser: User | null = null;

        if (this.isEditMode && this.user?._id) {
          createdOrUpdatedUser = await this.usersService.updateUser(this.user._id, formData).toPromise() ?? null;
          this.presentToast('User updated successfully', 'success');
        } else {
          createdOrUpdatedUser = await this.usersService.createUser(formData).toPromise() ?? null;
          this.presentToast('User created successfully', 'success');
        }

        if (!createdOrUpdatedUser?._id) {
          throw new Error('User save did not return an ID.');
        }

        // Assign subscription if plan is selected
        const planId = this.userForm.value.assignPlan;
        if (planId && createdOrUpdatedUser._id) {
          try {
            await this.usersService.assignSubscription(createdOrUpdatedUser._id, planId).toPromise();
            this.presentToast('Subscription assigned successfully', 'success');
          } catch (subError: any) {
            console.error('Error assigning subscription:', subError);
            this.presentToast('User created but failed to assign subscription', 'warning');
          }
        }

        loading.dismiss();
        this.modalController.dismiss({ success: true });
      } catch (error: any) {
        loading.dismiss();
        const errorMessage = error?.message || error?.error?.message || 'Failed to save user. Please try again.';
        this.presentToast(errorMessage, 'danger');
      }
    } else {
      this.presentToast('Please fill all required fields correctly', 'warning');
    }
  }

  cancel() {
    this.modalController.dismiss();
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

