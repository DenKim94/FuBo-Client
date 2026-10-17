import { useLocation, useNavigate } from 'react-router'

/**
 * Liest einen Hinweis aus dem Navigationszustand (`location.state.hinweis`).
 *
 * @param zustand Der Navigationszustand, beliebigen Typs.
 * @returns Der Text oder `null`.
 */
function hinweisLesen(zustand: unknown): string | null {
  const hinweis = (zustand as { hinweis?: unknown } | null)?.hinweis
  return typeof hinweis === 'string' && hinweis !== '' ? hinweis : null
}

/** Rückgabe von {@link useNavigationsHinweis}. */
export type NavigationsHinweis = {
  /** Der Text, den die vorige Ansicht mitgegeben hat, oder `null`. */
  hinweis: string | null
  /** Blendet den Hinweis aus; ohne Hinweis ohne Wirkung. */
  verbergen: () => void
}

/**
 * Liest den Hinweis, mit dem eine Ansicht betreten wurde (C4, 5.5, E4).
 *
 * Zwei Wege führen mit einem Hinweis zu einer Ansicht: der Reset zur
 * Admin-Anmeldung (`navigate` mit `state`) und das erzwungene Sitzungsende nach
 * dem Passwortwechsel zur PIN-Eingabe (`SitzungsWaechter`). Die Zielansicht
 * zeigt ihn neutral (`Hinweis`) über dem Formular.
 *
 * **Der Hinweis liegt im Verlaufseintrag** (`history.state`) und überlebt ein
 * Neuladen – anders als ein lokaler Zustand, aber auch anders als gewollt:
 * Nach der nächsten Eingabe oder dem nächsten Absenden hat er seine Aufgabe
 * erfüllt. {@link NavigationsHinweis.verbergen} ersetzt deshalb den Eintrag
 * ohne Hinweis (`replace`); andere Teile des Zustands (etwa `von`) bleiben.
 */
export function useNavigationsHinweis(): NavigationsHinweis {
  const ort = useLocation()
  const navigate = useNavigate()
  const hinweis = hinweisLesen(ort.state)

  function verbergen() {
    if (hinweis === null) return
    const rest = { ...(ort.state as Record<string, unknown>) }
    delete rest.hinweis
    void navigate(
      { pathname: ort.pathname, search: ort.search, hash: ort.hash },
      { replace: true, state: Object.keys(rest).length > 0 ? rest : null },
    )
  }

  return { hinweis, verbergen }
}
