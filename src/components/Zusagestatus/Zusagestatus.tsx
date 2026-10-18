import Icon from '@/components/Icon/Icon'
import style from './Zusagestatus.module.scss'

/** Eigenschaften des Zusagestatus. */
type ZusagestatusEigenschaften = {
  /**
   * Die eigene Rückmeldung, **dreiwertig:** `true` zugesagt, `false` abgesagt,
   * `null` noch nicht gemeldet.
   */
  rueckmeldung: boolean | null
  /** Der eigene Eintrag steht auf der Warteschlange (nur bei `rueckmeldung = true`). */
  wartet?: boolean
  /** Platz auf der Warteschlange, 1-basiert; nur mit `wartet`. */
  warteplatz?: number
  /**
   * Knappe Form für Listenzeilen: ohne Zusatzsatz und ohne Live-Region. In einer
   * Liste wäre jede Zeile eine Ansage.
   */
  kompakt?: boolean
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Zeigt die eigene Rückmeldung zu einem Termin (A7), mit Symbol **und** Text.
 *
 * **Drei Zustände, nicht zwei.** „Noch nicht gemeldet“ ist der häufigste Fall
 * und darf nicht wie eine Absage aussehen: kein rotes Symbol, kein Fehlerton,
 * ein neutrales Info-Symbol. Ein `if (rueckmeldung)` an dieser Stelle behandelte
 * `null` wie `false` – deshalb wird gegen alle drei Werte verglichen.
 *
 * `role="status"` macht den Behälter zur Live-Region: Der Wechsel nach dem
 * Tippen („Du hast zugesagt.“) wird angesagt, ohne den Fokus zu verschieben.
 */
export default function Zusagestatus({
  rueckmeldung,
  wartet = false,
  warteplatz,
  kompakt = false,
  'data-testid': testId = 'zusagestatus',
}: ZusagestatusEigenschaften) {
  let zustand: 'zugesagt' | 'abgesagt' | 'offen'
  let icon: string
  let text: string
  let zusatz: string | null = null

  if (rueckmeldung === true) {
    zustand = 'zugesagt'
    icon = 'check_circle_icon'
    text =
      wartet && warteplatz !== undefined
        ? `Du hast zugesagt und stehst auf der Warteschlange (Platz ${warteplatz}).`
        : 'Du hast zugesagt.'
  } else if (rueckmeldung === false) {
    zustand = 'abgesagt'
    icon = 'cancel_circle_icon_red'
    text = 'Du hast abgesagt.'
  } else {
    zustand = 'offen'
    icon = 'info_circle_icon'
    text = 'Anmeldung ausstehend.'
    zusatz = 'Bitte gib eine Rückmeldung zur Teilnahme ab.'
  }

  return (
    <div
      className={[style.status, style[zustand], kompakt && style.kompakt].filter(Boolean).join(' ')}
      role={kompakt ? undefined : 'status'}
      data-zustand={zustand}
      data-testid={testId}
    >
      <span className={style.symbol}>
        <Icon name={icon} />
      </span>
      <p className={style.text}>
        <span>{text}</span>
        {zusatz && !kompakt && <span className={style.zusatz}> {zusatz}</span>}
      </p>
    </div>
  )
}
