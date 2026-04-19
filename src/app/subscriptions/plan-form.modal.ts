import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, tap } from 'rxjs/operators';
import { Plan } from '../services/subscription.service';

@Component({
  selector: 'app-plan-form',
  templateUrl: './plan-form.modal.html',
  styleUrls: ['./plan-form.modal.scss'],
  standalone: false
})
export class PlanFormModalComponent implements OnInit, OnDestroy {
  @Input() plan?: Plan;
  @Input() existingPlans: Plan[] = [];
  planForm: FormGroup;
  isEditMode: boolean = false;
  private countdownInterval: any;
  readonly planCodeListId = `planCode_${Math.random().toString(36).slice(2, 11)}`;
  codeConflictMessage = '';

  private cachedMinDate: string;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    this.cachedMinDate = new Date().toISOString();
    this.planForm = this.formBuilder.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      code: ['', [Validators.required, Validators.maxLength(20)]],
      durationInMonths: [1, Validators.required],
      description: this.formBuilder.array([], [Validators.required, this.minArrayLength(1)]),
      actualPrice: [0, [Validators.required, Validators.min(0)]],
      discountedPrice: [''],
      showOfferBadge: [false],
      offerText: ['', Validators.maxLength(30)],
      offerStartAt: [''],
      offerEndAt: [''],
      isActive: [true],
      isStarterOffer: [false]
    }, { validators: this.priceValidator.bind(this) });
  }

  get codeDatalistOptions(): string[] {
    const codes = (this.existingPlans || [])
      .map((p) => String(p.code || '').toUpperCase().trim())
      .filter(Boolean);
    return [...new Set(codes)].sort();
  }

  ngOnInit() {
    if (this.plan) {
      this.isEditMode = true;
      this.loadPlanData();
    } else {
      this.addDescriptionPoint();
    }

    this.planForm.get('showOfferBadge')?.valueChanges.subscribe((value) => {
      this.updateOfferBadgeValidators(value);
    });

    this.planForm.get('offerStartAt')?.valueChanges.subscribe(() => {
      const endDateControl = this.planForm.get('offerEndAt');
      if (endDateControl) {
        endDateControl.updateValueAndValidity();
      }
    });

    this.planForm
      .get('code')
      ?.valueChanges.pipe(
        debounceTime(250),
        tap((value: string) => {
          const up = String(value || '').toUpperCase();
          if (value != null && value !== up) {
            this.planForm.get('code')?.setValue(up, { emitEvent: false });
          }
        }),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.validatePlanCodeConflict());

    this.validatePlanCodeConflict();
    this.startCountdownTimer();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  private normalizePlanCode(code: string): string {
    return String(code || '')
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9]/g, '');
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  private findPlanCodeConflictMessage(enteredUpper: string): string {
    const incomingNorm = this.normalizePlanCode(enteredUpper);
    if (!incomingNorm.length) {
      return '';
    }

    for (const p of this.existingPlans || []) {
      if (this.isEditMode && this.plan?._id && p._id === this.plan._id) {
        continue;
      }
      const other = String(p.code || '').toUpperCase();
      const otherNorm = this.normalizePlanCode(other);
      if (otherNorm === incomingNorm) {
        return `Conflicts with existing code "${other}" (same normalized form).`;
      }
    }

    for (const p of this.existingPlans || []) {
      if (this.isEditMode && this.plan?._id && p._id === this.plan._id) {
        continue;
      }
      const otherNorm = this.normalizePlanCode(p.code || '');
      if (otherNorm === incomingNorm) {
        continue;
      }
      const minLen = Math.min(incomingNorm.length, otherNorm.length);
      if (minLen < 4) {
        continue;
      }
      if (this.levenshtein(incomingNorm, otherNorm) <= 1) {
        return `Too similar to existing code "${p.code}".`;
      }
    }
    return '';
  }

  private validatePlanCodeConflict(): void {
    const c = this.planForm.get('code');
    if (!c) {
      return;
    }
    const raw = String(c.value || '').trim().toUpperCase();
    if (!raw) {
      this.clearSimilarCodeError(c);
      this.codeConflictMessage = '';
      return;
    }
    const msg = this.findPlanCodeConflictMessage(raw);
    this.codeConflictMessage = msg;
    const errs = c.errors;
    if (msg) {
      c.setErrors({ ...(errs || {}), similarCode: true });
    } else {
      this.clearSimilarCodeError(c);
    }
    this.cdr.markForCheck();
  }

  private clearSimilarCodeError(c: AbstractControl): void {
    const e = c.errors;
    if (!e || !e['similarCode']) {
      return;
    }
    const { similarCode: _s, ...rest } = e;
    c.setErrors(Object.keys(rest).length ? rest : null);
  }

  loadPlanData() {
    const plan = this.plan!;

    while (this.descriptionArray.length !== 0) {
      this.descriptionArray.removeAt(0);
    }

    if (plan.description && plan.description.length > 0) {
      plan.description.forEach((point: string) => {
        this.addDescriptionPoint(point);
      });
    } else {
      this.addDescriptionPoint();
    }

    const formatDateForInput = (date?: Date | string) => {
      if (!date) return '';
      const d = date instanceof Date ? date : new Date(date);
      return d.toISOString().split('T')[0];
    };

    const ap = Number(plan.actualPrice);
    const dp = Number(plan.discountedPrice);
    const noSeparateDiscount =
      !Number.isFinite(dp) || !Number.isFinite(ap) || dp === ap;

    this.planForm.patchValue({
      title: plan.title || '',
      code: plan.code || '',
      durationInMonths: plan.durationInMonths || 1,
      actualPrice: Number.isFinite(ap) ? ap : 0,
      discountedPrice: noSeparateDiscount ? '' : dp,
      showOfferBadge: plan.showOfferBadge || false,
      offerText: plan.offerText || '',
      offerStartAt: formatDateForInput(plan.offerStartAt),
      offerEndAt: formatDateForInput(plan.offerEndAt),
      isActive: plan.isActive !== undefined ? plan.isActive : true,
      isStarterOffer: plan.isStarterOffer === true
    });

    this.updateOfferBadgeValidators(plan.showOfferBadge || false);
    this.validatePlanCodeConflict();
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

  priceValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const actualPrice = Number(control.get('actualPrice')?.value);
    const discRaw = control.get('discountedPrice')?.value;
    const hasExplicitDisc =
      discRaw !== '' && discRaw !== null && discRaw !== undefined && !Number.isNaN(Number(discRaw));
    if (!hasExplicitDisc || Number.isNaN(actualPrice)) {
      return null;
    }
    const discountedPrice = Number(discRaw);
    if (discountedPrice > actualPrice) {
      return { invalidPrice: true };
    }
    return null;
  }

  minArrayLength(min: number) {
    return (control: AbstractControl): { [key: string]: unknown } | null => {
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
    this.countdownInterval = setInterval(() => {
      if (this.planForm.get('showOfferBadge')?.value && this.planForm.get('offerEndAt')?.value) {
        this.cdr.detectChanges();
      }
    }, 60000);
  }

  async onSubmit() {
    if (this.planForm.valid) {
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

      const fv = this.planForm.getRawValue();
      const actual = Number(fv.actualPrice);
      const discRaw = fv.discountedPrice;
      const hasExplicitDisc =
        discRaw !== '' && discRaw !== null && discRaw !== undefined && !Number.isNaN(Number(discRaw));
      const discountedPrice = hasExplicitDisc ? Number(discRaw) : actual;

      const formData: Record<string, unknown> = {
        ...fv,
        code: fv.code ? String(fv.code).toUpperCase().trim() : undefined,
        description: this.descriptionArray.value.filter((point: string) => point.trim() !== ''),
        actualPrice: actual,
        discountedPrice,
        offerStartAt:
          showOffer && this.planForm.get('offerStartAt')?.value
            ? new Date(this.planForm.get('offerStartAt')?.value as string)
            : undefined,
        offerEndAt:
          showOffer && this.planForm.get('offerEndAt')?.value
            ? new Date(this.planForm.get('offerEndAt')?.value as string)
            : undefined,
        offerText: showOffer ? this.planForm.get('offerText')?.value : undefined
      };

      if (this.isEditMode && this.plan?._id) {
        formData['_id'] = this.plan._id;
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
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormArray) {
        control.controls.forEach((arrayControl) => {
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

  get hasPricingSavingsPreview(): boolean {
    const d = this.planForm.get('discountedPrice')?.value;
    const a = Number(this.planForm.get('actualPrice')?.value);
    if (d === '' || d === null || d === undefined) {
      return false;
    }
    const dn = Number(d);
    if (Number.isNaN(dn) || Number.isNaN(a)) {
      return false;
    }
    return dn < a;
  }

  get pricingSavingsAmount(): number {
    const a = Number(this.planForm.get('actualPrice')?.value);
    const d = Number(this.planForm.get('discountedPrice')?.value);
    return a - d;
  }
}
