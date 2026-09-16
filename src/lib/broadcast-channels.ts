export interface ContactChannelStats {
  totalContacts: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
}

interface ContactChannelRow {
  email?: string | null;
  phone?: string | null;
}

export function getContactChannelStats(
  contacts: ContactChannelRow[],
): ContactChannelStats {
  return contacts.reduce(
    (acc, contact) => {
      const email = typeof contact.email === 'string' ? contact.email.trim() : '';
      const phone = typeof contact.phone === 'string' ? contact.phone.trim() : '';

      if (email) {
        acc.contactsWithEmail += 1;
      }

      if (phone) {
        acc.contactsWithPhone += 1;
      }

      return acc;
    },
    {
      totalContacts: contacts.length,
      contactsWithEmail: 0,
      contactsWithPhone: 0,
    } satisfies ContactChannelStats,
  );
}
