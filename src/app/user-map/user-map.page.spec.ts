import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserMapPage } from './user-map.page';

describe('UserMapPage', () => {
  let component: UserMapPage;
  let fixture: ComponentFixture<UserMapPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UserMapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


