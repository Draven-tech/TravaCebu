import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BucketListPageRoutingModule } from './bucket-list-routing.module';

import { BucketListPage } from './bucket-list.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BucketListPageRoutingModule
  ],
  declarations: [BucketListPage]
})
export class BucketListPageModule {}
