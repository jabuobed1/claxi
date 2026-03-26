export default function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg font-bold text-white">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
