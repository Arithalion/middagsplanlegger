interface KnappProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primær' | 'sekundær' | 'fare' | 'spøkelse'
  størrelse?: 'sm' | 'md' | 'lg'
  laster?: boolean
  children: React.ReactNode
}

const variantKlasser: Record<string, string> = {
  primær:   'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
  sekundær: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  fare:     'bg-red-600 text-white hover:bg-red-700',
  spøkelse: 'text-gray-600 hover:bg-gray-100',
}

const størrelseKlasser: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export default function Knapp({
  variant = 'primær',
  størrelse = 'md',
  laster = false,
  children,
  disabled,
  className = '',
  ...props
}: KnappProps) {
  return (
    <button
      {...props}
      disabled={disabled || laster}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-lg font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantKlasser[variant]}
        ${størrelseKlasser[størrelse]}
        ${className}
      `}
    >
      {laster && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
