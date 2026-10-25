import { useEffect, useRef, useState, type Ref } from 'react'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Icon from '@/components/Icon/Icon'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Schalter from '@/components/Schalter/Schalter'
import { pushFehlertext } from '@/hooks/push/pushFehlertext'
import { usePushEinrichten } from '@/hooks/push/usePushEinrichten'
import { usePushEinstellungAendern } from '@/hooks/push/usePushEinstellungAendern'
import { usePushEntfernen } from '@/hooks/push/usePushEntfernen'
import { usePushGeraet } from '@/hooks/push/usePushGeraet'
import { usePushSchluessel } from '@/hooks/push/usePushSchluessel'
import { usePushStatus } from '@/hooks/push/usePushStatus'
import { GERAET_TEXT, anlageText, geraetLage, gesamtsatz, personText } from '@/pwa/pushLage'
import style from './Einstellungen.module.scss'

/** Hinweis beim Abschalten des Personenschalters (E28, P5): einmal, unter dem Schalter. */
export const TEXT_ABSCHALTEN =
  'Du bekommst dann auch keine Nachricht, wenn ein Termin abgesagt wird. Das siehst du erst in der App.'

/** Satz für den Admin statt des Personenschalters (E25, P12). */
export const TEXT_ADMIN =
  'Als Admin bekommst du keine Erinnerungen und Absagen; dieses Gerät dient dem Probeversand.'

const ERSATZ_GERAET = 'Das hat nicht geklappt. Bitte versuche es erneut.'
const ERSATZ_SCHALTER = 'Die Einstellung konnte nicht gespeichert werden. Bitte versuche es erneut.'

/** Eine Zeile der Zustandsanzeige: Symbol, Ebene, Text. `ok` fehlt, solange gelesen wird. */
function ZustandZeile({
  ebene,
  text,
  ok,
  testId,
  ref,
}: {
  ebene: string
  text: string
  ok: boolean | undefined
  testId: string
  ref?: Ref<HTMLLIElement>
}) {
  const symbol = ok === undefined ? 'info_circle_icon' : ok ? 'check_circle_icon' : 'cancel_circle_icon_red'
  return (
    <li ref={ref} tabIndex={ref ? -1 : undefined} className={style.zeile} data-testid={testId}>
      <span className={style.symbol}>
        <Icon name={symbol} />
      </span>
      <span>
        <span className={style.ebene}>{ebene}: </span>
        <span data-testid={`${testId}-text`}>{text}</span>
      </span>
    </li>
  )
}

/**
 * Bereich „Benachrichtigungen“ der Einstellungen (C9, 6.2, E24, E25, E28, E30).
 *
 * **Drei Ebenen, drei Zeilen** (E24): „Für alle“ (Anlage, der Admin entscheidet), „Für dich“ (Personenschalter) und
 * „Dieses Gerät“ (Abonnement, nur der Browser kennt es; P1). Darunter **ein** Gesamtsatz, der die erste hindernde
 * Ebene nennt. Jede Lage verlangt eine andere Handlung; ein Ja/Nein schickte an die falsche Stelle.
 *
 * **Zwei getrennte Bedienelemente** (E25): der Personenschalter (sofort wirksam, alle Geräte) und der Gerätebereich
 * (nur dieses Gerät). Der Admin bekommt keinen Personenschalter, sondern {@link TEXT_ADMIN}.
 *
 * **Ohne VAPID-Einrichtung** (`503`, P2) steht nur ein Satz, ohne Bedienelemente (Abweichung von DESIGN.md: ganz ohne
 * Satz suchte der Spieler den Schalter).
 *
 * **Gerätebereich nur mit Inhalt** (Ladeanzeige, Knopf oder Fehler). Auf dem iPhone ohne Ablegen steht die Anleitung nur
 * im Abschnitt „App installieren“; in den Lagen ohne Bedienelement nennt die Gerätezeile den Grund.
 *
 * **„Einrichten“ ruft die Berechtigung synchron aus dem Klick** (E26, `usePushEinrichten`); der Schlüssel ist dann
 * schon geladen. Nach Einrichten und Entfernen liegt der Fokus auf der Gerätezeile (sonst auf `body`).
 */
