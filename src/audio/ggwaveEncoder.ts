import { float32ToWav } from './wavExport';
import { initGGWave } from './ggwaveManager';

let audioContext: AudioContext | null = null;

export async function generateWavBlob(message: string): Promise<Blob> {
  const { instance, inst } = await initGGWave();
  const protocolId = instance.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
  
  // Increase volume (50) for better transmission of longer messages
  const txBytes = instance.encode(inst, message, protocolId, 50);
  const floatArray = new Float32Array(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength / 4);
  return float32ToWav(floatArray, 48000);
}

export async function transmitMessage(
  message: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { instance, inst } = await initGGWave();

  // Create an AudioContext with the specific sample rate
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 48000,
    });
  }

  // Ensure context is resumed (required by some browsers if not auto-resumed)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  // Encode the message to ggwave audio format
  // Protocol: GGWAVE_PROTOCOL_AUDIBLE_FAST (id: 1)
  const protocolId = instance.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST;
  
  // Increased volume for better transmission
  // 50 provides good balance for longer messages without clipping
  const volume = 50;

  const txBytes = instance.encode(inst, message, protocolId, volume);
  
  // Since sampleFormatOut is F32, the returned Int8Array contains Float32 values
  // We view it as a Float32Array for the WebAudio API
  const floatArray = new Float32Array(txBytes.buffer, txBytes.byteOffset, txBytes.byteLength / 4);

  // Normalize the audio to prevent clipping
  let maxVal = 0;
  for (let i = 0; i < floatArray.length; i++) {
    const absVal = Math.abs(floatArray[i]);
    if (absVal > maxVal) maxVal = absVal;
  }
  
  // If signal is very weak, amplify it
  if (maxVal > 0 && maxVal < 0.3) {
    const amplification = 0.5 / maxVal;
    for (let i = 0; i < floatArray.length; i++) {
      floatArray[i] *= amplification;
    }
  }

  // Play the float array using WebAudio API
  const audioBuffer = audioContext.createBuffer(1, floatArray.length, 48000);
  audioBuffer.copyToChannel(floatArray, 0);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Use gain node to safely control volume
  const gainNode = audioContext.createGain();
  gainNode.gain.value = 0.8; // Slightly reduced to prevent distortion
  
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  const durationMs = (floatArray.length / 48000) * 1000;
  
  return new Promise((resolve) => {
    source.onended = () => {
      resolve();
    };
    source.start();

    // Emulate progress
    if (onProgress) {
      const startTime = performance.now();
      const interval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        let p = elapsed / durationMs;
        if (p >= 1) {
          p = 1;
          clearInterval(interval);
        }
        onProgress(p);
      }, 50);
    }
  });
}
