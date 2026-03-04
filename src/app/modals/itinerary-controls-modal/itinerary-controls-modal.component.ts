import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ModalCommunicationService } from '../../services/modal-communication.service';
import { BudgetService } from '../../services/budget.service';

@Component({
  selector: 'app-itinerary-controls-modal',
  templateUrl: './itinerary-controls-modal.component.html',
  styleUrls: ['./itinerary-controls-modal.component.scss'],
  standalone: false
})
export class ItineraryControlsModalComponent implements OnInit {
  @Input() availableItineraries: any[] = [];
  @Input() selectedItineraryIndex: number = -1;
  @Input() selectedItinerary: any = null;
  @Input() currentRouteInfo: any = null;
  @Input() currentSegmentIndex: number = 0;
  @Input() isLocationTrackingActive: boolean = false;
  @Input() isRealLocation: boolean = false;
  @Input() locationStatusText: string = '';
  @Input() isLoadingJeepneyRoutes: boolean = false;
  @Input() isGeneratingRoute: boolean = false;

  @Output() itinerarySelected = new EventEmitter<number>();

  showScrollIndicator: boolean = false;
  estimatedExpenses = {
    transportation: 0,
    food: 0,
    accommodation: 0
  };
  expenseInputs: {
    transportation: number | null;
    food: number | null;
    accommodation: number | null;
  } = {
    transportation: null,
    food: null,
    accommodation: null
  };

  constructor(
    private modalCtrl: ModalController,
    private modalCommunication: ModalCommunicationService,
    private budgetService: BudgetService
  ) {}

  ngOnInit(): void {
    this.estimatedExpenses = this.computeEstimatedExpenses();
  }

  onItineraryChange(event: any): void {
    const index = parseInt(event.detail.value, 10);
    this.modalCommunication.selectItinerary(index);
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
    this.modalCtrl.dismiss({
      action: 'stopItinerary',
      expensePlan: this.getFinalExpensePlan()
    });
  }

  onCancelRouteGeneration(): void {
    this.modalCtrl.dismiss({ action: 'cancelRouteGeneration' });
  }

  onCloseModal(): void {
    this.modalCtrl.dismiss();
  }

  formatItineraryTitle(itinerary: any): string {
    if (!itinerary) return 'Unknown Itinerary';

    const dayCount = itinerary.days?.length || 0;
    const spotCount = itinerary.days?.[0]?.spots?.length || 0;

    if (itinerary.name && itinerary.name !== 'Itinerary for Unknown Date') {
      return `${itinerary.name} (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
    }

    return `Itinerary for Unknown Date (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
  }

  getSegmentTitle(segment: any): string {
    if (segment.type === 'jeepney' || segment.type === 'bus') {
      return `${segment.jeepneyCode || 'Transit'} (${segment.fromName || segment.from} -> ${segment.toName || segment.to})`;
    }
    if (segment.type === 'walk') {
      return `Walk (${segment.fromName || segment.from} -> ${segment.toName || segment.to})`;
    }
    return `${segment.fromName || segment.from} -> ${segment.toName || segment.to}`;
  }

  formatDuration(seconds: number): string {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  getEstimatedFare(): string {
    if (!this.currentRouteInfo?.segments) {
      return 'PHP 0';
    }

    const jeepneyCount = this.currentRouteInfo.segments.filter(
      (segment: any) => (segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode
    ).length;

    if (jeepneyCount === 0) {
      return 'PHP 0';
    }

    const minFare = jeepneyCount * 12;
    const maxFare = jeepneyCount * 15;

    return minFare === maxFare ? `PHP ${minFare}` : `PHP ${minFare}-${maxFare}`;
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
    return `Stage ${currentStage} of ${totalSegments} - ${percentage}% ready`;
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

  getInputOrEstimate(category: 'transportation' | 'food' | 'accommodation'): number {
    const input = this.expenseInputs[category];
    if (input === null || input === undefined || isNaN(Number(input))) {
      return this.estimatedExpenses[category];
    }
    return Math.max(0, Number(input));
  }

  private getFinalExpensePlan() {
    return {
      transportation: this.getInputOrEstimate('transportation'),
      food: this.getInputOrEstimate('food'),
      accommodation: this.getInputOrEstimate('accommodation'),
      estimates: { ...this.estimatedExpenses }
    };
  }

  private computeEstimatedExpenses(): { transportation: number; food: number; accommodation: number } {
    return {
      transportation: this.computeTransportationEstimate(),
      food: this.computeFoodEstimate(),
      accommodation: this.computeAccommodationEstimate()
    };
  }

  private computeTransportationEstimate(): number {
    if (!this.currentRouteInfo?.segments) {
      return 0;
    }
    const fareData = this.budgetService.getEstimatedJeepneyFare(this.currentRouteInfo.segments);
    return Math.max(0, Math.round(fareData.average || 0));
  }

  private computeFoodEstimate(): number {
    const itinerary = this.getSelectedItinerary();
    if (!itinerary?.days || itinerary.days.length === 0) {
      return 0;
    }

    const hasMealStops = itinerary.days.some((day: any) =>
      (day?.spots || []).some((spot: any) => !!spot?.mealType)
    );
    if (!hasMealStops) {
      return 0;
    }

    const limits = this.budgetService.getCurrentBudgetLimits();
    return Math.max(0, Math.round((limits?.dailyFood || 0) * itinerary.days.length));
  }

  private computeAccommodationEstimate(): number {
    const itinerary = this.getSelectedItinerary();
    if (!itinerary?.days || itinerary.days.length === 0) {
      return 0;
    }

    const nights = itinerary.days.filter((day: any) =>
      (day?.spots || []).some((spot: any) => spot?.eventType === 'hotel' || !!spot?.hotel)
    ).length;
    if (nights === 0) {
      return 0;
    }

    const limits = this.budgetService.getCurrentBudgetLimits();
    return Math.max(0, Math.round((limits?.dailyAccommodation || 0) * nights));
  }

  private getSelectedItinerary(): any {
    if (this.selectedItinerary) {
      return this.selectedItinerary;
    }
    if (this.selectedItineraryIndex < 0 || this.selectedItineraryIndex >= this.availableItineraries.length) {
      return null;
    }
    return this.availableItineraries[this.selectedItineraryIndex];
  }
}
