import { istWiederholbar } from '@/api/common/fehler'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import style from './Fehlerzustand.module.scss'

/** Eigenschaften des Fehlerzustands. */
type FehlerzustandEigenschaften = {
  /** Der Fehler der Abfrage, beliebigen Typs (`ApiFehler`, Netzfehler, sonstiges). */
  fehler: unknown
  /** Löst einen neuen Versuch aus, meist `() => void abfrage.refetch()`. */
  erneut?: () => void
  /** Text für Fehler, die weder vom Server stammen noch Netzfehler sind. */
  ersatz?: string
  /**
   * Test-ID des Behälters; die Meldung erhält dieselbe mit `-meldung`, die
   * Schaltfläche mit `-erneut`.
   */
  'data-testid'?: string
}

/**
 * Fehlerzustand einer Ansicht, deren Daten nicht geladen werden konnten (C2, Abschnitt 5.1).
 *
 * Besteht aus einer `Fehlermeldung` und – nur wenn ein zweiter Versuch etwas
 * ändern kann (`istWiederholbar`: Netzfehler, `≥ 500`) – der Schaltfläche
 * „Erneut versuchen“. Bei `403` oder `409` beantwortete der Server den neuen
 * Versuch genauso, und die Schaltfläche verspräche etwas, das sie nicht halten
 * kann.
 *
 * **Kompakt statt raumfüllend** (04.10.2026): Der Zustand tritt an die Stelle
 * des Inhalts, der nicht geladen werden konnte, und ist etwa so hoch wie
 * dieser – kein `flex: 1`, kein grosses Symbol. Ein Fehler soll das Layout
 * nicht verschieben und kein Scrollen auslösen.
 *
 * Ein `401 SESSION_UNGUELTIG` kommt hier praktisch nicht an: Den fängt
 * `queryClient.ts` ab und leitet zur PIN um.
 */
export default function Fehlerzustand({
  fehler,
  erneut,
  ersatz,
  'data-testid': testId = 'fehlerzustand',
}: FehlerzustandEigenschaften) {
  const wiederholbar = erneut !== undefined && istWiederholbar(fehler)

  return (
    <div className={style.zustand} data-testid={testId}>
      <Fehlermeldung fehler={fehler} ersatz={ersatz} data-testid={`${testId}-meldung`} />
      {wiederholbar && (
        <CustomButton onClick={erneut} data-testid={`${testId}-erneut`}>
          Erneut versuchen
        </CustomButton>
      )}
    </div>
  )
}
