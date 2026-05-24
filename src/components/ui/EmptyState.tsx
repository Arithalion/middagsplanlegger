interface Props {
  tittel?: string
  beskrivelse?: string
  ikon?: string
  handling?: React.ReactNode
}

export default function EmptyState({
  tittel = 'Ingen data',
  beskrivelse,
  ikon = '📭',
  handling,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{ikon}</span>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{tittel}</h3>
      {beskrivelse && <p className="text-sm text-gray-500 mb-6 max-w-sm">{beskrivelse}</p>}
      {handling && <div>{handling}</div>}
    </div>
  )
}
