import { API_BASE_PATH } from '@bolha/contracts';
import { UI_COMPONENTS_PACKAGE } from '@bolha/ui-components';
import { SITE_NAME } from '../lib/site';

/** Página inicial provisória do walking skeleton; o canvas PixiJS entra nas histórias do canvas. */
export default function HomePage() {
  return (
    <main>
      <h1>{SITE_NAME}</h1>
      <p>Esqueleto do monorepo em funcionamento.</p>
      <ul>
        <li>API: {API_BASE_PATH}</li>
        <li>Design system: {UI_COMPONENTS_PACKAGE}</li>
      </ul>
    </main>
  );
}
