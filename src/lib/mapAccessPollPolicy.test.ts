import { describe, expect, it } from 'vitest';
import { ANONYMOUS_ACCESS_REVALIDATE_MS, shouldPollMapAccess } from './mapAccessPollPolicy';
describe('published map access revalidation', () => {
  it('retains prompt revocation checks for an active guest or member grant',()=>{
    expect(shouldPollMapAccess(true,false,10_000,9_000)).toBe(true);
    expect(shouldPollMapAccess(true,true,10_000,9_000)).toBe(true);
  });
  it('avoids redundant polling in anonymous public or hidden sessions',()=>{
    expect(shouldPollMapAccess(false,false,12_000,10_000)).toBe(false);
    expect(shouldPollMapAccess(false,true,120_000,10_000)).toBe(false);
    expect(shouldPollMapAccess(false,false,10_000+ANONYMOUS_ACCESS_REVALIDATE_MS,10_000)).toBe(true);
  });
});
