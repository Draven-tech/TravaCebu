import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import { UserCalendarPageRoutingModule } from './user-calendar-routing.module';

import { UserCalendarPage } from './user-calendar.page';
import { ComponentsModule } from '../components/components.module';
import { EventDetailModalComponent } from '../modals/event-detail-modal/event-detail-modal.component';
import { MyItinerariesPageModule } from '../my-itineraries/my-itineraries.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FullCalendarModule,
    UserCalendarPageRoutingModule,
    ComponentsModule,
    MyItinerariesPageModule
  ],
  declarations: [UserCalendarPage]
})
export class UserCalendarPageModule {}
