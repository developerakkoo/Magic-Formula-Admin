import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NotificationsPageRoutingModule } from './notifications-routing.module';

import { NotificationsPage } from './notifications.page';
import { NotificationFormModalComponent } from './notification-form.modal';
import { NotificationDetailsModalComponent } from './notification-details.modal';
import { UserSelectionPage } from './user-selection.page';
import { DatePickerModalComponent } from './date-picker.modal';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    NotificationsPageRoutingModule
  ],
  declarations: [
    NotificationsPage,
    NotificationFormModalComponent,
    NotificationDetailsModalComponent,
    UserSelectionPage,
    DatePickerModalComponent
  ]
})
export class NotificationsPageModule {}
