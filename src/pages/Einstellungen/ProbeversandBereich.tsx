import { useId } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Textlink from '@/components/Textlink/Textlink'
import { usePushProbeversand } from '@/hooks/push/usePushProbeversand'
import { usePushSchluessel } from '@/hooks/push/usePushSchluessel'
import { usePushStatus } from '@/hooks/push/usePushStatus'
import { probeErgebnisText } from './probeErgebnisText'
import style from './Einstellungen.module.scss'

/** Satz, wenn der Server keine VAPID-Schlüssel hat (3.3). */
export const TEXT_PROBE_NICHT_EINGERICHTET = 'Push ist auf diesem Server nicht eingerichtet (VAPID-Schlüssel fehlen).'

/** Der dauerhafte Satz zum Preis des Probeversands (P6). */
export const TEXT_PROBE_AUSSAGE = 'Das zeigt, dass der Versand technisch funktioniert – nicht, dass Spieler etwas bekommen.'

/** Erkennt `503 PUSH_NICHT_KONFIGURIERT`. */
function istNichtEingerichtet(fehler: unknown): boolean {
  return fehler instanceof ApiFehler && fehler.status === 503 && fehler.code === 'PUSH_NICHT_KONFIGURIERT'
}

/**
 * Probeversand des Admins (C9, 6.3, P6; E21 aus C8).
 *
 * **Der Anlagenschalter steht immer daneben** (`anlageAktiv`): Ein erfolgreicher Probeversand beweist nur, dass
 * Schlüssel, Verschlüsselung und der Weg zum Push-Dienst tragen – er prüft die Schalter nicht. Der Satz dazu steht
 * dauerhaft, nicht erst nach dem Versand.
 *
 * Ohne VAPID-Einrichtung ist die Aktion `aria-disabled` mit dem Grund als Text (`aria-describedby`), nie `disabled`.
 * Kein automatischer zweiter Versuch: Jeder Versuch schickt eine Nachricht.
 */
export default function ProbeversandBereich() {
  const status = usePushStatus(true)
  const schluessel = usePushSchluessel(true)
  const probe = usePushProbeversand()
  const grundId = useId()
  const nichtEingerichtet = schluessel.verfuegbar === false || istNichtEingerichtet(probe.error)

  let anlage = 'Versand an die Spieler: wird gelesen …'
  if (status.data) {
    anlage = status.data.anlageAktiv
      ? 'Versand an die Spieler ist eingeschaltet.'
      : 'Versand an die Spieler ist abgeschaltet – der Probeversand kommt trotzdem an.'
  } else if (status.error) {
    anlage = 'Versand an die Spieler: nicht bekannt.'
  }

  return (
    <section className={style.abschnitt} aria-labelledby="probe-titel" data-testid="probe-bereich">
      <h2 id="probe-titel" className={style.abschnittTitel}>
        Probeversand
      </h2>
      <p className={style.satz} data-testid="probe-anlage">
        {anlage}
      </p>
      <Textlink to={ADMIN_PFADE.konfiguration} data-testid="probe-konfiguration-link">
        In der Konfiguration ändern
      </Textlink>
      <p className={style.klein} data-testid="probe-aussage">
        {TEXT_PROBE_AUSSAGE}
      </p>

      {nichtEingerichtet && (
        <p id={grundId} className={style.satz} data-testid="probe-nicht-eingerichtet">
          {TEXT_PROBE_NICHT_EINGERICHTET}
        </p>
      )}
      <CustomButton
        art="akzent"
        breit
        laedt={probe.isPending}
        aria-disabled={nichtEingerichtet || undefined}
        aria-describedby={nichtEingerichtet ? grundId : undefined}
        onClick={() => {
          if (!nichtEingerichtet && !probe.isPending) probe.mutate()
        }}
        data-testid="probe-senden"
      >
        Testbenachrichtigung senden
      </CustomButton>

      {probe.data && (
        <p className={style.satz} role="status" data-testid="probe-ergebnis">
          {probeErgebnisText(probe.data)}
        </p>
      )}
      {probe.error && !istNichtEingerichtet(probe.error) && (
        <Fehlermeldung fehler={probe.error} data-testid="probe-fehler" />
      )}
    </section>
  )
}
