import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UsersPageRoutingModule } from './users-routing.module';

import { UsersPage } from './users.page';
import { UserFormModalComponent } from './user-form.modal';
import { BulkUploadModalComponent } from './bulk-upload.modal';
import { UserDetailsModalComponent } from './user-details.modal';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    UsersPageRoutingModule
  ],
  declarations: [
    UsersPage,
    UserFormModalComponent,
    BulkUploadModalComponent,
    UserDetailsModalComponent
  ]
})
export class UsersPageModule {}
