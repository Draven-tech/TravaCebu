import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BucketListPage } from './bucket-list.page';

describe('BucketListPage', () => {
  let component: BucketListPage;
  let fixture: ComponentFixture<BucketListPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BucketListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
