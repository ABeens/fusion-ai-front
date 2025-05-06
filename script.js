let mediaRecorder;
let audioChunks = [];
let isRecording = false;

const recordButton = document.getElementById('recordButton');
const buttonText = recordButton.querySelector('.button-text');
const recordingStatus = document.getElementById('recordingStatus');
const apiResponse = document.getElementById('apiResponse');

// Replace this URL with your actual API endpoint
const API_URL = 'https://abeens-fusion-ai.hf.space/transcribe';

recordButton.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            audioChunks = [];

            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
                await convertAndSendAudio(audioBlob);
            });

            mediaRecorder.start();
            isRecording = true;
            recordButton.classList.add('recording');
            buttonText.textContent = 'Stop Recording';
            recordingStatus.textContent = 'Recording...';
        } catch (error) {
            console.error('Error accessing microphone:', error);
            recordingStatus.textContent = 'Error accessing microphone';
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordButton.classList.remove('recording');
        buttonText.textContent = 'Start Recording';
        recordingStatus.textContent = 'Processing...';
    }
});

async function convertAndSendAudio(audioBlob) {
    try {
        // Convert the audio to WAV format
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create WAV file
        const wavBlob = await audioBufferToWav(audioBuffer);
        
        // Send to API
        await sendAudioToAPI(wavBlob);
    } catch (error) {
        console.error('Error converting audio:', error);
        recordingStatus.textContent = 'Error converting audio';
        apiResponse.textContent = `Error: ${error.message}`;
    }
}

async function sendAudioToAPI(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        apiResponse.textContent = JSON.stringify(data, null, 2);
        recordingStatus.textContent = 'Recording sent successfully';
    } catch (error) {
        console.error('Error sending audio to API:', error);
        recordingStatus.textContent = 'Error sending recording';
        apiResponse.textContent = `Error: ${error.message}`;
    }
}

// Function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2;
    const buffer2 = new ArrayBuffer(44 + length);
    const view = new DataView(buffer2);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(36 + length);                        // file length - 8
    setUint32(0x45564157);                         // "WAVE"
    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit
    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length);                             // chunk length

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < buffer.length) {
        for (let i = 0; i < numOfChan; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([buffer2], { type: 'audio/wav' });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
} 