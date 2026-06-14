import VoiceInput from './VoiceInput.jsx';

// Free-text dump area with voice dictation. No AI interference — pure capture.
export default function DumpBox({ value, onChange }) {
  const appendTranscript = (text) => {
    const sep = value && !value.endsWith(' ') && !value.endsWith('\n') ? ' ' : '';
    onChange(`${value}${sep}${text}`);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs uppercase tracking-wide text-text-muted">Dump box</label>
        <VoiceInput onTranscript={appendTranscript} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write or speak freely. Stream of consciousness, bullet points, anything. The AI won't touch this until you press Structure."
        className="lore-scroll h-44 w-full resize-y rounded-md border border-accent/20 bg-canvas p-3 font-mono text-sm text-text-primary placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
      />
    </div>
  );
}
