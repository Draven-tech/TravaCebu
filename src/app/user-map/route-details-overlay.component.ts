import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-route-details-overlay',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  template: `
    <div class="overlay-backdrop" (click)="close()">
      <div class="overlay-content" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="overlay-header">
          <ion-toolbar color="warning">
            <ion-title>Public Transport</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="close()" style="--color: white; font-weight: bold;">
                <ion-icon name="close"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </div>

        <!-- Content -->
        <div class="overlay-body">
          <!-- Route Summary Header -->
          <div class="route-summary">
            <div class="route-header">
              <ion-icon name="map" color="warning"></ion-icon>
              <div class="route-info">
                <h2>{{ routeInfo?.title || 'Your Route' }}</h2>
                <p class="route-stats">
                  <ion-icon name="time"></ion-icon> {{ routeInfo?.totalDuration }}
                  <ion-icon name="location"></ion-icon> {{ routeInfo?.totalDistance }}
                  <ion-icon name="card"></ion-icon> {{ getEstimatedFare() }}
                </p>
              </div>
            </div>
            
            <!-- Route Alternatives (API only) -->
            <div *ngIf="getRouteAlternatives().length > 0" class="route-alternatives">
              <h3>Alternative Routes</h3>
              <div class="alternative-routes">
                <div *ngFor="let alt of getRouteAlternatives(); let i = index" 
                     class="alternative-route" 
                     [class.selected]="selectedAlternativeIndex === i"
                     (click)="selectAlternative(i)">
                  <div class="alt-route-info">
                    <span class="alt-route-number">Route {{ i + 2 }}</span>
                    <span class="alt-route-duration">{{ alt.totalDuration }}</span>
                    <span class="alt-route-distance">{{ alt.totalDistance }}</span>
                  </div>
                  <div class="alt-route-summary">{{ alt.summary }}</div>
                </div>
              </div>
            </div>
          </div>


          <!-- Detailed Route Segments -->
          <div class="route-segments">
            <!-- No segments found message -->
            <div *ngIf="getCurrentRouteSegments().length === 0" class="no-segments">
              <ion-card>
                <ion-card-content>
                  <ion-icon name="information-circle" color="warning"></ion-icon>
                  <p>No route segments found.</p>
                </ion-card-content>
              </ion-card>
            </div>
            
            <ion-list *ngIf="getCurrentRouteSegments().length > 0">
              <ion-item *ngFor="let segment of getCurrentRouteSegments(); let i = index" class="route-segment" [class.highlighted]="i === 0">
               <div class="segment-content">
                 <!-- Segment Header with Route Type Icons -->
                 <div class="segment-route-path">
                   <div class="route-step" *ngFor="let step of getRouteSteps(segment); let stepIndex = index">
                     <div class="step-icon">
                       <ion-icon [name]="getStepIcon(step.type)" [color]="getStepColor(step.type)"></ion-icon>
                       <span class="step-duration">{{ step.duration }}</span>
                     </div>
                     <div class="step-details" *ngIf="step.type === 'jeepney' || step.type === 'bus'">
                       <ion-chip color="warning" size="small">
                         <ion-label>{{ step.code }}</ion-label>
                       </ion-chip>
                     </div>
                     <ion-icon *ngIf="stepIndex < getRouteSteps(segment).length - 1" name="arrow-forward" class="arrow"></ion-icon>
                   </div>
                 </div>

                 <!-- Segment Info -->
                 <div class="segment-info">
                   <div class="segment-header">
                     <h3>{{ segment.fromName || segment.from }} → {{ segment.toName || segment.to }}</h3>
                     <div class="segment-time-range">
                       <ion-icon name="time"></ion-icon>
                       {{ segment.estimatedTime || segment.duration }}
                     </div>
                   </div>
                   
                   <div class="segment-details">
                     <p class="segment-description">{{ segment.description || segment.instructions }}</p>
                     
                     <!-- Transit Details -->
                     <div *ngIf="segment.transitDetails" class="transit-details">
                       <ion-chip color="primary">
                         <ion-icon name="bus"></ion-icon>
                         <ion-label>{{ segment.transitDetails }}</ion-label>
                       </ion-chip>
                       <div *ngIf="segment.fare" class="fare-info">
                         <ion-chip color="success" size="small">
                           <ion-icon name="card"></ion-icon>
                           <ion-label>{{ segment.fare }}</ion-label>
                         </ion-chip>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             </ion-item>
           </ion-list>
         </div>

         <!-- Route Actions -->
         <div class="route-actions">
           <ion-button expand="block" color="success" (click)="startNavigation()">
             <ion-icon name="navigate"></ion-icon>
             Start Navigation
           </ion-button>
           
           <ion-button expand="block" color="primary" (click)="shareRoute()">
             <ion-icon name="share"></ion-icon>
             Share Route
           </ion-button>
         </div>
       </div>
     </div>
   </div>
 `,
  styles: [`
    .overlay-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
      display: flex;
      align-items: flex-end;
      animation: fadeIn 0.3s ease;
    }

    .overlay-content {
      background: white;
      border-radius: 20px 20px 0 0;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
    }

    .overlay-header {
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .overlay-body {
      padding: 0;
    }

    .route-summary {
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      padding: 20px;
      border-radius: 0 0 20px 20px;
    }

    .route-header {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .route-header ion-icon {
      font-size: 2rem;
    }

    .route-info h2 {
      margin: 0 0 5px 0;
      font-size: 1.3rem;
      font-weight: 700;
    }

    .route-stats {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 15px;
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .route-stats ion-icon {
      margin-right: 5px;
    }

    .route-alternatives {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.3);
    }

    .route-alternatives h3 {
      margin: 0 0 10px 0;
      font-size: 1rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    .alternative-routes {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .alternative-route {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 2px solid transparent;
    }

    .alternative-route:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .alternative-route.selected {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .alt-route-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }

    .alt-route-number {
      font-weight: 600;
      font-size: 0.9rem;
    }

    .alt-route-duration,
    .alt-route-distance {
      font-size: 0.8rem;
      opacity: 0.9;
    }

    .alt-route-summary {
      font-size: 0.8rem;
      opacity: 0.8;
      font-style: italic;
    }


    .route-segments {
      padding: 10px 20px;
    }

    .route-segment {
      --padding-start: 0;
      --padding-end: 0;
      --inner-padding-end: 0;
      margin-bottom: 15px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      border: 2px solid transparent;
      transition: all 0.3s ease;
    }

    .route-segment.highlighted {
      border-color: #ff6b35;
      background: #fff8f0;
    }

    .segment-content {
      width: 100%;
      padding: 15px;
    }

    .segment-route-path {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }

    .route-step {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .step-icon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .step-icon ion-icon {
      font-size: 1.2rem;
    }

    .step-duration {
      font-size: 0.7rem;
      font-weight: 600;
      color: #666;
    }

    .step-details ion-chip {
      margin: 0;
      font-size: 0.8rem;
      height: 20px;
    }

    .arrow {
      color: #666;
      font-size: 0.9rem;
    }

    .segment-info {
      flex: 1;
    }

    .segment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .segment-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #2D3748;
    }

    .segment-time-range {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.85rem;
      color: #666;
      font-weight: 500;
    }

    .segment-details {
      margin-top: 10px;
    }

    .segment-description {
      margin: 0 0 10px 0;
      font-size: 0.9rem;
      color: #666;
      line-height: 1.4;
    }

    .transit-details {
      margin-top: 8px;
    }

    .route-actions {
      padding: 20px;
      background: #f8f9fa;
      border-top: 1px solid #dee2e6;
    }

    .route-actions ion-button {
      margin-bottom: 10px;
    }

    ion-chip {
      margin-right: 8px;
      margin-bottom: 5px;
    }

    .no-segments {
      padding: 20px;
    }

    .no-segments ion-card {
      text-align: center;
      background: #fff8f0;
      border: 1px solid #ff6b35;
    }

    .no-segments ion-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .no-segments ion-icon {
      font-size: 2rem;
      color: #ff6b35;
    }

    .no-segments p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `]
})
export class RouteDetailsOverlayComponent implements OnInit, OnDestroy {
  @Input() routeInfo: any;
  selectedAlternativeIndex: number = -1; // -1 means main route, 0+ means alternative

  constructor() {}

  ngOnInit() {
    // Prevent body scroll when overlay is open
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy() {
    // Restore body scroll when overlay is closed
    document.body.style.overflow = '';
  }

  getRouteSteps(segment: any): any[] {
    const steps = [];
    
    // Handle API routes (Google Directions)
    if (segment.mode === 'walking' || segment.mode === 'WALKING' || 
        (segment.polylines && segment.polylines.some((polyline: any) => polyline.mode === 'WALKING'))) {
      steps.push({
        type: 'walk',
        duration: segment.duration || 'Unknown',
        icon: 'walk'
      });
    } else if (segment.mode === 'transit' || segment.mode === 'TRANSIT' ||
               (segment.polylines && segment.polylines.some((polyline: any) => polyline.mode === 'TRANSIT'))) {
      const transitType = segment.transitType || 'bus';
      steps.push({
        type: transitType,
        duration: segment.duration || 'Unknown',
        code: segment.transitDetails || 'Transit',
        icon: transitType === 'jeepney' ? 'car' : 'bus'
      });
    }
    
    return steps.length > 0 ? steps : [{
      type: 'walk',
      duration: '30 min',
      icon: 'walk'
    }];
  }

  getStepIcon(type: string): string {
    switch (type) {
      case 'walk': return 'walk';
      case 'jeepney': return 'car';
      case 'bus': return 'bus';
      default: return 'walk';
    }
  }

  getStepColor(type: string): string {
    switch (type) {
      case 'walk': return 'success';
      case 'jeepney': return 'warning';
      case 'bus': return 'primary';
      default: return 'success';
    }
  }

  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  getEstimatedFare(): string {
    if (!this.routeInfo?.segments) {
      return '₱0';
    }

    let totalFare = 0;
    let jeepneyCount = 0;

    // Count jeepney and bus segments and calculate fare
    this.routeInfo.segments.forEach((segment: any) => {
      if ((segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode) {
        jeepneyCount++;
      }
    });

    // Standard jeepney fare in Cebu is ₱12-15 per ride
    // Using ₱13 as average fare
    const jeepneyFare = 13;
    totalFare = jeepneyCount * jeepneyFare;

    return `₱${totalFare}`;
  }

  getRouteAlternatives(): any[] {
    if (this.routeInfo?.alternatives) {
      return this.routeInfo.alternatives;
    }
    return [];
  }

  getCurrentRouteSegments(): any[] {
    if (this.selectedAlternativeIndex >= 0 && this.routeInfo?.alternatives) {
      // Return segments from selected alternative route
      return this.routeInfo.alternatives[this.selectedAlternativeIndex].segments;
    }
    // Return segments from main route
    return this.routeInfo?.segments || [];
  }

  selectAlternative(index: number): void {
    this.selectedAlternativeIndex = index;
  }

  startNavigation() {
    // Implement navigation logic
    this.close();
  }

  shareRoute() {
    // Implement share logic
    this.close();
  }

  close() {
    // Remove the overlay from DOM
    const overlay = document.querySelector('app-route-details-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
} 