import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SubscriptionsPageRoutingModule } from './subscriptions-routing.module';

import { SubscriptionsPage } from './subscriptions.page';
import { PlanFormModalComponent } from './plan-form.modal';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SubscriptionsPageRoutingModule
  ],
  declarations: [
    SubscriptionsPage,
    PlanFormModalComponent
  ]
})
export class SubscriptionsPageModule {}