export default function PushBereich({ istAdmin }: { istAdmin: boolean }) {
  const schluessel = usePushSchluessel(true)
  const status = usePushStatus(true)
  const geraet = usePushGeraet()
  const einrichten = usePushEinrichten()
  const entfernen = usePushEntfernen()
  const aendern = usePushEinstellungAendern()
  const [abschaltHinweis, setAbschaltHinweis] = useState(false)
  const geraetZeile = useRef<HTMLLIElement>(null)
  const [fokusGeraet, setFokusGeraet] = useState(0)

  useEffect(() => {
    if (fokusGeraet > 0) geraetZeile.current?.focus()
  }, [fokusGeraet])

  const lage = geraetLage({
    umgebung: geraet.data?.umgebung,
    geraet: geraet.data?.stand,
    schluesselVerfuegbar: schluessel.verfuegbar,
  })

  const kopf = (
    <h2 id="push-titel" className={style.abschnittTitel}>
      Benachrichtigungen
    </h2>
  )

  if (schluessel.verfuegbar === false) {
    return (
      <section className={style.abschnitt} aria-labelledby="push-titel" data-testid="push-bereich">
        {kopf}
        <p className={style.satz} data-testid="push-nicht-eingerichtet">
          {GERAET_TEXT.server}
        </p>
      </section>
    )
  }
  if (schluessel.verfuegbar === undefined && schluessel.fehler) {
    return (
      <section className={style.abschnitt} aria-labelledby="push-titel" data-testid="push-bereich">
        {kopf}
        <Fehlerzustand fehler={schluessel.fehler} erneut={schluessel.erneut} data-testid="push-schluessel-fehler" />
      </section>
    )
  }

  async function geraetEinrichten(vapid: string) {
    entfernen.zuruecksetzen()
    await einrichten.einrichten(vapid)
    setFokusGeraet((n) => n + 1)
  }

  async function geraetEntfernen() {
    einrichten.zuruecksetzen()
    await entfernen.entfernen()
    setFokusGeraet((n) => n + 1)
  }

  async function umschalten(neu: boolean) {
    try {
      const antwort = await aendern.mutateAsync(neu)
      // Einmal beim Abschalten; verschwindet beim Wiedereinschalten und beim Verlassen der Seite (E28).
      setAbschaltHinweis(!antwort.pushErwuenscht)
    } catch {
      // Die Meldung zeigt `aendern.error`.
    }
  }

  const geraetFehler = einrichten.fehler ?? entfernen.fehler
  const satz = gesamtsatz(lage, status.data, istAdmin)
  const beschaeftigt = einrichten.laedt || entfernen.laedt
  // Der Gerätebereich erscheint nur mit Inhalt: Ladeanzeige, Knopf oder Fehler. In den Lagen ohne Bedienelement
  // (iPhone ohne Ablegen, blockiert, unsicher, kein Push im Browser) nennt die Gerätezeile oben schon den Grund; eine
  // Überschrift ohne etwas darunter entfällt (Rückmeldung des Entwicklers vom 25.10.2026).
  const geraetMitInhalt =
    lage === undefined ||
    lage === 'eingerichtet' ||
    (lage === 'nichtEingerichtet' && schluessel.vapid !== undefined) ||
    geraetFehler !== null

  return (
    <section className={style.abschnitt} aria-labelledby="push-titel" data-testid="push-bereich">
      {kopf}

      <ul className={style.zustand} data-testid="push-zustand">
        {!istAdmin && (
          <>
            <ZustandZeile
              ebene="Für alle"
              text={status.data ? anlageText(status.data.anlageAktiv) : 'wird gelesen …'}
              ok={status.data?.anlageAktiv}
              testId="push-zustand-anlage"
            />
            <ZustandZeile
              ebene="Für dich"
              text={status.data ? personText(status.data.pushErwuenscht) : 'wird gelesen …'}
              ok={status.data?.pushErwuenscht}
              testId="push-zustand-person"
            />
          </>
        )}
        <ZustandZeile
          ref={geraetZeile}
          ebene="Dieses Gerät"
          text={lage ? GERAET_TEXT[lage] : 'wird gelesen …'}
          ok={lage === undefined ? undefined : lage === 'eingerichtet'}
          testId="push-zustand-geraet"
        />
      </ul>

      {satz && (
        <p className={style.satz} data-testid="push-gesamtsatz">
          {satz}
        </p>
      )}

      {!istAdmin && status.error && !status.data && (
        <Fehlerzustand fehler={status.error} erneut={() => void status.refetch()} data-testid="push-status-fehler" />
      )}

      {istAdmin ? (
        <p className={style.klein} data-testid="push-admin-satz">
          {TEXT_ADMIN}
        </p>
      ) : (
        status.data && (
          <div className={style.schalterBlock}>
            <Schalter
              beschriftung="Benachrichtigungen für mich"
              an={status.data.pushErwuenscht}
              beiUmschalten={(neu) => void umschalten(neu)}
              beschaeftigt={aendern.isPending}
              erklaerung="Gilt für alle deine Geräte: Erinnerung, wenn du dich zu einem Termin noch nicht gemeldet hast, und Nachricht bei einer Absage."
              data-testid="push-schalter"
            />
            {abschaltHinweis && !status.data.pushErwuenscht && (
              <Hinweis data-testid="push-abschalt-hinweis">{TEXT_ABSCHALTEN}</Hinweis>
            )}
            {aendern.error && (
              <Fehlermeldung fehler={aendern.error} data-testid="push-schalter-fehler">
                {pushFehlertext(aendern.error, ERSATZ_SCHALTER)}
              </Fehlermeldung>
            )}
          </div>
        )
      )}

      {geraetMitInhalt && (
        <div className={style.geraet} data-testid="push-geraet">
          <h3 className={style.unterTitel}>Dieses Gerät</h3>
          {lage === undefined && <Ladespinner text="Gerät wird geprüft" />}
          {lage === 'nichtEingerichtet' && schluessel.vapid && (
            <>
              <p className={style.klein}>Gilt nur für dieses Gerät. Dein Browser fragt einmal, ob er Benachrichtigungen zeigen darf.</p>
              <CustomButton
                art="akzent"
                breit
                laedt={einrichten.laedt}
                // Synchron aus dem Klick: `einrichten` erfragt die Berechtigung als Erstes (E26).
                onClick={() => {
                  if (!beschaeftigt) void geraetEinrichten(schluessel.vapid!)
                }}
                data-testid="push-einrichten"
              >
                Auf diesem Gerät einrichten
              </CustomButton>
            </>
          )}
          {lage === 'eingerichtet' && (
            <>
              <p className={style.klein}>Gilt nur für dieses Gerät. Gibst du das Gerät weiter, entferne es vorher hier.</p>
              <CustomButton
                art="sekundaer"
                breit
                laedt={entfernen.laedt}
                onClick={() => {
                  if (!beschaeftigt) void geraetEntfernen()
                }}
                data-testid="push-entfernen"
              >
                Auf diesem Gerät entfernen
              </CustomButton>
            </>
          )}
          {geraetFehler && (
            <Fehlermeldung fehler={geraetFehler} data-testid="push-geraet-fehler">{pushFehlertext(geraetFehler, ERSATZ_GERAET)}</Fehlermeldung>
          )}
        </div>
      )}
    </section>
  )
}
