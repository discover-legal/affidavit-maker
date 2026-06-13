import type { MarketplaceTemplate } from '@discover-legal/sdk';
import TemplateCard from './TemplateCard';

/** Responsive grid of template cards with a graceful empty state. */
export default function TemplateGrid({
  templates,
  emptyMessage = 'No templates found.',
}: {
  templates: MarketplaceTemplate[];
  emptyMessage?: string;
}) {
  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} />
      ))}
    </div>
  );
}
