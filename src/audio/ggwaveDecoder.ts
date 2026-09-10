import { initGGWave } from './ggwaveManager';

let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let scriptNode: ScriptProcessorNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;

export async function startListening(
  onSignalDetected: () => void,
  onMessageDecoded: (message: string) => void,
  onAudioData: (data: Float32Array) => void,
  onError: (error: Error) => void
) {
  try {
    const { instance, inst } = await initGGWave();

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        // Ensure we capture wider frequency range for better decoding
        latency: 0.01,
      }
    });

    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
      });
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    
    // Create analyser for signal detection
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    // Buffer size for better quality - larger for longer messages
    // ScriptProcessorNode is deprecated but most reliable for WASM integration
    const bufferSize = 4096; // Increased from 2048 for better accuracy
    scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

    let decodingBuffer: Int8Array[] = [];
    let isProcessing = false;

    scriptNode.onaudioprocess = (audioProcessingEvent) => {
      if (isProcessing) return;
      
      const inputBuffer = audioProcessingEvent.inputBuffer;
      const inputData = inputBuffer.getChannelData(0); // Float32Array
      
      // Pass copy to visualizer with throttling handled by caller
      onAudioData(new Float32Array(inputData));

      // ggwave expects Int8Array mapping of the Float32Array bytes
      const bytes = new Int8Array(inputData.buffer, inputData.byteOffset, inputData.byteLength);
      
      // Accumulate audio chunks for better decoding
      decodingBuffer.push(new Int8Array(bytes));

      // Try decoding periodically (every 4 chunks = ~85ms at 48kHz)
      if (decodingBuffer.length >= 4) {
        isProcessing = true;
        
        // Concatenate accumulated buffer
        const totalLength = decodingBuffer.reduce((sum, buf) => sum + buf.length, 0);
        const combinedBuffer = new Int8Array(totalLength);
        let offset = 0;
        for (const buf of decodingBuffer) {
          combinedBuffer.set(buf, offset);
          offset += buf.length;
        }
        
        try {
          const rxBytes = instance.decode(inst, combinedBuffer);
          
          // If it returned a non-empty Int8Array, we got a decoded payload
          if (rxBytes && rxBytes.length > 0) {
            const decodedString = new TextDecoder().decode(rxBytes);
            
            // Validate decoded string is not empty and contains actual data
            if (decodedString.trim().length > 0) {
              isProcessing = false;
              onMessageDecoded(decodedString);
              decodingBuffer = [];
              return;
            }
          }
        } catch (err) {
          console.error("Decoding error:", err);
        }
        
        // Keep only the last chunk for overlap
        decodingBuffer = [decodingBuffer[decodingBuffer.length - 1]];
        isProcessing = false;
      }
    };

    sourceNode.connect(analyser);
    analyser.connect(scriptNode);
    scriptNode.connect(audioContext.destination);

  } catch (error: any) {
    console.error("Listening error:", error);
    onError(error);
  }
}

export function stopListening() {
  if (scriptNode && audioContext) {
    scriptNode.disconnect();
    if (sourceNode) sourceNode.disconnect();
    if (analyser) analyser.disconnect();
    scriptNode = null;
    sourceNode = null;
    analyser = null;
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}
