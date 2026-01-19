import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-date-picker-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Date</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-datetime
        [(ngModel)]="selectedDate"
        [ngModelOptions]="{standalone: true}"
        display-format="MMM DD, YYYY"
        presentation="date">
      </ion-datetime>
      <div class="ion-padding">
        <ion-button expand="block" (click)="confirm()">Confirm</ion-button>
      </div>
    </ion-content>
  `,
  standalone: false
})
export class DatePickerModalComponent implements OnInit {
  @Input() value?: string;
  @Input() type?: 'start' | 'end';
  
  selectedDate?: string;

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    this.selectedDate = this.value;
  }

  cancel() {
    this.modalController.dismiss();
  }

  confirm() {
    this.modalController.dismiss({ value: this.selectedDate });
  }
}

