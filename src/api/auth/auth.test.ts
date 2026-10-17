import { HttpResponse, http } from 'msw'
import { describe, expect, test, vi } from 'vitest'
import {
  adminAnmelden,
  alsGastAnmelden,
  nameWaehlen,
  namenslisteLesen,
  passwortBestaetigen,
  passwortZuruecksetzen,
  pinPruefen,
  sitzungBeenden,
  sitzungErneuern,
  sitzungFristLesen,
  sitzungLesen,
} from '@/api/auth/auth'
import { ApiFehler } from '@/api/common/fehler'
import { sitzungsendeBehandeln } from '@/app/queryClient'
import { beispielNamensliste, problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'

/** Fängt den Fehler eines Aufrufs ab, damit ein Test seine Felder prüfen kann. */
async function fehlerVon(aufruf: Promise<unknown>): Promise<ApiFehler> {
  const fehler = await aufruf.catch((e: unknown) => e)
  if (!(fehler instanceof ApiFehler)) throw new Error('ApiFehler erwartet')
  return fehler
}

describe('pinPruefen', () => {
  test('loest bei 204 ohne Rueckgabewert auf', async () => {
    await expect(pinPruefen('0000')).resolves.toBeUndefined()
  })

  test('sendet die PIN unveraendert als Rumpf laut Kontrakt', async () => {
    let rumpf: unknown
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/auth/pin/pruefen', async ({ request }) => {
        rumpf = await request.json()
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    // Fuehrende Null und Leerzeichen bleiben erhalten: Das Format prueft der Server.
    await pinPruefen(' 0123 ')

    expect(rumpf).toEqual({ pin: ' 0123 ' })
    // Eine Anmeldung ist eine Nutzeraktion und kein Hintergrundabruf.
    expect(kopf).toBeNull()
  })

  test('wirft bei falscher PIN einen ApiFehler mit Code und Servertext', async () => {
    mockServer.use(
      http.post('*/auth/pin/pruefen', () =>
        problem(401, 'PIN_FALSCH', 'Die PIN ist nicht korrekt.'),
      ),
    )

    const fehler = await fehlerVon(pinPruefen('9999'))

    expect(fehler.status).toBe(401)
    expect(fehler.code).toBe('PIN_FALSCH')
    expect(fehler.message).toBe('Die PIN ist nicht korrekt.')
  })

  test('reicht bei Sperre die Restwartezeit aus dem Rumpf durch', async () => {
    mockServer.use(
      http.post('*/auth/pin/pruefen', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'PIN_GESPERRT',
            detail: 'Zu viele Fehlversuche. Bitte in 58 Sekunden erneut versuchen.',
            wartesekunden: 58,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const fehler = await fehlerVon(pinPruefen('9999'))

    expect(fehler.code).toBe('PIN_GESPERRT')
    expect(fehler.wartesekunden).toBe(58)
  })
})

describe('sitzungLesen', () => {
  test('liefert die Sitzung des angemeldeten Besuchers', async () => {
    const sitzung = await sitzungLesen()
    expect(sitzung?.stage).toBe('PROFILE_AUTHENTICATED')
    expect(sitzung?.rolle).toBe('USER')
  })

  test('liefert bei 401 null, statt zu werfen', async () => {
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    // „Keine Sitzung" ist der Normalzustand eines nicht angemeldeten
    // Besuchers und kein Fehlerfall.
    await expect(sitzungLesen()).resolves.toBeNull()
  })

  test('loest bei 401 keine globale Abmeldung aus', async () => {
    // Sonst liefe der Startaufruf jedes nicht angemeldeten Besuchers in die
    // Umleitung auf /anmelden – wo derselbe Aufruf wieder stattfindet.
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)

    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    await sitzungLesen()
    expect(abmelden).not.toHaveBeenCalled()

    sitzungsendeBehandeln(() => {})
  })

  test('wirft bei jedem anderen Fehler weiter', async () => {
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.'),
      ),
    )

    await expect(sitzungLesen()).rejects.toThrow('Unerwarteter Fehler.')
  })

  test('setzt den Kopf fuer Hintergrundabrufe nur auf Verlangen', async () => {
    const koepfe: (string | null)[] = []
    mockServer.use(
      http.get('*/auth/session/lesen', ({ request }) => {
        koepfe.push(request.headers.get('X-FuBo-Kein-Refresh'))
        return HttpResponse.json({ stage: 'PROFILE_AUTHENTICATED' })
      }),
    )

    await sitzungLesen()
    await sitzungLesen(true)

    expect(koepfe).toEqual([null, 'true'])
  })
})

