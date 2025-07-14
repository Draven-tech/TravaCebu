import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TouristSpotEditorPage } from './tourist-spot-editor.page';

describe('TouristSpotEditorPage', () => {
  let component: TouristSpotEditorPage;
  let fixture: ComponentFixture<TouristSpotEditorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TouristSpotEditorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
