import { TestBed } from '@angular/core/testing';

import { ItineraryPlannerService } from './itinerary-planner.service';

describe('ItineraryPlannerService', () => {
  let service: ItineraryPlannerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItineraryPlannerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
