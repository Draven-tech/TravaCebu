import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { PlaceAssignmentPickerComponent } from './place-assignment-picker.component';

describe('PlaceAssignmentPickerComponent', () => {
  let component: PlaceAssignmentPickerComponent;
  let fixture: ComponentFixture<PlaceAssignmentPickerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaceAssignmentPickerComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(PlaceAssignmentPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
