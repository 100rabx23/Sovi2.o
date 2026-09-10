# SoundMesh



https://sovi2-git-main-aaaa1-a14d.vercel.app/



**"Send data through sound."**

SoundMesh is an experimental web application that allows two nearby phones/laptops to transfer short text messages using SOUND between their speakers and microphones. It integrates the [ggwave](https://github.com/ggerganov/ggwave) library for actual data-over-sound transmission and the Gemini API for semantic message compression and reconstruction.

## Features

- **Actual Audio Transmission:** Uses the Web Audio API and WebAssembly port of `ggwave` to transmit data as audible tones.
- **AI Semantic Compression:** Uses Gemini to compress natural language into dense tokens (e.g., `MEET|TOMORROW|19:00|CAFE`) which fit better within the payload limits of audio transmission.
- **AI Reconstruction:** Expands the received tokenized payload back into a natural sentence.
- **Microphone Receiver:** Listens for the specific frequency markers and decodes the stream continuously.

## Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Add Gemini API Key:**
   Rename `.env.example` to `.env` or create a `.env` file and add your key:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

3. **Start the Application:**
   ```bash
   npm run dev
   ```
   This will start both the Express backend API and the Vite frontend.

4. **Testing on Devices:**
   - Open the application URL on **two devices** (e.g., your laptop and your phone, or two phones).
   - *Note on Microphone Access:* Modern browsers require a secure context (HTTPS) or `localhost` to access `getUserMedia` (the microphone). If you are testing over a local network, you may need to use a tunneling service (like ngrok, Cloudflare Tunnels) or configure a local HTTPS certificate to enable microphone access on the receiving device.
   
5. **Usage Demo:**
   - **Device A:** Tap **Send Message**, type "Meet me at the cafe at 7 PM", and press **Transmit via Sound**.
   - **Device B:** Tap **Receive Message**, grant microphone permissions, and tap **Start Listening**.
   - Place the devices near each other. Device A will play a sequence of tones, and Device B will capture and decode them into the original message!

## Important Notes

- **Volume & Environment:** Make sure the sender's volume is sufficiently loud, and background noise is minimized for the best reliability.
- **Payload Limits:** Audio transmission is slow. SoundMesh uses the `ggwave` Fast Audible protocol, but short messages (under 30 characters) work best. This is why the AI compression step is highly recommended!
