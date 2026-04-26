import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  standalone: false,
  selector: 'app-itinerary-completion-modal',
  templateUrl: './itinerary-completion-modal.component.html',
  styleUrls: ['./itinerary-completion-modal.component.scss'],
})
export class ItineraryCompletionModalComponent implements OnInit {
  @Input() itineraryTitle = 'Your trip';
  @Input() routeInfo: any = null;

  segmentSummaries: { icon: string; title: string; detail?: string }[] = [];

  /** Larger scroll area when user expands the itinerary detail box. */
  itineraryDetailExpanded = false;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit(): void {
    this.segmentSummaries = this.buildSegmentSummaries();
  }

  /** Ends navigation and persists the trip (same as previous "End itinerary"). */
  done(): void {
    void this.modalCtrl.dismiss({ endTrip: true });
  }

  toggleItineraryDetailExpanded(): void {
    this.itineraryDetailExpanded = !this.itineraryDetailExpanded;
  }

  get showDetailExpandToggle(): boolean {
    return this.segmentSummaries.length > 3;
  }

  getFormattedTotalDuration(): string {
    const totalDuration = this.routeInfo?.totalDuration;
    if (totalDuration === null || totalDuration === undefined) {
      return 'N/A';
    }
    if (typeof totalDuration === 'string') {
      const parsed = parseFloat(totalDuration);
      if (isNaN(parsed)) {
        return totalDuration;
      }
      return this.formatDurationSeconds(parsed);
    }
    return this.formatDurationSeconds(totalDuration);
  }

  getFormattedDistance(): string {
    const totalDistance = this.routeInfo?.totalDistance;
    if (totalDistance === null || totalDistance === undefined) {
      return '0 km';
    }
    const distance = typeof totalDistance === 'number' ? totalDistance : parseFloat(totalDistance);
    if (isNaN(distance)) {
      return String(totalDistance);
    }
    if (distance >= 1) {
      return `${distance.toFixed(1)} km`;
    }
    return `${Math.round(distance * 1000)} m`;
  }

  getEstimatedFare(): string {
    if (!this.routeInfo?.segments) {
      return 'PHP 0';
    }
    const jeepneyCount = this.routeInfo.segments.filter(
      (segment: any) => (segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode
    ).length;
    if (jeepneyCount === 0) {
      return 'PHP 0';
    }
    const minFare = jeepneyCount * 12;
    const maxFare = jeepneyCount * 15;
    return minFare === maxFare ? `PHP ${minFare}` : `PHP ${minFare}–${maxFare}`;
  }

  private formatDurationSeconds(seconds: number): string {
    if (!seconds) {
      return 'N/A';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private buildSegmentSummaries(): { icon: string; title: string; detail?: string }[] {
    const segments = this.routeInfo?.segments;
    if (!Array.isArray(segments) || segments.length === 0) {
      return [];
    }
    return segments.map((segment: any) => {
      const isJeep = segment.type === 'jeepney' || segment.type === 'bus';
      const icon = isJeep ? 'bus-outline' : 'walk-outline';
      const title = this.getSegmentTitle(segment);
      const detailParts: string[] = [];
      if (isJeep && segment.jeepneyCode) {
        detailParts.push(`Code ${segment.jeepneyCode}`);
      }
      if (segment.duration != null) {
        detailParts.push(this.formatDurationSeconds(Number(segment.duration)));
      }
      return { icon, title, detail: detailParts.length ? detailParts.join(' · ') : undefined };
    });
  }

  private getSegmentTitle(segment: any): string {
    if (segment.type === 'jeepney' || segment.type === 'bus') {
      return `${segment.jeepneyCode || 'Transit'} (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    }
    if (segment.type === 'walk') {
      return `Walk (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    }
    return `${segment.fromName || segment.from} → ${segment.toName || segment.to}`;
  }
}
