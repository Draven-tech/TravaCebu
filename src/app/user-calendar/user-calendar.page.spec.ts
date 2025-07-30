import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserCalendarPage } from './user-calendar.page';

describe('UserCalendarPage', () => {
  let component: UserCalendarPage;
  let fixture: ComponentFixture<UserCalendarPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UserCalendarPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
