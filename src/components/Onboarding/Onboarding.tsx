import { useEffect, useId, useRef, useState } from 'react'
import { EINSTELLUNGEN_PFAD } from '@/app/schutz/zielpfad'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Icon from '@/components/Icon/Icon'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import Textlink from '@/components/Textlink/Textlink'
import { pushFehlertext } from '@/hooks/push/pushFehlertext'
import { usePushEinrichten } from '@/hooks/push/usePushEinrichten'
import { usePushGeraet } from '@/hooks/push/usePushGeraet'
import { usePushSchluessel } from '@/hooks/push/usePushSchluessel'
import { usePushStatus } from '@/hooks/push/usePushStatus'
import { useHinweisOffen } from '@/hooks/useHinweisOffen'
import { useInstallation } from '@/hooks/useInstallation'
import { useSitzung } from '@/hooks/useSitzung'
import { hinweisErledigt } from '@/pwa/hinweisSpeicher'
import { installieren } from '@/pwa/installation'
import { IOS_ANLEITUNG } from '@/pwa/pushLage'
import style from './Onboarding.module.scss'

/** Text des zweiten Schritts (7.2). */
export const TEXT_BENACHRICHTIGUNGEN =
  'Wir erinnern dich, wenn du dich zu einem Termin noch nicht gemeldet hast, und sagen Bescheid, wenn ein Termin ausfällt. Abschalten kannst du das jederzeit in den Einstellungen.'

/** Text des ersten Schritts mit Schaltfläche. */
export const TEXT_INSTALLATION =
  'Lege die App auf deinem Startbildschirm ab: Sie startet dann wie eine App, ohne Browserleiste. Nutzen kannst du sie auch ohne Installation.'

const ERSATZ = 'Das hat nicht geklappt. In den Einstellungen kannst du es erneut versuchen.'

/**
 * Onboarding-Karte oben auf der Startseite (C9, 7.2, E33, DESIGN.md Ansicht 21).
 *
 * **Zwei Schritte nacheinander, nur nach abgeschlossener Anmeldung** (die Karte steht auf `Dashboard` und
 * `AdminDashboard`, beide hinter `GeschuetzteRoute`), **nicht für GAST**:
 *
 * 1. **Installation** – nur wenn die App nicht als App läuft und ein Weg besteht (Knopf über `beforeinstallprompt`,
 *    auf iOS die Anleitung). Ein Browser ohne beides bekommt kein Angebot; die Einstellungen nennen dann das Menü.
 * 2. **Benachrichtigungen** – nur USER (der Admin bekommt keine Erinnerungen, P12), nur bei eingerichtetem Server,
 *    `anlageAktiv` **und** `pushErwuenscht`, und nur wenn das Gerät nicht eingerichtet ist und der Browser fragen darf.
 *
 * **Die lokalen Bedingungen zuerst** (Rolle, Vermerk, Gerät): Erst dann sind Schlüssel- und Statusabfrage aktiv – nach
 * dem Wegklicken kostet die Karte keinen Aufruf mehr. Jeder Schritt lässt sich wegklicken; erledigt oder weggeklickt
 * wird **je Gerät** vermerkt (`hinweisSpeicher`) und nicht wieder angeboten.
 *
 * **Kein Dialog und kein Fokusraub** beim Erscheinen: Die Karte blockiert nichts, die App bleibt ohne Installation voll
 * nutzbar. Nur wenn die Person einen Schritt beendet und der nächste erscheint, geht der Fokus auf dessen Überschrift
 * (die gedrückte Schaltfläche ist verschwunden).
 *
 * „Benachrichtigungen einrichten“ ruft `usePushEinrichten` **direkt im Klick** (E26: Berechtigung aus der Nutzergeste).
 */
