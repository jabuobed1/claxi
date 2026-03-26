export default function StatCard({ title, value, icon: Icon, tone = 'brand' }) {
  const toneMap = {
    brand: 'bg-brand/10 text-brand border-brand/20',
    zinc: 'bg-zinc-800 text-zinc-200 border-zinc-700',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  };

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
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
