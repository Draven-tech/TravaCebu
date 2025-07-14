import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TouristSpotListPage } from './tourist-spot-list.page';

describe('TouristSpotListPage', () => {
  let component: TouristSpotListPage;
  let fixture: ComponentFixture<TouristSpotListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TouristSpotListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
