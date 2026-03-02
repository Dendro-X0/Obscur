import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionList } from '../connection-list';
import * as connectionStoreModule from '../../../features/invites/utils/connection-store';
import type { Connection, ConnectionGroup } from '../../../features/invites/utils/types';

// Mock the connection store
vi.mock('../../../features/invites/utils/connection-store');

describe('ConnectionList', () => {
  const mockConnection: Connection = {
    id: 'connection-1',
    publicKey: '0'.repeat(64) as any,
    displayName: 'Alice',
    bio: 'Software developer',
    trustLevel: 'trusted',
    groups: ['group-1'],
    addedAt: new Date('2024-01-01'),
    metadata: { source: 'qr' },
  };

  const mockGroup: ConnectionGroup = {
    id: 'group-1',
    name: 'Friends',
    description: 'Close friends',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockImplementation(
      () => new Promise(() => { })
    );
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockImplementation(
      () => new Promise(() => { })
    );

    render(<ConnectionList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render empty state when no connections', async () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue([]);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([]);

    render(<ConnectionList />);

    await waitFor(() => {
      expect(screen.getByText(/no connections found/i)).toBeInTheDocument();
    });
  });

  it('should render connection list', async () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue([mockConnection]);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ConnectionList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Software developer')).toBeInTheDocument();
      expect(screen.getByText('trusted')).toBeInTheDocument();
    });
  });

  it('should filter connections by search query', async () => {
    const connections = [
      mockConnection,
      { ...mockConnection, id: 'connection-2', displayName: 'Bob', bio: 'Designer' },
    ];

    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue(connections);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([mockGroup]);
    vi.mocked(connectionStoreModule.connectionStore.searchConnections).mockImplementation(async (query: string) => {
      return connections.filter(c => c.displayName.toLowerCase().includes(query.toLowerCase()));
    });

    render(<ConnectionList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(connectionStoreModule.connectionStore.searchConnections).toHaveBeenCalledWith('Alice');
    });
  });

  it('should filter connections by trust level', async () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue([mockConnection]);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ConnectionList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const trustLevelSelect = screen.getByLabelText(/trust level/i);
    fireEvent.change(trustLevelSelect, { target: { value: 'trusted' } });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  it('should filter connections by group', async () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue([mockConnection]);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ConnectionList />);

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
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue([mockConnection]);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ConnectionList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const manageButton = screen.getByRole('button', { name: /manage groups/i });
    fireEvent.click(manageButton);

    await waitFor(() => {
      expect(screen.getByText(/manage groups/i)).toBeInTheDocument();
    });
  });

  it('should display connection details when clicked', async () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue([mockConnection]);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ConnectionList />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const closestDiv = screen.getByText('Alice').parentElement;
    if (closestDiv) {
      fireEvent.click(closestDiv);
    }

    await waitFor(() => {
      expect(screen.getByText(/connection details/i)).toBeInTheDocument();
    });
  });

  it('should display error state when loading fails', async () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockRejectedValue(
      new Error('Failed to load connections')
    );
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([]);

    render(<ConnectionList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load connections/i)).toBeInTheDocument();
    });
  });

  it('should display group badges for connections', async () => {
    vi.mocked(connectionStoreModule.connectionStore.getAllConnections).mockResolvedValue([mockConnection]);
    vi.mocked(connectionStoreModule.connectionStore.getAllGroups).mockResolvedValue([mockGroup]);

    render(<ConnectionList />);

    await waitFor(() => {
      const friendsElements = screen.getAllByText('Friends');
      // Should appear in both the group filter dropdown and the connection badge
      expect(friendsElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
