import { TestBed } from '@angular/core/testing';

import { Logic } from './logic';

describe('Logic', () => {
  let service: Logic;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Logic);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
