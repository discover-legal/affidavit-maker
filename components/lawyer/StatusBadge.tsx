import type { TemplateStatus } from '@discover-legal/sdk';

const STYLES: Record<TemplateStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  pending_review: { label: 'In review', cls: 'bg-amber-100 text-amber-700' },
  published: { label: 'Published', cls: 'bg-emerald-100 text-emerald-700' },
  suspended: { label: 'Suspended', cls: 'bg-red-100 text-red-700' },
  archived: { label: 'Archived', cls: 'bg-gray-100 text-gray-500' },
  deleted: { label: 'Deleted', cls: 'bg-red-50 text-red-400' },
};

export default function StatusBadge({ status }: { status: TemplateStatus }) {
  const s = STYLES[status] ?? STYLES.draft;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}
