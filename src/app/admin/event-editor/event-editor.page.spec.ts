import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventEditorPage } from './event-editor.page';

describe('EventEditorPage', () => {
  let component: EventEditorPage;
  let fixture: ComponentFixture<EventEditorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EventEditorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
