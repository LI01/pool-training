import { t } from '../../i18n';
import { speak, type Script } from '../../platform/speech';

/** "Common mistakes" list with a button that talks through them. */
export function Pitfalls({ items, script }: { items: string[]; script: Script }) {
  return (
    <section class="pitfalls">
      <div class="pitfalls__head">
        <h3>{t('tips.title')}</h3>
        <button type="button" class="runner__speak-btn" onClick={() => speak(script)}>
          <span aria-hidden="true">💡</span> {t('tips.listen')}
        </button>
      </div>
      <ul>{items.map((p) => <li key={p}>{p}</li>)}</ul>
    </section>
  );
}
