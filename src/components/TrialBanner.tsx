import { useLicenseStore } from '../stores/licenseStore';

export function TrialBanner() {
  const { licenseInfo } = useLicenseStore();

  // Only show for trial users
  if (!licenseInfo || licenseInfo.status !== 'trial') {
    return null;
  }

  const daysRemaining = licenseInfo.trial_days_remaining ?? 0;

  // Determine banner style based on days remaining
  let bannerClass = 'bg-blue-600 text-white';
  let urgencyText = '';

  if (daysRemaining <= 3) {
    bannerClass = 'bg-red-600 text-white';
    urgencyText = daysRemaining === 0 ? 'Expires today!' : `Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left!`;
  } else if (daysRemaining <= 7) {
    bannerClass = 'bg-yellow-500 text-gray-900';
    urgencyText = `${daysRemaining} days remaining`;
  } else {
    urgencyText = `${daysRemaining} days remaining`;
  }

  return (
    <div className={`${bannerClass} px-4 py-2 text-sm flex items-center justify-center gap-4`}>
      <span className="font-medium">
        Trial Version - {urgencyText}
      </span>
      <span className="opacity-75">|</span>
      <span className="opacity-90">PDF exports include watermark</span>
      <button
        onClick={() => window.open('https://stitchalot.studio/purchase', '_blank')}
        className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
      >
        Purchase Now
      </button>
    </div>
  );
}
