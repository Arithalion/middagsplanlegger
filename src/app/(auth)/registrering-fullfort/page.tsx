import Link from 'next/link'

export default async function RegistreringFullfortPage({
  searchParams,
}: {
  searchParams: Promise<{ epost?: string }>
}) {
  const { epost } = await searchParams

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
      <div className="text-5xl mb-4">📧</div>

      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Sjekk innboksen din
      </h2>

      <p className="text-sm text-gray-600 mb-1">
        Vi har sendt en bekreftelseslenke til
      </p>
      {epost && (
        <p className="text-sm font-semibold text-gray-900 mb-4">{epost}</p>
      )}
      <p className="text-sm text-gray-500 mb-6">
        Klikk på lenken i e-posten for å aktivere kontoen din.
        Etter det kan du logge inn.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-left">
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Ikke fått e-post?</span> Sjekk søppelpost eller
          spam-mappen. Det kan ta et par minutter.
        </p>
      </div>

      <Link
        href="/logg-inn"
        className="block w-full py-2.5 rounded-xl bg-green-600 text-white text-sm
          font-medium hover:bg-green-700 transition-colors"
      >
        Gå til innlogging
      </Link>
    </div>
  )
}
