import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EmergencyInfoPageRoutingModule } from './emergency-info-routing.module';
import { EmergencyInfoPage } from './emergency-info.page';
import { ComponentsModule } from '../components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EmergencyInfoPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [EmergencyInfoPage],
})
export class EmergencyInfoPageModule {}
