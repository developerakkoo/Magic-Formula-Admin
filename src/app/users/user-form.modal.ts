import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController, LoadingController } from '@ionic/angular';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UsersService, User, AdminUpdateUserRequest } from './users.service';
import { SubscriptionService, Plan } from '../services/subscription.service';
import { generateSecurePassword } from '../utils/secure-password';

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
  obscurePassword = true;

  private readonly passwordsMatchValidator: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    const pass = group.get('password')?.value ?? '';
    const confirm = group.get('confirmPassword')?.value ?? '';
    return pass === confirm ? null : { passwordMismatch: true };
  };

  /** Optional new password in edit mode (both empty = skip PATCH password). */
  private readonly editPasswordOptionalValidator: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    const p = String(group.get('editPassword')?.value ?? '').trim();
    const c = String(group.get('editConfirmPassword')?.value ?? '').trim();
    if (!p && !c) return null;
    if (!p || !c) return { editPasswordIncomplete: true };
    if (p.length < 8) return { editPasswordTooShort: true };
    if (p !== c) return { editPasswordMismatch: true };
    return null;
  };

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
      assignPlan: [''],
      password: [''],
      confirmPassword: [''],
      editPassword: [''],
      editConfirmPassword: [''],
    });
  }

  async ngOnInit() {
    await this.loadPlans();

    if (this.user?._id) {
      this.isEditMode = true;
      try {
        const fresh = await firstValueFrom(
          this.usersService.getUserById(this.user._id)
        );
        if (fresh) {
          this.user = fresh;
        }
      } catch (e) {
        console.error('Failed to load user detail', e);
      }

      this.userForm.patchValue({
        fullName: this.user?.fullName || '',
        email: this.user?.email || '',
        mobile: this.user?.mobile || '',
        whatsapp: this.user?.whatsapp || '',
        password: '',
        confirmPassword: '',
        editPassword: '',
        editConfirmPassword: '',
      });
      this.userForm.get('mobile')?.disable();
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('confirmPassword')?.clearValidators();
      this.userForm.removeValidators(this.passwordsMatchValidator);
      this.userForm.addValidators(this.editPasswordOptionalValidator);
      this.userForm.get('password')?.updateValueAndValidity({ emitEvent: false });
      this.userForm.get('confirmPassword')?.updateValueAndValidity({
        emitEvent: false,
      });
      this.userForm.updateValueAndValidity({ emitEvent: false });
    } else {
      this.applyCreatePasswordValidatorsAndDefaults();
    }
  }

  private applyCreatePasswordValidatorsAndDefaults(): void {
    const pwd = generateSecurePassword();
    this.userForm.patchValue({ password: pwd, confirmPassword: pwd });
    this.userForm
      .get('password')
      ?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm
      .get('confirmPassword')
      ?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.addValidators(this.passwordsMatchValidator);
    this.userForm.get('password')?.updateValueAndValidity({ emitEvent: false });
    this.userForm
      .get('confirmPassword')
      ?.updateValueAndValidity({ emitEvent: false });
    this.userForm.updateValueAndValidity({ emitEvent: false });
  }

  regeneratePassword(): void {
    const pwd = generateSecurePassword();
    this.userForm.patchValue({ password: pwd, confirmPassword: pwd });
    this.userForm.updateValueAndValidity({ emitEvent: true });
  }

  regenerateEditPassword(): void {
    const pwd = generateSecurePassword();
    this.userForm.patchValue({
      editPassword: pwd,
      editConfirmPassword: pwd,
    });
    this.userForm.updateValueAndValidity({ emitEvent: true });
  }

  togglePasswordVisibility(): void {
    this.obscurePassword = !this.obscurePassword;
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
        let createdOrUpdatedUser: User | null = null;

        if (this.isEditMode && this.user?._id) {
          const formEmailNorm = String(
            this.userForm.value.email ?? ''
          )
            .trim()
            .toLowerCase()
          const savedEmailNorm = String(this.user?.email ?? '')
            .trim()
            .toLowerCase()
          const updatePayload: AdminUpdateUserRequest = {
            fullName: this.userForm.value.fullName,
            whatsapp: this.userForm.value.whatsapp || undefined,
          }
          if (formEmailNorm !== savedEmailNorm) {
            updatePayload.email = this.userForm.value.email
          }
          const newPwd = String(
            this.userForm.get('editPassword')?.value ?? ''
          ).trim();
          const newConfirm = String(
            this.userForm.get('editConfirmPassword')?.value ?? ''
          ).trim();
          if (newPwd || newConfirm) {
            updatePayload.password = newPwd;
          }
          createdOrUpdatedUser =
            (await this.usersService
              .updateUser(this.user._id, updatePayload)
              .toPromise()) ?? null;
          this.presentToast('User updated successfully', 'success');
        } else {
          const formData = {
            fullName: this.userForm.value.fullName,
            email: this.userForm.value.email,
            whatsapp: this.userForm.value.whatsapp || undefined,
            mobile: this.userForm.value.mobile,
            password: this.userForm.value.password,
          };
          createdOrUpdatedUser =
            (await this.usersService.createUser(formData).toPromise()) ?? null;
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

