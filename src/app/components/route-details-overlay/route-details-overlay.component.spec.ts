import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { RouteDetailsOverlayComponent } from './route-details-overlay.component';

describe('RouteDetailsOverlayComponent', () => {
  let component: RouteDetailsOverlayComponent;
  let fixture: ComponentFixture<RouteDetailsOverlayComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RouteDetailsOverlayComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(RouteDetailsOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
