import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';

/**
 * Checks for an OTA update on mount and exposes state for the UI banner.
 *
 * - Silent on failure (no internet, server unreachable, etc.)
 * - No-op in Expo Go / dev builds where Updates.isEnabled is false
 * - `applyUpdate` downloads then reloads the app in one step
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    if (!Updates.isEnabled) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) setUpdateAvailable(true);
    } catch {
      // Network error or update server unreachable — fail silently
    }
  }

  async function applyUpdate() {
    if (!Updates.isEnabled || isDownloading) return;
    setIsDownloading(true);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      // Download failed — reset so user can retry
      setIsDownloading(false);
    }
  }

  return { updateAvailable, isDownloading, applyUpdate };
}
