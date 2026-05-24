export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🍽️</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Middagsplanleggeren</h1>
          <p className="mt-1 text-sm text-gray-500">Planlegg, handle og spar</p>
        </div>
        {children}
      </div>
    </div>
  )
}
