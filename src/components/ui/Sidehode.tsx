interface SidehodeProps {
  tittel: string
  undertittel?: string
  children?: React.ReactNode
}

export default function Sidehode({ tittel, undertittel, children }: SidehodeProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{tittel}</h1>
        {undertittel && <p className="mt-1 text-sm text-gray-500">{undertittel}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
