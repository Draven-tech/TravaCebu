import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventListPage } from './event-list.page';

describe('EventListPage', () => {
  let component: EventListPage;
  let fixture: ComponentFixture<EventListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EventListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
