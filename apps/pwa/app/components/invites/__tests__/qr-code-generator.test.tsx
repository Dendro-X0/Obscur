import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QRCodeGenerator } from '../qr-code-generator';
import * as useIdentityModule from '../../../lib/use-identity';
import * as qrGeneratorModule from '../../../lib/invites/qr-generator';

// Mock the identity hook
vi.mock('../../../lib/use-identity');
vi.mock('../../../lib/invites/qr-generator');

describe('QRCodeGenerator', () => {
  const mockPublicKey = '0'.repeat(64);
  const mockPrivateKey = '1'.repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render locked state when identity is not unlocked', () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: { status: 'locked' },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    render(<QRCodeGenerator />);

    expect(screen.getByText(/please unlock your identity/i)).toBeInTheDocument();
  });

  it('should render form when identity is unlocked', () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: mockPrivateKey as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    render(<QRCodeGenerator />);

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/personal message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expiration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate qr code/i })).toBeInTheDocument();
  });

  it('should generate QR code when form is submitted', async () => {
    const mockQRCode = {
      dataUrl: 'data:image/png;base64,mock',
      svgString: '<svg></svg>',
      rawData: 'mock-data',
      size: 256,
    };

    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: mockPrivateKey as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(qrGeneratorModule.qrGenerator.createInviteQR).mockResolvedValue(mockQRCode);

    render(<QRCodeGenerator />);

    const generateButton = screen.getByRole('button', { name: /generate qr code/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByAltText(/qr code/i)).toBeInTheDocument();
    });

    expect(qrGeneratorModule.qrGenerator.createInviteQR).toHaveBeenCalledWith(
      mockPublicKey,
      mockPrivateKey,
      expect.objectContaining({
        expirationHours: 24,
        includeProfile: true,
      })
    );
  });

  it('should display error when QR generation fails', async () => {
    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: mockPrivateKey as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(qrGeneratorModule.qrGenerator.createInviteQR).mockRejectedValue(
      new Error('Generation failed')
    );

    render(<QRCodeGenerator />);

    const generateButton = screen.getByRole('button', { name: /generate qr code/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/generation failed/i)).toBeInTheDocument();
    });
  });

  it('should allow customizing QR code options', async () => {
    const mockQRCode = {
      dataUrl: 'data:image/png;base64,mock',
      svgString: '<svg></svg>',
      rawData: 'mock-data',
      size: 256,
    };

    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: mockPrivateKey as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(qrGeneratorModule.qrGenerator.createInviteQR).mockResolvedValue(mockQRCode);

    render(<QRCodeGenerator />);

    // Fill in custom options
    const displayNameInput = screen.getByLabelText(/display name/i);
    const messageInput = screen.getByLabelText(/personal message/i);
    const expirationInput = screen.getByLabelText(/expiration/i);

    fireEvent.change(displayNameInput, { target: { value: 'Test User' } });
    fireEvent.change(messageInput, { target: { value: 'Hello!' } });
    fireEvent.change(expirationInput, { target: { value: '48' } });

    const generateButton = screen.getByRole('button', { name: /generate qr code/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(qrGeneratorModule.qrGenerator.createInviteQR).toHaveBeenCalledWith(
        mockPublicKey,
        mockPrivateKey,
        expect.objectContaining({
          displayName: 'Test User',
          message: 'Hello!',
          expirationHours: 48,
          includeProfile: true,
        })
      );
    });
  });

  it('should show sharing options after successful generation', async () => {
    const mockQRCode = {
      dataUrl: 'data:image/png;base64,mock',
      svgString: '<svg></svg>',
      rawData: 'mock-data',
      size: 256,
    };

    vi.mocked(useIdentityModule.useIdentity).mockReturnValue({
      state: {
        status: 'unlocked',
        publicKeyHex: mockPublicKey as any,
        privateKeyHex: mockPrivateKey as any,
      },
      unlock: vi.fn(),
      lock: vi.fn(),
      create: vi.fn(),
      restore: vi.fn(),
      clear: vi.fn(),
    });

    vi.mocked(qrGeneratorModule.qrGenerator.createInviteQR).mockResolvedValue(mockQRCode);

    render(<QRCodeGenerator />);

    const generateButton = screen.getByRole('button', { name: /generate qr code/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy data/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    });
  });
});
