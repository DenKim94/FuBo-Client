/**
 * Die Ladeanzeige aus `index.html` als Komponente: derselbe Kreis an derselben Stelle.
 *
 * Gebraucht, solange der Router beim Start ein nachgeladenes Paket abwartet (Direktaufruf einer Admin-Adresse,
 * `hydrateFallbackElement` in `routen.tsx`). React leert `#root` beim ersten Rendern; stünde hier etwas anderes,
 * wechselte das Bild vom Kreis aus `index.html` kurz zu einer leeren oder anderen Fläche und zurück.
 *
 * Kein eigenes Stylesheet: Die Klassen `startLader` und `startLaderKreis` stehen global (`global.scss`), weil
 * `index.html` sie schon vor dem ersten Skript braucht.
 */
export default function StartLader() {
  return (
    <div className="startLader" role="status" data-testid="start-lader">
      <span className="startLaderKreis" />
      <span className="nurFuerScreenreader">Wird geladen</span>
    </div>
  )
}