describe('sitzungFristLesen', () => {
  test('liest die Sitzung als Hintergrundaufruf mit dem Kopf gegen die Verlaengerung', async () => {
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.get('*/auth/session/lesen', ({ request }) => {
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return HttpResponse.json({ stage: 'PROFILE_AUTHENTICATED' })
      }),
    )

    await sitzungFristLesen()

    // Ohne den Kopf hielte allein die Anzeige der Restlaufzeit die Sitzung am
    // Leben, und der Ablauf-Dialog kaeme nie.
    expect(kopf).toBe('true')
  })

  test('wirft bei 401, statt null zu liefern', async () => {
    // Anders als `sitzungLesen`: Wer die Restlaufzeit beobachtet, hatte eine
    // Sitzung. Ist sie weg, gehoert der Fehler in die globale Behandlung.
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    const fehler = await fehlerVon(sitzungFristLesen())

    expect(fehler.status).toBe(401)
    expect(fehler.code).toBe('SESSION_UNGUELTIG')
  })

  test('meldet bei 401 selbst nicht ab, das tut erst der Query-Cache', async () => {
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    // Die Behandlung haengt am Query-Cache und greift erst, wenn eine Abfrage
    // den Fehler wirft (Test in `useRestlaufzeit.test`).
    await sitzungFristLesen().catch(() => {})
    expect(abmelden).not.toHaveBeenCalled()

    sitzungsendeBehandeln(() => {})
  })
})

