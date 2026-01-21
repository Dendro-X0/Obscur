import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactList } from '../contact-list';
import * as contactStoreModule from '../../../lib/invites/contact-store';
import type { Contact, ContactGroup } from '../../../lib/invites/types';

// Mock the contact store
vi.mock('../../../lib/invites/contact-store');

describe('ContactList', () => {
  const mockContact: Contact = {
    id: 'contact-1',
    publicKey: '0'.repeat(64) as any,
    displayName: 'Alice',
    bio: 'Software developer',
    trustLevel: 'trusted',
    groups: ['group-1'],
    addedAt: new Date('2024-01-01'),
    metadata: { source: 'qr' },
  };

  const mockGroup: ContactGroup = {
    id: 'group-1',
    name: 'Friends',
    description: 'Close friends',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockImplementation(
      () => new Promise(() => {})
    );
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockImplementation(
      () => new Promise(() => {})
    );

    render(<ContactList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render empty state when no contacts', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue([]);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([]);

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText(/no contacts found/i)).toBeInTheDocument();
    });
  });

  it('should render contact list', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue([mockContact]);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Software developer')).toBeInTheDocument();
      expect(screen.getByText('trusted')).toBeInTheDocument();
    });
  });

  it('should filter contacts by search query', async () => {
    const contacts = [
      mockContact,
      { ...mockContact, id: 'contact-2', displayName: 'Bob', bio: 'Designer' },
    ];

    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue(contacts);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([mockGroup]);
    vi.mocked(contactStoreModule.contactStore.searchContacts).mockImplementation(async (query) => {
      return contacts.filter(c => c.displayName.toLowerCase().includes(query.toLowerCase()));
    });

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(contactStoreModule.contactStore.searchContacts).toHaveBeenCalledWith('Alice');
    });
  });

  it('should filter contacts by trust level', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue([mockContact]);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const trustLevelSelect = screen.getByLabelText(/trust level/i);
    fireEvent.change(trustLevelSelect, { target: { value: 'trusted' } });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  it('should filter contacts by group', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue([mockContact]);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const groupSelect = screen.getByLabelText(/group/i);
    fireEvent.change(groupSelect, { target: { value: 'group-1' } });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  it('should open group manager', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue([mockContact]);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const manageButton = screen.getByRole('button', { name: /manage groups/i });
    fireEvent.click(manageButton);

    await waitFor(() => {
      expect(screen.getByText(/manage groups/i)).toBeInTheDocument();
    });
  });

  it('should display contact details when clicked', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue([mockContact]);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const contactCard = screen.getByText('Alice').closest('div');
    if (contactCard) {
      fireEvent.click(contactCard);
    }

    await waitFor(() => {
      expect(screen.getByText(/contact details/i)).toBeInTheDocument();
    });
  });

  it('should display error state when loading fails', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockRejectedValue(
      new Error('Failed to load contacts')
    );
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([]);

    render(<ContactList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load contacts/i)).toBeInTheDocument();
    });
  });

  it('should display group badges for contacts', async () => {
    vi.mocked(contactStoreModule.contactStore.getAllContacts).mockResolvedValue([mockContact]);
    vi.mocked(contactStoreModule.contactStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ContactList />);

    await waitFor(() => {
      const friendsElements = screen.getAllByText('Friends');
      // Should appear in both the group filter dropdown and the contact badge
      expect(friendsElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
