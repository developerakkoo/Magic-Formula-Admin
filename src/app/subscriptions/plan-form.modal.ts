import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { Plan } from '../services/subscription.service';

@Component({
  selector: 'app-plan-form',
  templateUrl: './plan-form.modal.html',
  styleUrls: ['./plan-form.modal.scss'],
  standalone: false
})
export class PlanFormModalComponent implements OnInit, OnDestroy {
  @Input() plan?: Plan;
  planForm: FormGroup;
  isEditMode: boolean = false;
  private countdownInterval: any;

  private cachedMinDate: string;

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    // Cache minDate to prevent ExpressionChangedAfterItHasBeenCheckedError
    this.cachedMinDate = new Date().toISOString();
    this.planForm = this.formBuilder.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      durationInMonths: [1, Validators.required],
      description: this.formBuilder.array([], [Validators.required, this.minArrayLength(1)]),
      actualPrice: [0, [Validators.required, Validators.min(0)]],
      discountedPrice: [0, [Validators.required, Validators.min(0)]],
      showOfferBadge: [false],
      offerText: ['', Validators.maxLength(30)],
      offerStartAt: [''],
      offerEndAt: [''],
      isActive: [true]
    }, { validators: this.priceValidator.bind(this) });
  }

  ngOnInit() {
    if (this.plan) {
      this.isEditMode = true;
      this.loadPlanData();
    } else {
      // Add one empty description point for new plan
      this.addDescriptionPoint();
    }

    // Watch for offer badge toggle
    this.planForm.get('showOfferBadge')?.valueChanges.subscribe(value => {
      this.updateOfferBadgeValidators(value);
    });

    // Watch for start date changes to update end date min
    this.planForm.get('offerStartAt')?.valueChanges.subscribe(() => {
      const endDateControl = this.planForm.get('offerEndAt');
      if (endDateControl) {
        endDateControl.updateValueAndValidity();
      }
    });

    // Start countdown timer if offer dates are set
    this.startCountdownTimer();
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  loadPlanData() {
    const plan = this.plan!;
    
    // Clear existing description points
    while (this.descriptionArray.length !== 0) {
      this.descriptionArray.removeAt(0);
    }

    // Add description points
    if (plan.description && plan.description.length > 0) {
      plan.description.forEach((point: string) => {
        this.addDescriptionPoint(point);
      });
    } else {
      this.addDescriptionPoint();
    }

    // Format dates for ion-datetime
    const formatDateForInput = (date?: Date | string) => {
      if (!date) return '';
      const d = date instanceof Date ? date : new Date(date);
      return d.toISOString().split('T')[0];
    };

    this.planForm.patchValue({
      title: plan.title || '',
      durationInMonths: plan.durationInMonths || 1,
      actualPrice: plan.actualPrice || 0,
      discountedPrice: plan.discountedPrice || 0,
      showOfferBadge: plan.showOfferBadge || false,
      offerText: plan.offerText || '',
      offerStartAt: formatDateForInput(plan.offerStartAt),
      offerEndAt: formatDateForInput(plan.offerEndAt),
      isActive: plan.isActive !== undefined ? plan.isActive : true
    });

    this.updateOfferBadgeValidators(plan.showOfferBadge || false);
  }

  get descriptionArray(): FormArray {
    return this.planForm.get('description') as FormArray;
  }

  addDescriptionPoint(value: string = '') {
    if (this.descriptionArray.length >= 6) {
      this.presentToast('Maximum 6 description points allowed', 'warning');
      return;
    }
    this.descriptionArray.push(
      this.formBuilder.control(value, [Validators.required, Validators.maxLength(200)])
    );
  }

  removeDescriptionPoint(index: number) {
    if (this.descriptionArray.length > 1) {
      this.descriptionArray.removeAt(index);
    } else {
      this.presentToast('At least one description point is required', 'warning');
    }
  }

  updateOfferBadgeValidators(showOffer: boolean) {
    const offerTextControl = this.planForm.get('offerText');
    const offerStartAtControl = this.planForm.get('offerStartAt');
    const offerEndAtControl = this.planForm.get('offerEndAt');

    if (showOffer) {
      offerTextControl?.setValidators([Validators.required, Validators.maxLength(30)]);
      offerStartAtControl?.setValidators([Validators.required]);
      offerEndAtControl?.setValidators([Validators.required]);
    } else {
      offerTextControl?.clearValidators();
      offerStartAtControl?.clearValidators();
      offerEndAtControl?.clearValidators();
    }

    offerTextControl?.updateValueAndValidity();
    offerStartAtControl?.updateValueAndValidity();
    offerEndAtControl?.updateValueAndValidity();
  }

  priceValidator(control: AbstractControl): { [key: string]: any } | null {
    const actualPrice = control.get('actualPrice')?.value;
    const discountedPrice = control.get('discountedPrice')?.value;
    
    if (actualPrice && discountedPrice && discountedPrice >= actualPrice) {
      return { invalidPrice: true };
    }
    return null;
  }

  minArrayLength(min: number) {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const array = control.value as string[];
      if (!array || array.length < min) {
        return { minArrayLength: { required: min, actual: array?.length || 0 } };
      }
      return null;
    };
  }

  getTimeRemaining(): string {
    const endDate = this.planForm.get('offerEndAt')?.value;
    if (!endDate) return '';

    const now = new Date();
    const end = new Date(endDate);
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

  startCountdownTimer() {
    // Update countdown every minute
    this.countdownInterval = setInterval(() => {
      if (this.planForm.get('showOfferBadge')?.value && this.planForm.get('offerEndAt')?.value) {
        // Use ChangeDetectorRef to properly trigger change detection
        this.cdr.detectChanges();
      }
    }, 60000);
  }

  async onSubmit() {
    if (this.planForm.valid) {
      // Validate dates
      const showOffer = this.planForm.get('showOfferBadge')?.value;
      if (showOffer) {
        const startDate = this.planForm.get('offerStartAt')?.value;
        const endDate = this.planForm.get('offerEndAt')?.value;

        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          if (end <= start) {
            this.presentToast('End date must be after start date', 'danger');
            return;
          }
        }
      }

      const formData = {
        ...this.planForm.value,
        description: this.descriptionArray.value.filter((point: string) => point.trim() !== ''),
        offerStartAt: showOffer && this.planForm.get('offerStartAt')?.value 
          ? new Date(this.planForm.get('offerStartAt')?.value) 
          : undefined,
        offerEndAt: showOffer && this.planForm.get('offerEndAt')?.value 
          ? new Date(this.planForm.get('offerEndAt')?.value) 
          : undefined,
        offerText: showOffer ? this.planForm.get('offerText')?.value : undefined
      };

      if (this.isEditMode && this.plan?._id) {
        formData._id = this.plan._id;
      }

      this.modalController.dismiss({ success: true, plan: formData });
    } else {
      this.markFormGroupTouched(this.planForm);
      this.presentToast('Please fill all required fields correctly', 'warning');
    }
  }

  cancel() {
    this.modalController.dismiss();
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          arrayControl.markAsTouched();
        });
      }
    });
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    toast.present();
  }

  get offerTextLength(): number {
    return this.planForm.get('offerText')?.value?.length || 0;
  }

  get minDate(): string {
    return this.cachedMinDate;
  }

  get minEndDate(): string {
    const startDate = this.planForm.get('offerStartAt')?.value;
    if (startDate) {
      return startDate;
    }
    return this.cachedMinDate;
  }
}

