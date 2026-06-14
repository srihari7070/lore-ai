import { useVoice } from '../hooks/useVoice.js';

// Microphone button backed by the Web Speech API. Transcribed chunks are
// appended via onTranscript.
export default function VoiceInput({ onTranscript, className = '' }) {
  const { listening, supported, toggle } = useVoice(onTranscript);

  if (!supported) {
    return (
      <button
        disabled
        title="Voice input is not supported in this browser"
        className={`rounded-md border border-white/10 px-2 py-1 text-xs text-text-muted opacity-50 ${className}`}
      >
        🎤 n/a
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={listening ? 'Stop dictation' : 'Start dictation'}
      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
        listening
          ? 'border-warning bg-warning/10 text-warning animate-pulse-accent'
          : 'border-accent/40 text-accent hover:bg-accent/10'
      } ${className}`}
    >
      {listening ? '● recording' : '🎤 speak'}
    </button>
  );
}
