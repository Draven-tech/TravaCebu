import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { MapManagementService } from './map-management.service';
import { MapUtilitiesService } from './map-utilities.service';

/**
 * Leaflet rendering for a single itinerary route segment (jeepney / walk / visit stop).
 */
@Injectable({
  providedIn: 'root',
})
export class RouteSegmentMapRendererService {
  constructor(
    private mapManagement: MapManagementService,
    private mapUtils: MapUtilitiesService
  ) {}

  renderSegment(segment: any): void {
    if ((segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode) {
      this.drawJeepneySegment(segment);
    } else if (segment.type === 'walk') {
      this.drawWalkingSegment(segment);
    } else if (segment.type === 'visit_stop') {
      this.drawVisitStopSegment(segment);
    }
  }

  private drawJeepneySegment(segment: any): void {
    if (!segment.from || !segment.to) return;

    const fromLat = segment.from.lat || segment.from.location?.lat;
    const fromLng = segment.from.lng || segment.from.location?.lng;
    const toLat = segment.to.lat || segment.to.location?.lat;
    const toLng = segment.to.lng || segment.to.location?.lng;

    if (!fromLat || !fromLng || !toLat || !toLng) return;

    let polylinePoints: [number, number][] = [];

    if (segment.polyline) {
      try {
        if (typeof segment.polyline === 'string') {
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline);
        } else if (segment.polyline.points) {
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline.points);
        } else if (Array.isArray(segment.polyline)) {
          polylinePoints = segment.polyline.map((p: any) => [p.lat, p.lng]);
        }
      } catch {
        polylinePoints = [
          [fromLat, fromLng],
          [toLat, toLng],
        ];
      }
    } else {
      polylinePoints = [
        [fromLat, fromLng],
        [toLat, toLng],
      ];
    }

    const jeepneyLine = L.polyline(polylinePoints, {
      color: '#FF5722',
      weight: 6,
      opacity: 0.8,
      dashArray: '0',
    });

    this.mapManagement.addRouteLine(jeepneyLine);

    this.addStartStopTagsOnPolyline(polylinePoints, 'jeepney');

    const midIndex = Math.floor(polylinePoints.length / 2);
    const midPoint = polylinePoints[midIndex];

    const jeepneyMarker = L.marker([midPoint[0], midPoint[1]], {
      icon: L.divIcon({
        html: `<div style="
          background: #FF5722;
          color: white;
          border: 2px solid white;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          text-align: center;
        ">${segment.jeepneyCode || '🚌'}</div>`,
        iconSize: [50, 30],
        iconAnchor: [25, 15],
      }),
    });

    jeepneyMarker.bindPopup(`
      <div style="text-align: center;">
        <strong>Jeepney ${segment.jeepneyCode}</strong><br>
        <small>${segment.description || 'Jeepney Route'}</small><br>
        <small>Distance: ${this.mapUtils.formatDistance(segment.distance || 0)}</small><br>
        <small>Duration: ${this.mapUtils.formatDuration(segment.duration || 0)}</small>
      </div>
    `);

    this.mapManagement.addRouteMarker(jeepneyMarker);
  }

  private drawWalkingSegment(segment: any): void {
    if (!segment.from || !segment.to) return;

    const fromLat = segment.from.lat || segment.from.location?.lat;
    const fromLng = segment.from.lng || segment.from.location?.lng;
    const toLat = segment.to.lat || segment.to.location?.lat;
    const toLng = segment.to.lng || segment.to.location?.lng;

    if (!fromLat || !fromLng || !toLat || !toLng) return;

    let polylinePoints: [number, number][] = [];

    if (segment.polyline) {
      try {
        if (typeof segment.polyline === 'string') {
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline);
        } else if (segment.polyline.points) {
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline.points);
        } else if (Array.isArray(segment.polyline)) {
          polylinePoints = segment.polyline.map((p: any) => [p.lat, p.lng]);
        }
      } catch {
        polylinePoints = [
          [fromLat, fromLng],
          [toLat, toLng],
        ];
      }
    } else {
      polylinePoints = [
        [fromLat, fromLng],
        [toLat, toLng],
      ];
    }

    const walkLine = L.polyline(polylinePoints, {
      color: '#4CAF50',
      weight: 5,
      opacity: 0.8,
      dashArray: '15, 10',
    });

    this.mapManagement.addRouteLine(walkLine);

    this.addStartStopTagsOnPolyline(polylinePoints, 'walk');

    if (polylinePoints.length > 1) {
      const midIndex = Math.floor(polylinePoints.length / 2);
      const midPoint = polylinePoints[midIndex];

      const walkMarker = L.marker([midPoint[0], midPoint[1]], {
        icon: L.divIcon({
          html: `<div style="
            background: #4CAF50;
            color: white;
            border: 1px solid white;
            border-radius: 4px;
            padding: 2px 4px;
            font-size: 8px;
            font-weight: bold;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            text-align: center;
          ">🚶</div>`,
          iconSize: [35, 15],
          iconAnchor: [17, 7],
        }),
      });

      walkMarker.bindPopup(`
        <div style="text-align: center;">
          <strong>Walking</strong><br>
          <small>${segment.description || 'Walk to destination'}</small><br>
          <small>Distance: ${this.mapUtils.formatDistance(segment.distance || 0)}</small><br>
          <small>Duration: ${this.mapUtils.formatDuration(segment.duration || 0)}</small>
        </div>
      `);

      this.mapManagement.addRouteMarker(walkMarker);
    }
  }

  private drawVisitStopSegment(segment: any): void {
    const lat = segment?.to?.lat || segment?.from?.lat;
    const lng = segment?.to?.lng || segment?.from?.lng;
    if (!lat || !lng) return;

    const visitMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        html: `<div style="
          background: #FFC107;
          color: #111;
          border: 2px solid #fff;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          text-align: center;
          white-space: nowrap;
        ">STOP — Visit</div>`,
        iconSize: [110, 28],
        iconAnchor: [55, 14],
      }),
    });

    visitMarker.bindPopup(`
      <div style="text-align: center;">
        <strong>Visit Stop</strong><br>
        <small>${segment.description || 'Enjoy your visit here'}</small>
      </div>
    `);

    this.mapManagement.addRouteMarker(visitMarker);
  }

  private addStartStopTagsOnPolyline(polylinePoints: [number, number][], variant: 'walk' | 'jeepney'): void {
    if (!polylinePoints.length) {
      return;
    }
    const startHue = variant === 'walk' ? '#1B5E20' : '#0D47A1';
    const mk = (label: string, lat: number, lng: number, bg: string) =>
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background: ${bg};
            color: #fff;
            border: 2px solid #fff;
            border-radius: 6px;
            padding: 3px 8px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.04em;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            text-align: center;
            white-space: nowrap;
          ">${label}</div>`,
          iconSize: [56, 22],
          iconAnchor: [28, 11],
        }),
      });

    const a = polylinePoints[0];
    const b = polylinePoints[polylinePoints.length - 1];
    const startM = mk('START', a[0], a[1], startHue);
    startM.bindPopup('<strong>Start</strong><br>Begin this leg here.');
    this.mapManagement.addRouteMarker(startM);

    if (polylinePoints.length > 1 && (a[0] !== b[0] || a[1] !== b[1])) {
      const stopM = mk('STOP', b[0], b[1], '#B71C1C');
      stopM.bindPopup('<strong>Stop</strong><br>End of this leg.');
      this.mapManagement.addRouteMarker(stopM);
    }
  }
}
