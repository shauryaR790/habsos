import { useTitle } from '../../../lib/useTitle';

export function BackendPlaceholderPage({ title }: { title: string }) {
  useTitle(title);
  return (
    <div className="o-be-placeholder">
      <p>{title} is not available yet</p>
    </div>
  );
}
