import { describe, expect, it } from 'vitest';
import { getContactChannelStats } from './broadcast-channels';

describe('getContactChannelStats', () => {
  it('counts contacts that have email or phone data and ignores blanks', () => {
    const result = getContactChannelStats([
      { email: 'ana@example.com', phone: '+123456789' },
      { email: '', phone: '+987654321' },
      { email: 'beto@example.com', phone: '' },
      { email: null, phone: null },
      { email: 'carmen@example.com', phone: '+555000111' },
    ]);

    expect(result).toEqual({
      totalContacts: 5,
      contactsWithEmail: 3,
      contactsWithPhone: 3,
    });
  });
});
