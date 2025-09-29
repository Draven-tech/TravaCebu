import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouteListPage } from './route-list.page';

describe('RouteListPage', () => {
  let component: RouteListPage;
  let fixture: ComponentFixture<RouteListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


