import { DiagramCard } from '../../diagram/TableDiagram';
import { DIAGRAMS } from '../../diagram/diagrams';
import { t } from '../../i18n';

/** Every setup diagram on one page, for checking them against the real table. Routed at #/diagrams. */
export function DiagramsReview() {
  return (
    <main class="screen diagrams-review">
      <h1>{t('diagram.all')}</h1>
      {Object.values(DIAGRAMS).map((d) => (
        <section key={d.id} class="diagrams-review__item">
          <DiagramCard diagramId={d.id} />
          <code>{d.id}</code>
        </section>
      ))}
    </main>
  );
}
