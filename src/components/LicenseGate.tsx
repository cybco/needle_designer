import { useEffect, useState, ReactNode } from 'react';
import { useLicenseStore } from '../stores/licenseStore';
import { getLicenseStatusMessage } from '../types/license';

interface LicenseGateProps {
  children: ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  const {
    licenseInfo,
    isLoading,
    error,
    initialized,
    initialize,
    startTrial,
    canUseApp,
    clearError,
  } = useLicenseStore();

  const [isStartingTrial, setIsStartingTrial] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle starting trial
  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    clearError();
    try {
      await startTrial();
    } catch (err) {
      // Error is already stored in the store
    } finally {
      setIsStartingTrial(false);
    }
  };

  // Show loading screen during initialization
  if (!initialized || isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // If user can use the app, render children
  if (canUseApp()) {
    return <>{children}</>;
  }

  // Show activation dialog
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Logo/Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Stitch A Lot Studio</h1>
          <p className="text-gray-600 mt-1">Pattern Designer</p>
        </div>

        {/* Status message */}
        {licenseInfo && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Status:{' '}
              <span className={getStatusColorClass(licenseInfo.status)}>
                {getLicenseStatusMessage(licenseInfo.status)}
              </span>
            </p>
            {licenseInfo.status === 'trial_expired' && (
              <p className="text-sm text-red-600 mt-2">
                Your 30-day trial has expired. Please purchase a license to continue using the app.
              </p>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions based on status */}
        <div className="space-y-3">
          {/* Start Trial button (only if no trial started yet) */}
          {licenseInfo?.status === 'none' && (
            <button
              onClick={handleStartTrial}
              disabled={isStartingTrial}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isStartingTrial ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting Trial...
                </>
              ) : (
                'Start 30-Day Free Trial'
              )}
            </button>
          )}

          {/* Enter License Key button */}
          <button
            onClick={() => {
              // TODO: Open activation dialog (Phase 2)
              alert('License key activation will be available in the next update.');
            }}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Enter License Key
          </button>

          {/* Purchase button */}
          <button
            onClick={() => {
              // Open purchase page in browser
              window.open('https://stitchalot.studio/purchase', '_blank');
            }}
            className="w-full py-3 px-4 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Purchase License - $59.99
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Trial includes all features. PDF exports will have a watermark during the trial period.
          </p>
        </div>

        {/* Debug: Reset button (dev only) */}
        {import.meta.env.DEV && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => useLicenseStore.getState().resetLicenseState()}
              className="w-full py-2 px-4 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm font-medium rounded-lg transition-colors"
            >
              [DEV] Reset License State
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColorClass(status: string): string {
  switch (status) {
    case 'licensed':
    case 'licensed_updates_expired':
      return 'text-green-600 font-medium';
    case 'trial':
      return 'text-blue-600 font-medium';
    case 'trial_expired':
    case 'invalid':
      return 'text-red-600 font-medium';
    case 'grace_period':
      return 'text-yellow-600 font-medium';
    default:
      return 'text-gray-600';
  }
}
