import { useAudioCues } from './AudioCueContext';
import { VolumeOffIcon, VolumeOnIcon } from '../components/Icons';

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
      aria-label={audioEnabled ? 'Mute sound effects' : 'Enable sound effects'}
      title={audioEnabled ? 'Mute sound effects' : 'Enable sound effects'}
      className={`topbar__pill topbar__pill--button topbar__pill--icon ${compact ? 'topbar__pill--compact' : ''}`}
      onClick={handleToggle}
    >
      {audioEnabled ? <VolumeOnIcon /> : <VolumeOffIcon />}
    </button>
  );
}
