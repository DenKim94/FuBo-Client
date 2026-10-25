import { useState } from 'react'
import CustomButton from '@/components/CustomButton/CustomButton'
import { useInstallation } from '@/hooks/useInstallation'
import { hinweisErledigt } from '@/pwa/hinweisSpeicher'
import { installieren } from '@/pwa/installation'
import { IOS_ANLEITUNG } from '@/pwa/pushLage'
import style from './Einstellungen.module.scss'

/** Satz für Browser ohne eigenes Angebot (E32). */
export const TEXT_MENUE = 'Über das Menü des Browsers kannst du die App installieren.'

/**
 * Abschnitt „App installieren“ der Einstellungen (C9, 7.3, E32).
 *
 * Nur wenn die App nicht schon als App läuft. **Unabhängig vom Vermerk des Onboardings:** Hier ist das Angebot immer
 * erreichbar. Je nach Weg ein Knopf (`beforeinstallprompt` zurückgehalten), die iOS-Anleitung oder ein Satz zum Menü
 * des Browsers – nie ein toter Knopf.
 */
export default function InstallationBereich() {
  const weg = useInstallation()
  const [abgelehnt, setAbgelehnt] = useState(false)
  if (weg === null) return null

  async function installierenGeklickt() {
    const ergebnis = await installieren()
    if (ergebnis === 'angenommen') hinweisErledigt('installation')
    setAbgelehnt(ergebnis !== 'angenommen')
  }

  return (
    <section className={style.abschnitt} aria-labelledby="installation-titel" data-testid="installation-bereich">
      <h2 id="installation-titel" className={style.abschnittTitel}>
        App installieren
      </h2>
      {weg === 'knopf' && (
        <>
          <p className={style.satz}>Lege die App auf deinem Startbildschirm ab. Nutzen kannst du sie auch ohne Installation.</p>
          <CustomButton art="akzent" breit onClick={() => void installierenGeklickt()} data-testid="installation-knopf">
            Installieren
          </CustomButton>
        </>
      )}
      {weg === 'ios' && (
        <p className={style.satz} data-testid="installation-ios">
          {IOS_ANLEITUNG}
        </p>
      )}
      {weg === 'menue' && (
        <p className={style.satz} data-testid="installation-menue">
          {abgelehnt ? `Nicht installiert. ${TEXT_MENUE}` : TEXT_MENUE}
        </p>
      )}
    </section>
  )
}