describe('sitzungErneuern', () => {
  test('loest bei 204 ohne Rueckgabewert auf und traegt keinen Hintergrundkopf', async () => {
    let methode = ''
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/auth/session/erneuern', ({ request }) => {
        methode = request.method
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(sitzungErneuern()).resolves.toBeUndefined()

    expect(methode).toBe('POST')
    // Der Kopf wuerde genau das verhindern, worum es hier geht.
    expect(kopf).toBeNull()
  })

  test('wirft bei abgelaufener Sitzung einen ApiFehler mit Code', async () => {
    mockServer.use(
      http.post('*/auth/session/erneuern', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    const fehler = await fehlerVon(sitzungErneuern())

    expect(fehler.code).toBe('SESSION_UNGUELTIG')
  })
})

describe('sitzungBeenden', () => {
  test('loest bei 204 ohne Rueckgabewert auf', async () => {
    let methode = ''
    mockServer.use(
      http.post('*/auth/session/beenden', ({ request }) => {
        methode = request.method
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(sitzungBeenden()).resolves.toBeUndefined()

    expect(methode).toBe('POST')
  })

  test('wirft bei bereits beendeter Sitzung einen ApiFehler mit Code', async () => {
    mockServer.use(
      http.post('*/auth/session/beenden', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    const fehler = await fehlerVon(sitzungBeenden())

    expect(fehler.code).toBe('SESSION_UNGUELTIG')
  })
})

describe('namenslisteLesen', () => {
  test('liefert die Liste des Servers unveraendert', async () => {
    await expect(namenslisteLesen()).resolves.toEqual(beispielNamensliste)
  })

  test('setzt den Kopf fuer Hintergrundabrufe nur auf Verlangen', async () => {
    const koepfe: (string | null)[] = []
    mockServer.use(
      http.get('*/auth/users/lesen', ({ request }) => {
        koepfe.push(request.headers.get('X-FuBo-Kein-Refresh'))
        return HttpResponse.json([])
      }),
    )

    await namenslisteLesen()
    await namenslisteLesen(true)

    // Das Polling darf das gleitende Sitzungsfenster nicht verlaengern.
    expect(koepfe).toEqual([null, 'true'])
  })
})

describe('nameWaehlen', () => {
  test('sendet die Id, nicht den Namen', async () => {
    let rumpf: unknown
    mockServer.use(
      http.post('*/auth/user/waehlen', async ({ request }) => {
        rumpf = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await nameWaehlen(13)

    expect(rumpf).toEqual({ spielerId: 13 })
  })

  test('wirft bei belegtem Namen einen ApiFehler mit Code', async () => {
    mockServer.use(
      http.post('*/auth/user/waehlen', () =>
        problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits angemeldet.'),
      ),
    )

    const fehler = await fehlerVon(nameWaehlen(12))

    expect(fehler.code).toBe('NAME_BELEGT')
    expect(fehler.message).toBe('Dieser Name ist bereits angemeldet.')
  })
})

describe('alsGastAnmelden', () => {
  test('sendet Name und Stufe ohne den Zusatz „(Gast)"', async () => {
    let rumpf: unknown
    mockServer.use(
      http.post('*/auth/gast/anmelden', async ({ request }) => {
        rumpf = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await alsGastAnmelden('Testgast', 'STARK')

    expect(rumpf).toEqual({ gastName: 'Testgast', stufe: 'STARK' })
  })

  test('sendet ohne Stufe ausdruecklich null', async () => {
    let rumpf: unknown
    mockServer.use(
      http.post('*/auth/gast/anmelden', async ({ request }) => {
        rumpf = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await alsGastAnmelden('Testgast')

    // Laut Kontrakt gilt dann serverseitig MITTEL.
    expect(rumpf).toEqual({ gastName: 'Testgast', stufe: null })
  })

  test('wirft bei vollen Gastplaetzen einen ApiFehler mit Code', async () => {
    mockServer.use(
      http.post('*/auth/gast/anmelden', () =>
        problem(409, 'KEIN_GAST_SLOT_FREI', 'Es sind bereits alle Gastplätze belegt.'),
      ),
    )

    const fehler = await fehlerVon(alsGastAnmelden('Testgast'))

    expect(fehler.code).toBe('KEIN_GAST_SLOT_FREI')
  })
})

describe('adminAnmelden', () => {
  test('sendet Name und Passwort unveraendert und ohne Hintergrundkopf', async () => {
    let rumpf: unknown
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/auth/admin/anmelden', async ({ request }) => {
        rumpf = await request.json()
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    // Kein trim(): Der Server entfernt Randleerzeichen des Namens selbst, und ein
    // Passwort darf Leerzeichen enthalten.
    await expect(
      adminAnmelden({ anmeldename: ' admin ', passwort: ' beispiel-passwort-01 ' }),
    ).resolves.toBeUndefined()

    expect(rumpf).toEqual({ anmeldename: ' admin ', passwort: ' beispiel-passwort-01 ' })
    expect(kopf).toBeNull()
  })

  test('wirft bei falschen Zugangsdaten einen ApiFehler, der kein Sitzungsende ist', async () => {
    mockServer.use(
      http.post('*/auth/admin/anmelden', () =>
        problem(401, 'ADMIN_PASSWORT_FALSCH', 'Anmeldename oder Passwort sind nicht korrekt.'),
      ),
    )

    const fehler = await fehlerVon(adminAnmelden({ anmeldename: 'admin', passwort: 'falsch' }))

    expect(fehler.status).toBe(401)
    expect(fehler.code).toBe('ADMIN_PASSWORT_FALSCH')
  })

  test('liefert bei 429 die Wartezeit', async () => {
    mockServer.use(
      http.post('*/auth/admin/anmelden', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'PIN_GESPERRT',
            detail: 'Zu viele Fehlversuche. Bitte in 42 Sekunden erneut versuchen.',
            wartesekunden: 42,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const fehler = await fehlerVon(adminAnmelden({ anmeldename: 'admin', passwort: 'falsch' }))

    // Derselbe Zaehler wie an der PIN, deshalb derselbe Code.
    expect(fehler.code).toBe('PIN_GESPERRT')
    expect(fehler.wartesekunden).toBe(42)
  })

  test('liefert bei 400 die Meldungen je Feld', async () => {
    mockServer.use(
      http.post('*/auth/admin/anmelden', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 400,
            code: 'EINGABE_UNGUELTIG',
            detail: 'Ungültige Eingabedaten.',
            felder: { anmeldename: 'Der Anmeldename darf nicht leer sein.' },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const fehler = await fehlerVon(adminAnmelden({ anmeldename: '', passwort: 'x' }))

    expect(fehler.felder).toEqual({ anmeldename: 'Der Anmeldename darf nicht leer sein.' })
  })
})

describe('passwortZuruecksetzen', () => {
  test('sendet weder Rumpf noch Inhaltstyp und loest bei 204 ohne Wert auf', async () => {
    let methode = ''
    let inhaltstyp: string | null = 'nicht gelesen'
    let text = 'nicht gelesen'
    mockServer.use(
      http.post('*/auth/passwort/zuruecksetzen', async ({ request }) => {
        methode = request.method
        inhaltstyp = request.headers.get('Content-Type')
        text = await request.text()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(passwortZuruecksetzen()).resolves.toBeUndefined()

    // Laut Kontrakt gibt es keinen Anfragekoerper: genau ein Admin, genau eine Adresse.
    expect(methode).toBe('POST')
    expect(inhaltstyp).toBeNull()
    expect(text).toBe('')
  })

  test('sendet keinen Hintergrundkopf', async () => {
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/auth/passwort/zuruecksetzen', ({ request }) => {
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await passwortZuruecksetzen()

    expect(kopf).toBeNull()
  })

  test('meldet die Drosselung mit Wartezeit', async () => {
    mockServer.use(
      http.post('*/auth/passwort/zuruecksetzen', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'RESET_GEDROSSELT',
            detail: 'Zu viele Anforderungen. Bitte in 1837 Sekunden erneut versuchen.',
            wartesekunden: 1837,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const fehler = await fehlerVon(passwortZuruecksetzen())

    expect(fehler.code).toBe('RESET_GEDROSSELT')
    expect(fehler.wartesekunden).toBe(1837)
  })

  test('meldet einen fehlgeschlagenen Versand als wiederholbaren Fehler', async () => {
    mockServer.use(
      http.post('*/auth/passwort/zuruecksetzen', () =>
        problem(503, 'VERSAND_FEHLGESCHLAGEN', 'Die E-Mail konnte nicht versendet werden.'),
      ),
    )

    const fehler = await fehlerVon(passwortZuruecksetzen())

    expect(fehler.status).toBe(503)
    expect(fehler.code).toBe('VERSAND_FEHLGESCHLAGEN')
  })
})

describe('passwortBestaetigen', () => {
  test('sendet PIN (mit fuehrender Null) und neues Passwort in einem Aufruf', async () => {
    let rumpf: unknown
    mockServer.use(
      http.post('*/auth/passwort/bestaetigen', async ({ request }) => {
        rumpf = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(
      passwortBestaetigen({ bestaetigungsPin: '04713', neuesPasswort: 'beispiel-passwort-02' }),
    ).resolves.toBeUndefined()

    // Die PIN bleibt eine Zeichenkette: Ein Zahlentyp verlore die fuehrende Null.
    expect(rumpf).toEqual({ bestaetigungsPin: '04713', neuesPasswort: 'beispiel-passwort-02' })
  })

  test('unterscheidet falsche PIN (nochmal versuchen) und ungueltigen Vorgang (neu anfordern)', async () => {
    mockServer.use(
      http.post('*/auth/passwort/bestaetigen', () =>
        problem(401, 'RESET_PIN_FALSCH', 'Die Bestätigungs-PIN ist nicht korrekt.'),
      ),
    )
    const falsch = await fehlerVon(
      passwortBestaetigen({ bestaetigungsPin: '11111', neuesPasswort: 'beispiel-passwort-02' }),
    )
    expect(falsch.status).toBe(401)
    expect(falsch.code).toBe('RESET_PIN_FALSCH')

    mockServer.use(
      http.post('*/auth/passwort/bestaetigen', () =>
        problem(409, 'RESET_UNGUELTIG', 'Es liegt keine gültige Anforderung vor. Bitte neu anfordern.'),
      ),
    )
    const ungueltig = await fehlerVon(
      passwortBestaetigen({ bestaetigungsPin: '11111', neuesPasswort: 'beispiel-passwort-02' }),
    )
    // Der Status ist der Unterschied, den der Kontrakt ausdruecklich vorsieht.
    expect(ungueltig.status).toBe(409)
    expect(ungueltig.code).toBe('RESET_UNGUELTIG')
  })
})
