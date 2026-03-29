export default function StatCard({ title, value, icon: Icon, tone = 'brand' }) {
  const toneMap = {
    brand: 'bg-emerald-50 text-emerald-500 border-emerald-100',
    zinc: 'bg-slate-50 text-slate-500 border-slate-200',
    sky: 'bg-emerald-50 text-emerald-500 border-emerald-100',
  };

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">{title}</p>
          <p className="mt-2 text-4xl font-black text-zinc-900">{value}</p>
        </div>
        {Icon ? (
          <div className={`rounded-2xl border p-2.5 ${toneMap[tone] || toneMap.brand}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
