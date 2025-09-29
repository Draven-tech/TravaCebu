import { TestBed } from '@angular/core/testing';

import { RouteAdminServiceService } from './route-admin-service.service';

describe('RouteAdminServiceService', () => {
  let service: RouteAdminServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RouteAdminServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});


