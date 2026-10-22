/**
 * Alle Ansichten, die nur ein Admin sieht, als **ein** nachgeladenes Paket (Lazy Routes in `routen.tsx`).
 *
 * **Warum ein gemeinsames Paket und nicht eines je Seite:** Wer den Admin-Bereich betritt, wechselt darin zwischen
 * vielen Ansichten (Dashboard, Profile, Termine). Ein Paket je Seite hiesse bei jedem Wechsel ein weiterer Abruf
 * mit kurzem Warten; ein gemeinsames Paket wird einmal geladen, danach ist jeder Wechsel sofort da. Für alle
 * anderen entfällt der ganze Bereich beim Start (gemessen: 47 von rund 240 Modulen im Dev-Modus).
 *
 * Gemeinsam genutzte Bausteine (`CustomButton`, `Dialog` …) stehen nicht hier: Der Bundler legt sie in das
 * Hauptpaket oder ein eigenes gemeinsames Paket. Hier stehen nur die Seiten.
 *
 * Die Admin-Anmeldung (`/admin/anmelden` und die Passwortschritte) gehört dazu: Sie ist der Eingang in den Bereich,
 * und wer sie öffnet, braucht den Rest gleich danach.
 */
export { default as AdminAnmeldung } from '@/pages/AdminAnmeldung/AdminAnmeldung'
export { default as AdminDashboard } from '@/pages/AdminDashboard/AdminDashboard'
export { default as AdminGaeste } from '@/pages/AdminGaeste/AdminGaeste'
export { default as AdminKonfiguration } from '@/pages/AdminKonfiguration/AdminKonfiguration'
export { default as AdminNameAendern } from '@/pages/AdminNameAendern/AdminNameAendern'
export { default as AdminNameBestaetigen } from '@/pages/AdminNameBestaetigen/AdminNameBestaetigen'
export { default as AdminPin } from '@/pages/AdminPin/AdminPin'
export { default as AdminProfilDetail } from '@/pages/AdminProfilDetail/AdminProfilDetail'
export { default as AdminProfile } from '@/pages/AdminProfile/AdminProfile'
export { default as AdminProfilFormular } from '@/pages/AdminProfilFormular/AdminProfilFormular'
export { default as AdminTeams } from '@/pages/AdminTeams/AdminTeams'
export { default as AdminTermine } from '@/pages/AdminTermine/AdminTermine'
export { default as AdminTerminDetail } from '@/pages/AdminTerminDetail/AdminTerminDetail'
export { default as AdminTerminNeu } from '@/pages/AdminTerminNeu/AdminTerminNeu'
export { default as PasswortAendern } from '@/pages/PasswortAendern/PasswortAendern'
export { default as PasswortNeu } from '@/pages/PasswortNeu/PasswortNeu'
export { default as PasswortVergessen } from '@/pages/PasswortVergessen/PasswortVergessen'
