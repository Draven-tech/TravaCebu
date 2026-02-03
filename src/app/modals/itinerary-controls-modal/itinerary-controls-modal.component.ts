import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ModalCommunicationService } from '../../services/modal-communication.service';

@Component({
  selector: 'app-itinerary-controls-modal',
  templateUrl: './itinerary-controls-modal.component.html',
  styleUrls: ['./itinerary-controls-modal.component.scss'],
  standalone: false
})
export class ItineraryControlsModalComponent implements OnInit {
  @Input() availableItineraries: any[] = [];
  @Input() selectedItineraryIndex: number = -1;
  @Input() currentRouteInfo: any = null;
  @Input() currentSegmentIndex: number = 0;
  @Input() isLocationTrackingActive: boolean = false;
  @Input() isRealLocation: boolean = false;
  @Input() locationStatusText: string = '';
  @Input() isLoadingJeepneyRoutes: boolean = false;
  @Input() isGeneratingRoute: boolean = false;

  @Output() itinerarySelected = new EventEmitter<number>();
  
  showScrollIndicator: boolean = false;

  constructor(
    private modalCtrl: ModalController,
    private modalCommunication: ModalCommunicationService
  ) {}

  ngOnInit(): void {
    console.log('Modal initialized with:', {
      availableItineraries: this.availableItineraries,
      availableItinerariesLength: this.availableItineraries?.length,
      selectedItineraryIndex: this.selectedItineraryIndex
    });
  }

  onItineraryChange(event: any): void {
    console.log('onItineraryChange triggered!', event);
    console.log('Event detail:', event.detail);
    console.log('Event detail value:', event.detail.value);
    
    const index = parseInt(event.detail.value);
    console.log('Parsed index:', index);
    console.log('Available itineraries:', this.availableItineraries.length);
    console.log('Calling modalCommunication.selectItinerary...');
    
    // Use service to communicate with parent component
    this.modalCommunication.selectItinerary(index);
    
    console.log('Modal communication service called');

    // Close the modal after selection
    this.modalCtrl.dismiss();
  }

  onShowUserLocation(): void {
    this.modalCtrl.dismiss({ action: 'showUserLocation' });
  }

  onToggleLocationTracking(): void {
    this.modalCtrl.dismiss({ action: 'toggleLocationTracking' });
  }

  onNextSegment(): void {
    this.modalCtrl.dismiss({ action: 'nextSegment' });
  }

  onShowSegmentSelector(): void {
    this.modalCtrl.dismiss({ action: 'showSegmentSelector' });
  }

  onStopItinerary(): void {
    console.log('Stop itinerary requested');
    this.modalCtrl.dismiss({ action: 'stopItinerary' });
  }

  onCancelRouteGeneration(): void {
    console.log('Cancel route generation requested');
    this.modalCtrl.dismiss({ action: 'cancelRouteGeneration' });
  }

  onCloseModal(): void {
    this.modalCtrl.dismiss();
  }

  formatItineraryTitle(itinerary: any): string {
    if (!itinerary) return 'Unknown Itinerary';
    
    const dayCount = itinerary.days?.length || 0;
    const spotCount = itinerary.days?.[0]?.spots?.length || 0;
    
    if (itinerary.name && itinerary.name !== `Itinerary for Unknown Date`) {
      return `${itinerary.name} (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
    }
    
    return `Itinerary for Unknown Date (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
  }

  getSegmentTitle(segment: any): string {
    if (segment.type === 'jeepney' || segment.type === 'bus') {
      return `${segment.jeepneyCode || 'Transit'} (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    } else if (segment.type === 'walk') {
      return `Walk (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    } else {
      return `${segment.fromName || segment.from} → ${segment.toName || segment.to}`;
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  getEstimatedFare(): string {
    if (!this.currentRouteInfo?.segments) {
      return '₱0';
    }

    const jeepneyCount = this.currentRouteInfo.segments.filter(
      (segment: any) => (segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode
    ).length;

    if (jeepneyCount === 0) {
      return '₱0';
    }

    const minFare = jeepneyCount * 12;
    const maxFare = jeepneyCount * 15;

    return minFare === maxFare ? `₱${minFare}` : `₱${minFare}-${maxFare}`;
  }

  getFormattedTotalDuration(): string {
    const totalDuration = this.currentRouteInfo?.totalDuration;
    if (totalDuration === null || totalDuration === undefined) {
      return 'N/A';
    }

    if (typeof totalDuration === 'string') {
      const parsed = parseFloat(totalDuration);
      if (isNaN(parsed)) {
        return totalDuration;
      }
      return this.formatDuration(parsed);
    }

    return this.formatDuration(totalDuration);
  }

  getFormattedDistance(): string {
    const totalDistance = this.currentRouteInfo?.totalDistance;
    if (totalDistance === null || totalDistance === undefined) {
      return '0 km';
    }

    const distance = typeof totalDistance === 'number' ? totalDistance : parseFloat(totalDistance);

    if (isNaN(distance)) {
      return `${totalDistance}`;
    }

    if (distance >= 1) {
      return `${distance.toFixed(1)} km`;
    }

    return `${Math.round(distance * 1000)} m`;
  }

  getRouteCompletionRatio(): number {
    const totalSegments = this.currentRouteInfo?.segments?.length;
    if (!totalSegments || totalSegments === 0) {
      return 0;
    }

    const currentStage = Math.min(this.currentSegmentIndex + 1, totalSegments);
    return Math.min(1, Math.max(0, currentStage / totalSegments));
  }

  getRouteCompletionLabel(): string {
    const totalSegments = this.currentRouteInfo?.segments?.length;
    if (!totalSegments || totalSegments === 0) {
      return 'Route not started';
    }

    const currentStage = Math.min(this.currentSegmentIndex + 1, totalSegments);
    const percentage = Math.round(this.getRouteCompletionRatio() * 100);
    return `Stage ${currentStage} of ${totalSegments} • ${percentage}% ready`;
  }

  getSegmentCount(segmentType: 'jeepney' | 'bus' | 'walk'): number {
    if (!this.currentRouteInfo?.segments) {
      return 0;
    }

    return this.currentRouteInfo.segments.filter((segment: any) => segment.type === segmentType).length;
  }

  getRideSegmentCount(): number {
    return this.getSegmentCount('jeepney') + this.getSegmentCount('bus');
  }
}
