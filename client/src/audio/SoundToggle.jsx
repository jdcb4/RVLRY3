import { useAudioCues } from './AudioCueContext';

export function SoundToggle({ compact = false }) {
  const { audioEnabled, setAudioEnabled, playCue, primeAudio } = useAudioCues();

  const handleToggle = async () => {
    if (!audioEnabled) {
      await primeAudio();
      await playCue('turn-start');
    }

    setAudioEnabled((currentValue) => !currentValue);
  };

  return (
    <button
      type="button"
      className={`topbar__pill topbar__pill--button ${compact ? 'topbar__pill--compact' : ''}`}
      onClick={handleToggle}
    >
      {audioEnabled ? 'Sound on' : 'Sound off'}
    </button>
  );
}
