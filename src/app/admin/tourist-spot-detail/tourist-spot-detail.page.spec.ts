import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TouristSpotDetailPage } from './tourist-spot-detail.page';

describe('TouristSpotDetailPage', () => {
  let component: TouristSpotDetailPage;
  let fixture: ComponentFixture<TouristSpotDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TouristSpotDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


