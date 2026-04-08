export default function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="rounded-[28px] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] backdrop-blur md:p-6">
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-xl font-black tracking-tight text-zinc-900 md:text-2xl">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
