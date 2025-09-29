import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouteDetailPage } from './route-detail.page';

describe('RouteDetailPage', () => {
  let component: RouteDetailPage;
  let fixture: ComponentFixture<RouteDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


