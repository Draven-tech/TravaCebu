import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItineraryPlannerPage } from './itinerary-planner.page';

describe('ItineraryPlannerPage', () => {
  let component: ItineraryPlannerPage;
  let fixture: ComponentFixture<ItineraryPlannerPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ItineraryPlannerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