export default function Onboarding() {
  const { laedt, angemeldet, istGast, istAdmin } = useSitzung()
  const weg = useInstallation()
  const installationOffen = useHinweisOffen('installation')
  const pushOffen = useHinweisOffen('benachrichtigungen')
  const einrichten = usePushEinrichten()
  const [erfolgt, setErfolgt] = useState(false)
  const titelId = useId()
  const titel = useRef<HTMLHeadingElement>(null)
  /** Nach dem Beenden von Schritt 1: Fokus auf die Überschrift, sobald Schritt 2 steht (er lädt erst noch). */
  const fokusWunsch = useRef(false)

  const aktiv = !laedt && angemeldet && !istGast
  const schritt1 = aktiv && installationOffen && (weg === 'knopf' || weg === 'ios')

  // Schritt 2: erst die lokalen Bedingungen, dann der Server.
  const lokalPruefen = aktiv && !istAdmin && pushOffen && !schritt1
  const geraet = usePushGeraet(lokalPruefen)
  const daten = geraet.data
  const lokalErfuellt =
    lokalPruefen &&
    daten !== undefined &&
    daten.umgebung.sicher &&
    daten.umgebung.pushMoeglich &&
    !(daten.umgebung.ios && !daten.umgebung.standalone) &&
    daten.stand.berechtigung !== 'denied' &&
    daten.stand.abo === null
  const schluessel = usePushSchluessel(lokalErfuellt)
  const status = usePushStatus(lokalErfuellt)
  const vapid = schluessel.vapid
  const schritt2 = lokalErfuellt && vapid !== undefined && status.data?.anlageAktiv === true && status.data.pushErwuenscht

  const fehler = einrichten.fehler
  const zeigeSchritt2 = !schritt1 && (schritt2 || erfolgt || fehler !== null)
  const sichtbar = schritt1 || zeigeSchritt2
  // Solange Gerät, Schlüssel oder Status noch gelesen werden, ist offen, ob Schritt 2 erscheint.
  const wartet = lokalPruefen && (geraet.isPending || (lokalErfuellt && (schluessel.laedt || status.isPending)))

  useEffect(() => {
    if (!fokusWunsch.current) return
    if (sichtbar) {
      titel.current?.focus()
      fokusWunsch.current = false
    } else if (!wartet) {
      // Kein zweiter Schritt: Der Wunsch verfällt, sonst raubte eine spätere Karte den Fokus.
      fokusWunsch.current = false
    }
  }, [sichtbar, wartet, schritt1, installationOffen])

  if (!sichtbar) return null

  /** Schritt 1 beenden; erscheint Schritt 2, geht der Fokus dorthin. */
  function installationBeenden() {
    fokusWunsch.current = true
    hinweisErledigt('installation')
  }

  async function installierenGeklickt() {
    // Der Wunsch gilt ab dem Klick: `installieren()` verwirft das Ereignis sofort, Schritt 1 endet also schon,
    // während der Dialog des Browsers noch offen ist.
    fokusWunsch.current = true
    await installieren()
    hinweisErledigt('installation')
  }

  async function einrichtenGeklickt(schluesselWert: string) {
    const ok = await einrichten.einrichten(schluesselWert)
    if (ok) {
      hinweisErledigt('benachrichtigungen')
      setErfolgt(true)
    }
  }

  function schliessen() {
    hinweisErledigt('benachrichtigungen')
    setErfolgt(false)
    einrichten.zuruecksetzen()
  }

  let symbol: string
  let ueberschrift: string
  let inhalt
  if (schritt1) {
    symbol = 'add_circle_icon_dark'
    ueberschrift = weg === 'ios' ? 'App auf den Home-Bildschirm' : 'App installieren'
    inhalt = (
      <>
        <p className={style.text}>{weg === 'ios' ? IOS_ANLEITUNG : TEXT_INSTALLATION}</p>
        <Knopfgruppe className={style.knoepfe}>
          {weg === 'knopf' ? (
            <>
              <CustomButton art="sekundaer" onClick={installationBeenden} data-testid="onboarding-spaeter">
                Später
              </CustomButton>
              <CustomButton art="akzent" onClick={() => void installierenGeklickt()} data-testid="onboarding-installieren">
                Installieren
              </CustomButton>
            </>
          ) : (
            <CustomButton art="sekundaer" onClick={installationBeenden} data-testid="onboarding-verstanden">
              Verstanden
            </CustomButton>
          )}
        </Knopfgruppe>
      </>
    )
  } else if (erfolgt) {
    symbol = 'check_circle_icon'
    ueberschrift = 'Benachrichtigungen eingerichtet'
    inhalt = (
      <>
        <p className={style.text} role="status" data-testid="onboarding-erfolg">
          Benachrichtigungen sind auf diesem Gerät eingerichtet. Abschalten kannst du das jederzeit in den{' '}
          <Textlink to={EINSTELLUNGEN_PFAD} data-testid="onboarding-einstellungen-link">
            Einstellungen
          </Textlink>
          .
        </p>
        <Knopfgruppe className={style.knoepfe}>
          <CustomButton art="sekundaer" onClick={schliessen} data-testid="onboarding-schliessen">
            Schließen
          </CustomButton>
        </Knopfgruppe>
      </>
    )
  } else {
    symbol = 'mail_icon_dark'
    ueberschrift = 'Benachrichtigungen'
    inhalt = (
      <>
        <p className={style.text}>{TEXT_BENACHRICHTIGUNGEN}</p>
        {fehler && (
          <Fehlermeldung fehler={fehler} data-testid="onboarding-fehler">
            {pushFehlertext(fehler, ERSATZ)}
          </Fehlermeldung>
        )}
        {/* Untereinander: „Benachrichtigungen einrichten“ ist zu lang für eine halbe Zeile bei 360 px. */}
        <Knopfgruppe untereinander={Boolean(schritt2 && vapid)} className={style.knoepfe}>
          {schritt2 && vapid ? (
            <>
              <CustomButton
                art="akzent"
                laedt={einrichten.laedt}
                // Synchron aus dem Klick (E26): `einrichten` erfragt die Berechtigung als Erstes.
                onClick={() => {
                  if (!einrichten.laedt) void einrichtenGeklickt(vapid)
                }}
                data-testid="onboarding-push-einrichten"
              >
                Benachrichtigungen einrichten
              </CustomButton>
              <CustomButton art="sekundaer" onClick={schliessen} data-testid="onboarding-nicht-jetzt">
                Nicht jetzt
              </CustomButton>
            </>
          ) : (
            <CustomButton art="sekundaer" onClick={schliessen} data-testid="onboarding-schliessen">
              Schließen
            </CustomButton>
          )}
        </Knopfgruppe>
      </>
    )
  }

  return (
    <section className={style.karte} role="region" aria-labelledby={titelId} data-testid="onboarding">
      <div className={style.kopf}>
        <span className={style.symbol}>
          <Icon name={symbol} />
        </span>
        <h2 id={titelId} ref={titel} tabIndex={-1} className={style.titel} data-testid="onboarding-titel">
          {ueberschrift}
        </h2>
      </div>
      {inhalt}
    </section>
  )
}
