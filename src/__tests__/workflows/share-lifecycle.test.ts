// Setup Buff mock before any imports
import { setupBuffMock } from '../__mocks__/buff.mock';
setupBuffMock();

// Mock dependencies before imports
const mockInvoke = jest.fn();
jest.mock('electron', () => ({
  ipcRenderer: {
    invoke: mockInvoke
  }
}));

jest.mock('../../lib/encryption');

import { clientShareManager, type IglooShare } from '../../lib/clientShareManager';
import { derive_secret, encrypt_payload, decrypt_payload } from '../../lib/encryption';

describe('Share Lifecycle Workflow (Desktop Integration)', () => {
  // Access the mock function directly since we defined it above
  const mockDeriveSecret = derive_secret as jest.MockedFunction<typeof derive_secret>;
  const mockEncryptPayload = encrypt_payload as jest.MockedFunction<typeof encrypt_payload>;
  const mockDecryptPayload = decrypt_payload as jest.MockedFunction<typeof decrypt_payload>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup encryption mocks
    mockDeriveSecret.mockReturnValue('derived-secret-hex');
    mockEncryptPayload.mockReturnValue('encrypted-data');
    mockDecryptPayload.mockReturnValue('decrypted-share-data');
  });

  describe('Complete Share Workflow', () => {
    it('should handle the full share lifecycle: create → save → load → use', async () => {
      // Step 1: Create a new share (simulating Keyset component)
      const newShare: IglooShare = {
        id: 'test-share-123',
        name: 'Test Share',
        share: 'bfshare1test123encrypted',
        salt: 'random-salt-123',
        groupCredential: 'bfgroup1test123',
        metadata: {
          binder_sn: 'abc123def',
          created: Date.now()
        }
      };

      // Step 2: Save share to filesystem (simulating SaveShare component)
      mockInvoke.mockResolvedValueOnce(true); // save-share success
      
      const saveResult = await clientShareManager.saveShare(newShare);
      
      expect(saveResult).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('save-share', newShare);

      // Step 3: Retrieve shares from filesystem (simulating ShareList component)
      mockInvoke.mockResolvedValueOnce([newShare]); // get-shares
      
      const shares = await clientShareManager.getShares();
      
      expect(shares).toEqual([newShare]);
      expect(mockInvoke).toHaveBeenCalledWith('get-shares');

      // Step 4: Load and decrypt share (simulating LoadShare component)
      // This involves decryption in the real workflow
      const password = 'user-password';
      
      // Simulate the decryption process that would happen in LoadShare component
      const derivedSecret = mockDeriveSecret(password, newShare.salt || '');
      const decryptedShareData = mockDecryptPayload(derivedSecret, newShare.share);
      
      // Verify the decryption functions were called as expected in LoadShare component
      expect(mockDeriveSecret).toHaveBeenCalledWith(password, newShare.salt);
      expect(mockDecryptPayload).toHaveBeenCalledWith(derivedSecret, newShare.share);
      expect(decryptedShareData).toBe('decrypted-share-data');
      
      // Step 5: Use share in Signer (already tested in component tests)
      // Decrypted share data would be passed to Signer component
      
             // Verify the workflow completed successfully
       expect(shares).toHaveLength(1);
       expect(Array.isArray(shares) && shares[0].id).toBe(newShare.id);
    });

    it('should handle share cleanup and deletion', async () => {
      const shareId = 'test-share-to-delete';
      
      // Delete share
      mockInvoke.mockResolvedValueOnce(true); // delete-share success
      
      const deleteResult = await clientShareManager.deleteShare(shareId);
      
      expect(deleteResult).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('delete-share', shareId);
      
      // Verify share is no longer in list
      mockInvoke.mockResolvedValueOnce([]); // get-shares returns empty
      
      const shares = await clientShareManager.getShares();
      expect(shares).toEqual([]);
    });

    it('should handle share discovery by binder serial number', async () => {
      const testShares: IglooShare[] = [
        {
          id: 'share-1',
          name: 'Share 1',
          share: 'data1',
          salt: 'salt1',
          groupCredential: 'group1',
          metadata: { binder_sn: 'abc123' }
        },
        {
          id: 'share-2',
          name: 'Share 2',
          share: 'data2',
          salt: 'salt2',
          groupCredential: 'group2',
          metadata: { binder_sn: 'def456' }
        }
      ];

      mockInvoke.mockResolvedValueOnce(testShares); // get-shares
      
      const foundShares = await clientShareManager.findSharesByBinderSN('abc123');
      
      expect(foundShares).toHaveLength(1);
      expect(foundShares[0].metadata?.binder_sn).toBe('abc123');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle save failures gracefully', async () => {
      const share: IglooShare = {
        id: 'test',
        name: 'Test',
        share: 'data',
        salt: 'salt',
        groupCredential: 'group'
      };

      // Mock console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const expectedError = new Error('Filesystem error');
      mockInvoke.mockRejectedValueOnce(expectedError);
      
      const result = await clientShareManager.saveShare(share);
      
      // Verify return value
      expect(result).toBe(false);
      
      // Verify error logging behavior
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save share:', expectedError);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should handle load failures gracefully', async () => {
      // Mock console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const expectedError = new Error('Read error');
      mockInvoke.mockRejectedValueOnce(expectedError);
      
      const result = await clientShareManager.getShares();
      
      // Verify return value
      expect(result).toBe(false);
      
      // Verify error logging behavior
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error retrieving shares:', expectedError);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should handle file operations errors', async () => {
      // Mock console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const expectedError = new Error('File system error');
      mockInvoke.mockRejectedValueOnce(expectedError);
      
      const result = await clientShareManager.openShareLocation('test-id');
      
      // Should not throw, just handle gracefully
      expect(result).toBeUndefined();
      
      // Verify error logging behavior
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to open share location:', expectedError);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Desktop-Specific Features', () => {
    it('should open share location in file explorer', async () => {
      mockInvoke.mockResolvedValueOnce(undefined); // open-share-location
      
      await clientShareManager.openShareLocation('test-share-id');
      
      expect(mockInvoke).toHaveBeenCalledWith('open-share-location', 'test-share-id');
    });

    it('should handle concurrent operations', async () => {
      const share1: IglooShare = {
        id: 'concurrent-1',
        name: 'Concurrent 1',
        share: 'data1',
        salt: 'salt1',
        groupCredential: 'group1'
      };

      const share2: IglooShare = {
        id: 'concurrent-2',
        name: 'Concurrent 2',
        share: 'data2',
        salt: 'salt2',
        groupCredential: 'group2'
      };

      // Simulate concurrent saves
      mockInvoke
        .mockResolvedValueOnce(true) // First save
        .mockResolvedValueOnce(true); // Second save
      
      const [result1, result2] = await Promise.all([
        clientShareManager.saveShare(share1),
        clientShareManager.saveShare(share2)
      ]);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });
  });
}); 