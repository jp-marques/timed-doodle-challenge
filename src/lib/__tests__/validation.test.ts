/**
 * Unit tests for nickname/round validation used by the Menu page.
 */
import { describe, it, expect } from 'vitest';
import { validateNickname, validateRoundDuration } from '../validation';

describe('validateNickname', () => {
  // Empty and 1-char names should return error messages
  it('rejects empty and short names', () => {
    expect(validateNickname('')).toMatch(/please enter/i);
    expect(validateNickname('a')).toMatch(/at least 2/i);
  });

  // Names longer than 15 chars should error with length message
  it('rejects too long names (> 15)', () => {
    expect(validateNickname('abcdefghijklmnop')).toMatch(/15 characters or less/i);
  });

  // Non-allowed characters (e.g., '!') should be rejected by regex
  it('rejects invalid characters', () => {
    expect(validateNickname('bad!')).toMatch(/only contain/i);
  });

  // Multiple consecutive spaces should trigger the excessive spaces error
  it('rejects excessive spaces', () => {
    expect(validateNickname('a   b')).toMatch(/excessive spaces/i);
  });

  // Allowed characters and spacing should pass with null (no error)
  it('accepts valid names', () => {
    expect(validateNickname('Jane_Doe')).toBeNull();
    expect(validateNickname('Alex Smith')).toBeNull();
  });
});

describe('validateRoundDuration', () => {
  // Non-integer seconds should produce an error
  it('enforces integer seconds', () => {
    expect(validateRoundDuration(60.5)).toMatch(/whole number/i);
  });
  // Below min and above max should error; valid middle value returns null
  it('enforces min and max bounds', () => {
    expect(validateRoundDuration(14)).toMatch(/at least 15/i);
    expect(validateRoundDuration(301)).toMatch(/cannot exceed/i);
    expect(validateRoundDuration(60)).toBeNull();
  });
});
