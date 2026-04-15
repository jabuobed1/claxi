import { CreditCard, Paperclip, X, FileText, ImageIcon } from 'lucide-react';
import { LESSON_DURATION_OPTIONS } from '../../../utils/pricing';

export default function StudentRequestInputPanel({
  topic,
  onTopicChange,
  textareaRef,
  attachments,
  onFileChange,
  onRemoveAttachment,
  durationMinutes,
  onDurationChange,
  cardId,
  onCardChange,
  paymentMethods,
}) {
  return (
    <div className="rounded-3xl border border-white/15 bg-black/35 p-4 shadow-2xl shadow-black/25 backdrop-blur-2xl sm:p-5">
      {attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => {
            const isImage = file.type.startsWith('image/');
            return (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50"
              >
                {isImage ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                <span className="max-w-[150px] truncate font-medium sm:max-w-[210px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(index)}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-emerald-100 transition hover:bg-white/15"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={topic}
        onChange={onTopicChange}
        placeholder="Describe what you need help with..."
        rows={4}
        className="max-h-[220px] min-h-[112px] w-full resize-none overflow-y-auto rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm leading-6 text-white placeholder:text-zinc-300/70 outline-none transition focus:border-emerald-400/70"
      />

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20">
          <Paperclip className="h-4 w-4" />
          <input type="file" accept="application/pdf,image/*" multiple onChange={onFileChange} className="hidden" />
        </label>

        <label className="inline-flex h-11 min-w-[170px] shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-white">
          <CreditCard className="h-4 w-4 shrink-0 text-zinc-200" />
          <select
            value={cardId}
            onChange={(event) => onCardChange(event.target.value)}
            className="w-full bg-transparent text-xs font-medium text-white outline-none"
          >
            <option value="" className="text-zinc-900">Visa •••• 4242</option>
            {paymentMethods.map((card) => (
              <option key={card.id} value={card.id} className="text-zinc-900">
                {card.nickname.charAt(0).toUpperCase() + card.nickname.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex h-11 min-w-[108px] shrink-0 items-center rounded-full border border-white/20 bg-white/10 px-4 text-white">
          <select
            value={durationMinutes}
            onChange={onDurationChange}
            className="w-full bg-transparent text-xs font-medium text-white outline-none"
          >
            {LESSON_DURATION_OPTIONS.map((option) => (
              <option key={option} value={option} className="text-zinc-900">{option} min</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
