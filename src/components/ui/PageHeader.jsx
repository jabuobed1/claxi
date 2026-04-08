export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 rounded-[1.75rem] border border-zinc-200/80 bg-white/75 px-5 py-4 shadow-sm backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4 md:px-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {action ? <div className="mt-3 sm:mt-0">{action}</div> : null}
    </div>
  );
}
