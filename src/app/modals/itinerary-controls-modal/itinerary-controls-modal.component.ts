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
    console.log('🔍 Modal initialized with:', {
      availableItineraries: this.availableItineraries,
      availableItinerariesLength: this.availableItineraries?.length,
      selectedItineraryIndex: this.selectedItineraryIndex
    });
  }

  onItineraryChange(event: any): void {
    console.log('🎯 onItineraryChange triggered!', event);
    console.log('🎯 Event detail:', event.detail);
    console.log('🎯 Event detail value:', event.detail.value);
    
    const index = parseInt(event.detail.value);
    console.log('🎯 Parsed index:', index);
    console.log('🎯 Available itineraries:', this.availableItineraries.length);
    console.log('🎯 Calling modalCommunication.selectItinerary...');
    
    // Use service to communicate with parent component
    this.modalCommunication.selectItinerary(index);
    
    console.log('✅ Modal communication service called');
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
    console.log('🛑 Stop itinerary requested');
    this.modalCtrl.dismiss({ action: 'stopItinerary' });
  }

  onCancelRouteGeneration(): void {
    console.log('❌ Cancel route generation requested');
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
}
