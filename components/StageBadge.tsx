/**
 * The product-stage tag shown next to the brand mark everywhere.
 *
 * Server-safe and dependency-free so both SSG marketing pages and client
 * app shells can render it. Change STAGE in ONE place (here) when the
 * product graduates.
 */
const STAGE = 'Beta';

export default function StageBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 align-middle ${className}`}
      title={`discover.legal is in ${STAGE.toLowerCase()} — free while we polish it. Review every document before you sign or file.`}
    >
      {STAGE}
    </span>
  );
}
