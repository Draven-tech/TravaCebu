import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouteEditorMapPage } from './route-editor-map.page';

describe('RouteEditorMapPage', () => {
  let component: RouteEditorMapPage;
  let fixture: ComponentFixture<RouteEditorMapPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteEditorMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
