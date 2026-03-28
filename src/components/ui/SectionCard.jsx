export default function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-2xl font-bold text-zinc-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
