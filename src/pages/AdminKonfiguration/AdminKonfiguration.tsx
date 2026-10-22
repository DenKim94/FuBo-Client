import { useCallback, useState } from 'react'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useKonfiguration } from '@/hooks/admin/useKonfiguration'
import { useKonfigurationAendern } from '@/hooks/admin/useKonfigurationAendern'
import KonfigurationFormular from './KonfigurationFormular'

/**
 * Konfiguration (`/admin/konfiguration`, C8 9.2): ein Formular mit sechs Gruppen, gespeichert als **Voll-Update**.
 *
 * **Dieser Baustein besitzt Abfrage und Mutation** (E5, C7 4.2): `key={konfiguration.version}` baut das Formular nach
 * jedem neuen Stand neu auf – nach dem eigenen Speichern ebenso wie nach `409 DATEN_VERALTET`. Meldung, „Gespeichert.“
 * und der Fokus liegen deshalb in der Mutation und im Merkzeichen hier und überleben den Neuaufbau.
 *
 * **Die Abfrage lädt bei jedem Besuch frisch** (`gcTime: 0`, ohne Polling, ohne Neuladen beim Fensterwechsel): Ein Stand
 * aus dem letzten Besuch setzte das Formular erst auf alte Werte und baute es beim Eintreffen des neuen neu auf.
 *
 * Solange noch kein Stand da ist, zeigt die Seite den Spinner oder – bei einem Fehler – einen Fehlerzustand mit
 * „Erneut versuchen“; ein Formular wird nie aus geratenen Werten gebaut.
 */
export default function AdminKonfiguration() {
  const abfrage = useKonfiguration()
  const aendern = useKonfigurationAendern()
  const [fokusSpeichern, setFokusSpeichern] = useState(false)

  const beiGespeichert = useCallback(() => {
    setFokusSpeichern(true)
  }, [])
  const beiFokussiert = useCallback(() => {
    setFokusSpeichern(false)
  }, [])

  const konfiguration = abfrage.data
  if (!konfiguration) {
    return abfrage.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Konfiguration wird geladen" />
    ) : (
      <Fehlerzustand fehler={abfrage.error} erneut={() => void abfrage.refetch()} data-testid="admin-konfig-laden-fehler" />
    )
  }

  return (
    <KonfigurationFormular
      key={konfiguration.version}
      konfiguration={konfiguration}
      aendern={aendern}
      beiGespeichert={beiGespeichert}
      fokusAufSpeichern={fokusSpeichern}
      beiFokussiert={beiFokussiert}
    />
  )
}
