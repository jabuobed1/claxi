export default function LoadingState({ message = 'Loading...', fullPage = false }) {
  return (
    <div
      className={`${
        fullPage ? 'min-h-screen' : 'min-h-[200px]'
      } flex items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/70`}
    >
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-brand" />
        <p className="mt-4 text-sm text-zinc-400">{message}</p>
      </div>
    </div>
  );
}
