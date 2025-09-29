import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MySubmissionsPageRoutingModule } from './my-submissions-routing.module';
import { MySubmissionsPage } from './my-submissions.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MySubmissionsPageRoutingModule
  ],
  declarations: [MySubmissionsPage]
})
export class MySubmissionsPageModule {}
