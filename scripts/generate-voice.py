"""Regenerate the bundled speech locally; no model is shipped to players.

Requires: pip install kokoro-onnx soundfile imageio-ffmpeg
Export the exact script with: node scripts/export-voice.mjs voice-script.json
Then pass --model and --voices paths downloaded from kokoro-onnx's model-files-v1.1 release.
"""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--voices', type=Path, required=True)
    parser.add_argument('--script', type=Path, default=Path('voice-script.json'))
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    import numpy as np
    import soundfile as sf
    import imageio_ffmpeg
    from kokoro_onnx import Kokoro

    project = Path(__file__).resolve().parent.parent
    destination = project / 'public/douglass-next/voice'
    destination.mkdir(parents=True, exist_ok=True)
    manifest_path = project / 'src/douglass-next/voice-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    lines = json.loads(args.script.read_text(encoding='utf-8'))
    synth = Kokoro(str(args.model), str(args.voices))
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory(prefix='douglass-voice-') as temporary:
        for index, line in enumerate(lines):
            output = destination / (line['id'] + '.mp3')
            if output.exists() and line['id'] in manifest and not args.force:
                continue
            samples, rate = synth.create(
                line['text'], voice=line['voice'], speed=line['speed'],
                lang='en-gb' if line['voice'].startswith('b') else 'en-us',
            )
            if not np.isfinite(samples).all() or len(samples) < rate * .3 or np.max(np.abs(samples)) < .01:
                raise ValueError('Empty or invalid speech: ' + line['id'])
            wave = Path(temporary) / 'line.wav'
            sf.write(wave, samples, rate)
            subprocess.run([
                ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wave),
                '-af', 'highpass=f=65,loudnorm=I=-18:TP=-2:LRA=9', '-ar', '24000', '-ac', '1',
                '-codec:a', 'libmp3lame', '-b:a', '80k', str(output),
            ], check=True)
            manifest[line['id']] = {
                'file': output.name, 'duration': round(len(samples) / rate, 2), 'voice': line['voice'],
            }
            manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
            print(f'{index + 1}/{len(lines)}: {output.name}', flush=True)
    print('Voice generation complete. Run npm run check to validate coverage.')


if __name__ == '__main__':
    main()
