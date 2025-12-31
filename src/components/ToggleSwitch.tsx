interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`
          relative w-14 h-7 rounded-full flex items-center transition-all duration-200 shrink-0
          ${checked
            ? 'bg-green-500'
            : 'bg-gray-400'
          }
          shadow-inner
        `}
      >
        {/* ON label */}
        <span
          className={`
            absolute left-1.5 text-[9px] font-bold transition-opacity duration-200
            ${checked ? 'opacity-100 text-white' : 'opacity-0'}
          `}
        >
          ON
        </span>

        {/* OFF label */}
        <span
          className={`
            absolute right-1.5 text-[9px] font-bold transition-opacity duration-200
            ${checked ? 'opacity-0' : 'opacity-100 text-white'}
          `}
        >
          OFF
        </span>

        {/* Knob */}
        <div
          className={`
            absolute top-1 w-5 h-5 bg-white rounded-full shadow-md
            transition-all duration-200 ease-in-out
            ${checked ? 'left-8' : 'left-1'}
          `}
        />
      </div>
      {label && <span className="text-sm text-white">{label}</span>}
    </label>
  );
}
