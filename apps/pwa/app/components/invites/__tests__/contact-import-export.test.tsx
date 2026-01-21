import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContactImportExport } from '../contact-import-export';
import * as inviteManagerModule from '../../../lib/invites/invite-manager';
import type { ImportResult } from '../../../lib/invites/types';

// Mock the invite manager
vi.mock('../../../lib/invites/invite-manager');

describe('ContactImportExport', () => {
  const mockImportResult: ImportResult = {
    totalContacts: 10,
    successfulImports: 8,
    failedImports: 1,
    duplicates: 1,
    errors: [
      {
        publicKey: 'invalid-key',
        error: 'Invalid public key format',
        reason: 'invalid_key',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render import and export sections', () => {
    render(<ContactImportExport />);

    expect(screen.getByText(/import contacts/i)).toBeInTheDocument();
    expect(screen.getByText(/export contacts/i)).toBeInTheDocument();
  });

  it('should handle file selection for import', async () => {
    const mockFileContent = JSON.stringify({
      contacts: [
        { publicKey: '0'.repeat(64), petname: 'Alice' },
      ],
      version: 1,
      createdAt: Date.now(),
    });

    vi.mocked(inviteManagerModule.inviteManager.validateContactListFormat).mockResolvedValue({
      isValid: true,
      errors: [],
    });
    vi.mocked(inviteManagerModule.inviteManager.importContactsFromFile).mockResolvedValue(mockImportResult);

    render(<ContactImportExport />);

    const fileInput = screen.getByLabelText(/select file/i);
    const file = new File([mockFileContent], 'contacts.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.validateContactListFormat).toHaveBeenCalled();
    });
  });

  it('should display import results after successful import', async () => {
    const mockFileContent = JSON.stringify({
      contacts: [
        { publicKey: '0'.repeat(64), petname: 'Alice' },
      ],
      version: 1,
      createdAt: Date.now(),
    });

    vi.mocked(inviteManagerModule.inviteManager.validateContactListFormat).mockResolvedValue({
      isValid: true,
      errors: [],
    });
    vi.mocked(inviteManagerModule.inviteManager.importContactsFromFile).mockResolvedValue(mockImportResult);

    render(<ContactImportExport />);

    const fileInput = screen.getByLabelText(/select file/i);
    const file = new File([mockFileContent], 'contacts.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/import completed/i)).toBeInTheDocument();
      expect(screen.getByText(/total contacts: 10/i)).toBeInTheDocument();
      expect(screen.getByText(/successfully imported: 8/i)).toBeInTheDocument();
      expect(screen.getByText(/duplicates skipped: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/failed: 1/i)).toBeInTheDocument();
    });
  });

  it('should display import errors', async () => {
    const mockFileContent = JSON.stringify({
      contacts: [
        { publicKey: 'invalid', petname: 'Alice' },
      ],
      version: 1,
      createdAt: Date.now(),
    });

    vi.mocked(inviteManagerModule.inviteManager.validateContactListFormat).mockResolvedValue({
      isValid: true,
      errors: [],
    });
    vi.mocked(inviteManagerModule.inviteManager.importContactsFromFile).mockResolvedValue(mockImportResult);

    render(<ContactImportExport />);

    const fileInput = screen.getByLabelText(/select file/i);
    const file = new File([mockFileContent], 'contacts.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/import errors/i)).toBeInTheDocument();
      expect(screen.getByText('invalid-key')).toBeInTheDocument();
      expect(screen.getByText('Invalid public key format')).toBeInTheDocument();
    });
  });

  it('should handle invalid file format', async () => {
    const mockFileContent = 'invalid json';

    render(<ContactImportExport />);

    const fileInput = screen.getByLabelText(/select file/i);
    const file = new File([mockFileContent], 'contacts.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/import failed/i)).toBeInTheDocument();
    });
  });

  it('should handle validation errors', async () => {
    const mockFileContent = JSON.stringify({
      contacts: [],
      version: 1,
      createdAt: Date.now(),
    });

    vi.mocked(inviteManagerModule.inviteManager.validateContactListFormat).mockResolvedValue({
      isValid: false,
      errors: ['contacts field must be an array'],
    });

    render(<ContactImportExport />);

    const fileInput = screen.getByLabelText(/select file/i);
    const file = new File([mockFileContent], 'contacts.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/invalid file format/i)).toBeInTheDocument();
    });
  });

  it('should allow importing another file after completion', async () => {
    const mockFileContent = JSON.stringify({
      contacts: [
        { publicKey: '0'.repeat(64), petname: 'Alice' },
      ],
      version: 1,
      createdAt: Date.now(),
    });

    vi.mocked(inviteManagerModule.inviteManager.validateContactListFormat).mockResolvedValue({
      isValid: true,
      errors: [],
    });
    vi.mocked(inviteManagerModule.inviteManager.importContactsFromFile).mockResolvedValue(mockImportResult);

    render(<ContactImportExport />);

    const fileInput = screen.getByLabelText(/select file/i);
    const file = new File([mockFileContent], 'contacts.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/import completed/i)).toBeInTheDocument();
    });

    const importAnotherButton = screen.getByRole('button', { name: /import another file/i });
    fireEvent.click(importAnotherButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/select file/i)).toBeInTheDocument();
    });
  });

  it('should handle export action', async () => {
    const mockExportData = JSON.stringify({
      contacts: [
        { publicKey: '0'.repeat(64), petname: 'Alice' },
      ],
      version: 1,
      createdAt: Date.now(),
    });

    vi.mocked(inviteManagerModule.inviteManager.exportContactsToFile).mockResolvedValue(mockExportData);

    // Mock URL.createObjectURL and related functions
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    const mockLink = {
      click: vi.fn(),
      href: '',
      download: '',
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

    render(<ContactImportExport />);

    const exportButton = screen.getByRole('button', { name: /export contacts/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(inviteManagerModule.inviteManager.exportContactsToFile).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  it('should display supported formats information', () => {
    render(<ContactImportExport />);

    expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
    expect(screen.getByText(/nostr contact lists \(nip-02\)/i)).toBeInTheDocument();
    expect(screen.getByText(/obscur contact exports/i)).toBeInTheDocument();
  });

  it('should display import instructions', () => {
    render(<ContactImportExport />);

    expect(screen.getByText(/import instructions/i)).toBeInTheDocument();
    expect(screen.getByText(/file format/i)).toBeInTheDocument();
    expect(screen.getByText(/validation/i)).toBeInTheDocument();
    expect(screen.getByText(/rate limiting/i)).toBeInTheDocument();
  });

  it('should show validating state during file processing', async () => {
    const mockFileContent = JSON.stringify({
      contacts: [
        { publicKey: '0'.repeat(64), petname: 'Alice' },
      ],
      version: 1,
      createdAt: Date.now(),
    });

    vi.mocked(inviteManagerModule.inviteManager.validateContactListFormat).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ isValid: true, errors: [] }), 100))
    );

    render(<ContactImportExport />);

    const fileInput = screen.getByLabelText(/select file/i);
    const file = new File([mockFileContent], 'contacts.json', { type: 'application/json' });

    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    expect(screen.getByText(/validating file format/i)).toBeInTheDocument();
  });
});
