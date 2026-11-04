import { useTitle } from '../../../lib/useTitle';

export function BackendPlaceholderPage({ title }: { title: string }) {
  useTitle(title);
  return (
    <div className="o-be-placeholder">
      <h2>{title}</h2>
      <p>This section is ready for the next build pass.</p>
    </div>
  );
}
