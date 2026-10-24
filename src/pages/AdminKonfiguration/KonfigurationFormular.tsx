import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { Konfiguration, KonfigurationAnfrage } from '@/api/admin/adminKonfiguration'
import {
  ersterFehler,
  formAus,
  KONFIGURATION_FELDER,
  konfigurationAnfrage,
  konfigurationFehler,
  konfigurationGeaendert,
  leerlaufWarnung,
  type KonfigurationFeld,
  type KonfigurationForm,
  type ZahlFeld,
} from '@/api/admin/konfigurationEingabe'
import { REGELN, VERFAHREN } from '@/api/admin/konfigurationText'
import { ApiFehler } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import Auswahlliste from '@/components/Auswahlliste/Auswahlliste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Feld from '@/components/Feld/Feld'
import Schalter from '@/components/Schalter/Schalter'
import Hinweis from '@/components/Hinweis/Hinweis'
import Textbereich from '@/components/Textbereich/Textbereich'
import style from './AdminKonfiguration.module.scss'

const FEHLER_ERSATZ = 'Die Konfiguration konnte nicht gespeichert werden. Bitte versuche es erneut.'
const TEXT_VERALTET =
  'Die Konfiguration wurde zwischenzeitlich geändert. Der aktuelle Stand ist geladen, deine Eingaben wurden zurückgesetzt.'

/** Eigenschaften des Konfigurationsformulars. */
type KonfigurationFormularEigenschaften = {
  /** Der Stand, mit dem das Formular gebaut wird; `version` geht beim Speichern mit. */
  konfiguration: Konfiguration
  /** Die Mutation gehört dem Elternbaustein: Meldung und Fehler überleben den Neuaufbau (E5). */
  aendern: UseMutationResult<void, Error, KonfigurationAnfrage>
  /** Das Speichern ist gelungen: Der Elternbaustein merkt es sich für den Fokus nach dem Neuaufbau. */
  beiGespeichert: () => void
  /** `true`: Der Fokus gehört auf „Speichern“, weil das Formular nach dem Speichern neu aufgebaut wurde. */
  fokusAufSpeichern: boolean
  /** Der Fokus ist gesetzt; der Elternbaustein setzt sein Merkzeichen zurück. */
  beiFokussiert: () => void
}

/**
 * Das Formular der Konfiguration (C8 9.2): sechs Gruppen (`fieldset`/`legend`), unten die haftende `Aktionsleiste`.
 *
 * - **Text als Zustand** (`KonfigurationForm`): Die Umwandlung in den Körper geschieht in `konfigurationAnfrage`
 *   (**einzige Stelle**, genau die 15 Schlüssel).
 * - **Prüfung beim Verlassen eines Feldes und beim Senden**, nicht beim Tippen. Beim Senden gehen die Fehler an alle
 *   Felder, der Fokus auf das erste fehlerhafte; Fehler des Servers (`400` mit `felder`) stehen am genannten Feld.
 * - **Speichern erst nach einer Änderung** (`aria-disabled` mit Grund, der Fokus bleibt).
 * - **Die Warnung unter fünf Minuten Leerlauf sperrt nichts:** Der Wert ist gültig, aber der Ablauf-Dialog erschiene
 *   fast ununterbrochen.
 * - **E5:** Nach `409 DATEN_VERALTET` steht der frische Stand im Formular; nie wird mit neuer `version` und alten
 *   Eingaben gesendet. Der Text verschwindet mit der nächsten Eingabe, ebenso „Gespeichert.“.
 */
