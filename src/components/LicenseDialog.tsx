import { useState } from 'react';
import { X, Check, AlertCircle, Key, Shield, Calendar, Monitor } from 'lucide-react';
import { useLicenseStore } from '../stores/licenseStore';
import { getLicenseStatusMessage, getLicenseStatusColor } from '../types/license';
import { openUrl } from '../utils/openUrl';

interface LicenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LicenseDialog({ isOpen, onClose }: LicenseDialogProps) {
  const {
    licenseInfo,
    platformInfo,
    error,
    activateLicense,
    deactivateDevice,
    clearError,
  } = useLicenseStore();

  const [licenseKey, setLicenseKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  if (!isOpen) return null;

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setActivationError('Please enter a license key');
      return;
    }

    setIsActivating(true);
    setActivationError(null);
    clearError();

    try {
      await activateLicense(licenseKey.trim());
      setLicenseKey('');
      setShowKeyInput(false);
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    setIsDeactivating(true);
    try {
      await deactivateDevice();
      setShowDeactivateConfirm(false);
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeactivating(false);
    }
  };

  const isLicensed = licenseInfo?.status === 'licensed' || licenseInfo?.status === 'licensed_upgrade_required';
  const isTrial = licenseInfo?.status === 'trial';
  const statusColor = licenseInfo ? getLicenseStatusColor(licenseInfo.status) : 'text-gray-600';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">License Information</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Status Card */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">License Status</span>
              <span className={`font-medium ${statusColor}`}>
                {licenseInfo ? getLicenseStatusMessage(licenseInfo.status) : 'Loading...'}
              </span>
            </div>

            {/* Trial info */}
            {isTrial && licenseInfo?.trial_days_remaining !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {licenseInfo.trial_days_remaining} days remaining in trial
                </span>
              </div>
            )}

            {/* Licensed info */}
            {isLicensed && (
              <>
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-gray-600">Full version activated</span>
                </div>
                {licenseInfo?.licensed_version && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      Licensed for: v{licenseInfo.licensed_version} (perpetual)
                    </span>
                  </div>
                )}
                {licenseInfo?.status === 'licensed_upgrade_required' && (
                  <div className="flex items-center gap-2 text-sm mt-2 text-yellow-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      Upgrade required for v2. Your license covers v{licenseInfo.licensed_version}.
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Device info */}
            {isLicensed && (
              <div className="flex items-center gap-2 text-sm mt-2">
                <Monitor className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {licenseInfo?.devices_used ?? 0} of {licenseInfo?.devices_max ?? 3} devices activated
                </span>
              </div>
            )}
          </div>

          {/* Platform Info */}
          {platformInfo && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Device Information</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Platform:</span>
                  <span className="font-mono">{platformInfo.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span>App Version:</span>
                  <span className="font-mono">{platformInfo.app_version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Device ID:</span>
                  <span className="font-mono text-xs">{platformInfo.device_id.slice(0, 16)}...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {(error || activationError) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{activationError || error}</p>
            </div>
          )}

          {/* License Key Input Section */}
          {!isLicensed && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-700">Enter License Key</h3>
              </div>

              {showKeyInput ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    placeholder="STCH-XXXX-XXXX-XXXX-XXXX"
                    className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isActivating}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleActivate}
                      disabled={isActivating || !licenseKey.trim()}
                      className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {isActivating ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Activating...
                        </>
                      ) : (
                        'Activate'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowKeyInput(false);
                        setLicenseKey('');
                        setActivationError(null);
                      }}
                      disabled={isActivating}
                      className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Enter License Key
                </button>
              )}
            </div>
          )}

          {/* Purchase Link */}
          {!isLicensed && (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">Don't have a license?</p>
              <button
                onClick={() => openUrl('https://stitchalot.studio/software')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Purchase a license - $59.99
              </button>
            </div>
          )}

          {/* Deactivate option for licensed users */}
          {isLicensed && (
            <div className="border-t pt-4">
              <button
                onClick={() => setShowDeactivateConfirm(true)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Deactivate this device
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Frees up a device slot. You can reactivate later with the same license key.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Deactivate Confirmation Modal */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Deactivate Device?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to deactivate this device? This will free up a device slot and you can reactivate later with the same license key.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeactivateConfirm(false)}
                disabled={isDeactivating}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateConfirm}
                disabled={isDeactivating}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isDeactivating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deactivating...
                  </>
                ) : (
                  'Deactivate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
