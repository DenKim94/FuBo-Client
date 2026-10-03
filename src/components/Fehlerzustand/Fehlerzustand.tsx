import { fehlertextBilden, istWiederholbar } from '@/api/common/fehler'
import CustomButton from '@/components/CustomButton/CustomButton'
import Icon from '@/components/Icon/Icon'
import style from './Fehlerzustand.module.scss'

/** Eigenschaften des Fehlerzustands. */
type FehlerzustandEigenschaften = {
  /** Der Fehler der Abfrage, beliebigen Typs (`ApiFehler`, Netzfehler, sonstiges). */
  fehler: unknown
  /** Löst einen neuen Versuch aus, meist `() => void abfrage.refetch()`. */
  erneut?: () => void
  /** Text für Fehler, die weder vom Server stammen noch Netzfehler sind. */
  ersatz?: string
  /** Test-ID des Behälters; die Schaltfläche erhält dieselbe mit `-erneut`. */
  'data-testid'?: string
}

/**
 * Fehlerzustand einer Ansicht, deren Daten nicht geladen werden konnten (C2, Abschnitt 5.1).
 *
 * **Zeigt den Text des Servers und ersetzt ihn nicht** (`fehlertextBilden`).
 * Eigene Worte nur, wo gar keine Antwort kam.
 *
 * **„Erneut versuchen“ erscheint nur, wenn ein zweiter Versuch etwas ändern
 * kann** (`istWiederholbar`: Netzfehler, `≥ 500`) – nicht bei `403` oder `409`.
 * Dort beantwortete der Server den neuen Versuch genauso, und die Schaltfläche
 * verspräche etwas, das sie nicht halten kann.
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
    <div className={style.zustand} role="alert" data-testid={testId}>
      <span className={style.symbol}>
        <Icon name="error_circle_icon" groesse={2.5} />
      </span>
      <p className={style.text}>{fehlertextBilden(fehler, ersatz)}</p>
      {wiederholbar && (
        <CustomButton onClick={erneut} data-testid={`${testId}-erneut`}>
          Erneut versuchen
        </CustomButton>
      )}
    </div>
  )
}