export default function KonfigurationFormular({
  konfiguration,
  aendern,
  beiGespeichert,
  fokusAufSpeichern,
  beiFokussiert,
}: KonfigurationFormularEigenschaften) {
  const [form, setForm] = useState<KonfigurationForm>(() => formAus(konfiguration))
  const [beruehrt, setBeruehrt] = useState<ReadonlySet<KonfigurationFeld>>(new Set())
  const [abgesendet, setAbgesendet] = useState(false)
  const felder = useRef<Partial<Record<KonfigurationFeld, HTMLElement | null>>>({})
  const speichernKnopf = useRef<HTMLButtonElement>(null)
  const grundId = useId()
  const warnungId = useId()

  useEffect(() => {
    if (!fokusAufSpeichern) return
    speichernKnopf.current?.focus()
    beiFokussiert()
  }, [fokusAufSpeichern, beiFokussiert])

  const fehlerClient = konfigurationFehler(form)
  const geaendert = konfigurationGeaendert(form, konfiguration)
  const grund = geaendert ? null : 'Es gibt keine Änderung.'

  const apiFehler = aendern.error instanceof ApiFehler ? aendern.error : null
  const veraltet = apiFehler?.code === 'DATEN_VERALTET'
  const serverFelder = apiFehler?.status === 400 ? (apiFehler.felder ?? {}) : {}
  const amFeld = KONFIGURATION_FELDER.some((feld) => serverFelder[feld])
  const kasten = aendern.isError && !veraltet && !amFeld
  const leerlaufKurz = leerlaufWarnung(form.sessionLeerlaufMinuten)

  /** Der Fehlertext eines Feldes: der des Servers, sonst der eigene, sobald das Feld berührt oder gesendet wurde. */
  function fehlerVon(feld: KonfigurationFeld): string | null {
    const server = serverFelder[feld]
    if (server) return server
    return abgesendet || beruehrt.has(feld) ? (fehlerClient[feld] ?? null) : null
  }

  function beruehren(feld: KonfigurationFeld) {
    setBeruehrt((alt) => (alt.has(feld) ? alt : new Set(alt).add(feld)))
  }

  /** Mit der nächsten Eingabe haben Fehler und Meldungen ihre Aufgabe erfüllt. */
  function eingabe<K extends keyof KonfigurationForm>(feld: K, wert: KonfigurationForm[K]) {
    if (!aendern.isIdle) aendern.reset()
    setForm((alt) => ({ ...alt, [feld]: wert }))
  }

  /** Merkt das Element eines Feldes, damit der Fokus nach einem Fehler dorthin gehen kann. */
  function refVon<E extends HTMLElement>(feld: KonfigurationFeld) {
    return (element: E | null) => {
      felder.current[feld] = element
    }
  }

  /** Eigenschaften, die jedes Textfeld teilt. */
  function gemeinsam(feld: KonfigurationFeld) {
    return {
      fehler: fehlerVon(feld),
      onBlur: () => {
        beruehren(feld)
      },
      readOnly: aendern.isPending,
      autoComplete: 'off',
      'data-testid': `admin-konfig-${feld}`,
    }
  }

  /** Ein Zahlenfeld: Text mit Zifferntastatur (kein `type="number"`: Mausrad, `e` und Vorzeichen stören). */
  function zahlFeld(feld: ZahlFeld, beschriftung: string, hinweis: string, beschriebenDurch?: string) {
    return (
      <Feld
        {...gemeinsam(feld)}
        ref={refVon<HTMLInputElement>(feld)}
        beschriftung={beschriftung}
        hinweis={hinweis}
        beschriebenDurch={beschriebenDurch}
        inputMode="numeric"
        value={form[feld]}
        onChange={(e) => {
          eingabe(feld, e.target.value)
        }}
      />
    )
  }

  /** Sendet das Voll-Update; `mutateAsync`, weil sich das Formular mit dem Erfolg selbst ersetzt (neuer `key`). */
  async function speichern(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!geaendert || aendern.isPending) return
    setAbgesendet(true)
    const erster = ersterFehler(fehlerClient)
    if (erster !== null) {
      felder.current[erster]?.focus()
      return
    }
    try {
      await aendern.mutateAsync(konfigurationAnfrage(form, konfiguration.version))
      beiGespeichert()
    } catch (fehler) {
      if (fehler instanceof ApiFehler && fehler.status === 400) {
        const betroffen = KONFIGURATION_FELDER.find((feld) => fehler.felder?.[feld])
        if (betroffen) felder.current[betroffen]?.focus()
      }
    }
  }

  return (
    <form className={style.seite} onSubmit={(e) => void speichern(e)} noValidate data-testid="admin-konfiguration">
      <div className={style.bereich}>
        <h1 className={style.titel}>Konfiguration</h1>
        {veraltet && <Hinweis data-testid="admin-konfig-veraltet">{TEXT_VERALTET}</Hinweis>}

        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Teilnehmer</legend>
          {zahlFeld('minTeilnehmer', 'Mindestzahl', 'Darunter kommt ein Termin nicht zustande (Balken rot).')}
          {zahlFeld('maxTeilnehmer', 'Höchstzahl', 'Darüber greift die Warteschlange.')}
        </fieldset>

        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Gäste</legend>
          {zahlFeld('anzGuests', 'Gleichzeitige Gäste', 'Gleichzeitig angemeldete Gäste. Eine Senkung meldet niemanden ab.')}
        </fieldset>

        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Team-Generator</legend>
          <Auswahlliste
            beschriftung="Typ"
            optionen={VERFAHREN}
            wert={form.algorithmType}
            beiAenderung={(wert) => {
              eingabe('algorithmType', wert as KonfigurationForm['algorithmType'])
            }}
            hinweis="„Standard“ findet das globale Optimum; „Schnell“ liegt nahe am Optimum und eignet sich für größere Teams (ab 25 Teilnehmern)."
            deaktiviert={aendern.isPending}
            data-testid="admin-konfig-algorithmType"
          />
          {zahlFeld(
            'anzTeamGenerator',
            'Anzahl der Versuche pro Person und Spieltag zur Team-Generierung',
            'Ändert sich der Teilnehmerkreis, steht das Kontingent wieder zur Verfügung.',
          )}
          <Auswahlliste
            beschriftung="Modus zum Auswechselspieler"
            optionen={REGELN}
            wert={form.auswechselModus}
            beiAenderung={(wert) => {
              eingabe('auswechselModus', wert as KonfigurationForm['auswechselModus'])
            }}
            hinweis="Wer bei ungerader Zahl aussetzt: der Schwächste oder der zuletzt angemeldete Spieler des größeren Teams."
            deaktiviert={aendern.isPending}
            data-testid="admin-konfig-auswechselModus"
          />
        </fieldset>

        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Sitzung</legend>
          {zahlFeld(
            'sessionLeerlaufMinuten',
            'Dauer einer Sitzung in Minuten',
            'Wirkt sofort, auch für bestehende Sitzungen.',
            leerlaufKurz ? warnungId : undefined,
          )}
          {leerlaufKurz && (
            <div id={warnungId}>
              <Hinweis data-testid="admin-konfig-leerlauf-warnung">Der Ablauf-Dialog erscheint dann fast ununterbrochen.</Hinweis>
            </div>
          )}
          {zahlFeld(
            'sessionMaximalStunden',
            'Höchstdauer in Stunden',
            'Gilt nur für neue Sitzungen; bestehende behalten ihre Obergrenze.',
          )}
        </fieldset>

        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Halle</legend>
          {/* Schalter statt Kästchen (24.10.2026, wie „Aktiv in der Auswahlliste“); wirksam erst mit „Speichern“. */}
          <Schalter
            beschriftung="Hallenmodus"
            an={form.hallenModusAktiv}
            beiUmschalten={(an) => {
              eingabe('hallenModusAktiv', an)
            }}
            erklaerung="Bei aktiviertem Hallenmodus kann der Termin per E-Mail abgesagt werden."
            beschaeftigt={aendern.isPending}
            ref={refVon<HTMLButtonElement>('hallenModusAktiv')}
            data-testid="admin-konfig-hallenModusAktiv"
          />
          <Feld
            {...gemeinsam('halleEmail')}
            ref={refVon<HTMLInputElement>('halleEmail')}
            beschriftung="E-Mail des Hallenbetreibers"
            hinweis="Muss eine gültige E-Mail-Adresse sein, sonst kann der Termin nicht per E-Mail abgesagt werden."
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={form.halleEmail}
            onChange={(e) => {
              eingabe('halleEmail', e.target.value)
            }}
          />
          {zahlFeld(
            'halleVorlaufStunden',
            'Vorlauf in Stunden',
            'Nach Ablauf der eingestellten Frist ist eine Terminabsage per E-Mail nicht mehr möglich.',
          )}
          <Textbereich
            beschriftung="Text zur Terminabsage per E-Mail"
            hinweis="Leer lassen für den Standardtext."
            value={form.halleAbsageVorlage}
            onChange={(e) => {
              eingabe('halleAbsageVorlage', e.target.value)
            }}
            readOnly={aendern.isPending}
            ref={refVon<HTMLTextAreaElement>('halleAbsageVorlage')}
            data-testid="admin-konfig-halleAbsageVorlage"
          />
        </fieldset>

        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Benachrichtigungen</legend>
          <Schalter
            beschriftung="Push-Benachrichtigungen"
            an={form.pushAktiv}
            beiUmschalten={(an) => {
              eingabe('pushAktiv', an)
            }}
            erklaerung="Erinnerung an offene Rückmeldungen und Terminabsage. Jede Person kann für sich abschalten."
            beschaeftigt={aendern.isPending}
            ref={refVon<HTMLButtonElement>('pushAktiv')}
            data-testid="admin-konfig-pushAktiv"
          />
          {zahlFeld('pushErinnerungStunden', 'Termin-Erinnerung in Stunden', 'So viele Stunden vor dem Termin wird erinnert.')}
        </fieldset>

        {aendern.isSuccess && <Hinweis data-testid="admin-konfig-gespeichert">Gespeichert.</Hinweis>}
      </div>

      <Aktionsleiste>
        <div className={style.aktionen}>
          {kasten && <Fehlermeldung fehler={aendern.error} ersatz={FEHLER_ERSATZ} data-testid="admin-konfig-fehler" />}
          {grund !== null && (
            <p id={grundId} className={style.nebentext} data-testid="admin-konfig-grund">
              {grund}
            </p>
          )}
          <CustomButton
            ref={speichernKnopf}
            type="submit"
            art="primaer"
            breit
            className={style.aktion}
            laedt={aendern.isPending}
            aria-disabled={grund !== null ? true : undefined}
            aria-describedby={grund !== null ? grundId : undefined}
            data-testid="admin-konfig-speichern"
          >
            Speichern
          </CustomButton>
        </div>
      </Aktionsleiste>
    </form>
  )
}
