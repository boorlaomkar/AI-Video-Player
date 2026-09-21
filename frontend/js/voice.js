// Check browser support
if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error('Speech Recognition API not supported in this browser');
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

let isListening = false;
let voiceControlEnabled = true;
const WAKE_WORDS = ['hey', 'ok', 'hey video', 'ok video'];

// Initialize voice control status display
function initVoiceControl() {
    if (!recognition) {
        console.error('Speech Recognition not available');
        const voiceBtn = document.getElementById('voiceControlBtn');
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.textContent = '🎤 UNAVAILABLE';
            voiceBtn.title = 'Speech Recognition not supported by your browser';
        }
        showNotification('Voice control not supported in your browser', 'error');
        return;
    }

    const voiceBtn = document.getElementById('voiceControlBtn');
    if (voiceBtn) {
        voiceBtn.addEventListener('click', toggleVoiceControl);
        console.log('Voice control button initialized');
    } else {
        console.warn('Voice control button not found');
    }
}

function toggleVoiceControl() {
    voiceControlEnabled = !voiceControlEnabled;
    const voiceBtn = document.getElementById('voiceControlBtn');
    if (voiceBtn) {
        voiceBtn.classList.toggle('active', voiceControlEnabled);
        voiceBtn.textContent = voiceControlEnabled ? '🎤 ON' : '🎤 OFF';
    }
    if (voiceControlEnabled) {
        startListening();
        showNotification('Voice control enabled', 'success');
    } else {
        stopListening();
        showNotification('Voice control disabled', 'info');
    }
}

function showNotification(msg, type = 'info') {
    const indicator = document.getElementById('voiceIndicator');
    if (indicator) {
        indicator.style.display = 'flex';
        const colorMap = {
            'success': '#4CAF50',
            'error': '#f44336',
            'info': '#2196F3'
        };
        const color = colorMap[type] || '#2196F3';
        indicator.style.backgroundColor = color + 'dd';
        indicator.innerHTML = `<span>${msg}</span>`;
        console.log('Notification:', msg, type);
        
        if (type !== 'info') {
            setTimeout(() => {
                if (indicator.style.display === 'flex') {
                    indicator.style.display = 'none';
                }
            }, 2000);
        }
    }
}

function startListening() {
    if (!recognition) {
        console.error('Recognition object not initialized');
        return;
    }

    if (!isListening && voiceControlEnabled) {
        try {
            console.log('Starting voice recognition...');
            recognition.start();
            isListening = true;
            const indicator = document.getElementById('voiceIndicator');
            if (indicator) {
                indicator.style.display = 'flex';
                indicator.innerHTML = '<span>🎤 Listening...</span>';
                indicator.style.backgroundColor = '#2196F3dd';
            }
        } catch (e) {
            console.error('Failed to start voice recognition:', e);
            setTimeout(startListening, 2000);
        }
    }
}

function stopListening() {
    if (!recognition) return;
    
    if (isListening) {
        try {
            recognition.stop();
            console.log('Voice recognition stopped');
        } catch (e) {
            console.error('Error stopping recognition:', e);
        }
        isListening = false;
    }
}

if (recognition) {
    recognition.onstart = function() {
        console.log('Speech recognition started');
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'network') {
            showNotification('Network error - check internet', 'error');
        } else if (event.error === 'no-speech') {
            console.log('No speech detected, restarting...');
            if (voiceControlEnabled) {
                setTimeout(startListening, 1000);
            }
        } else if (event.error === 'not-allowed') {
            showNotification('Microphone permission denied', 'error');
            voiceControlEnabled = false;
            const voiceBtn = document.getElementById('voiceControlBtn');
            if (voiceBtn) voiceBtn.textContent = '🎤 DENIED';
        }
    };

    recognition.onend = function() {
        console.log('Voice recognition ended');
        isListening = false;
        if (voiceControlEnabled) {
            setTimeout(startListening, 500);
        }
    };

    recognition.onresult = function (event) {
        const result = event.results[event.results.length - 1][0];
        const transcript = result.transcript.toLowerCase().trim();
        const confidence = result.confidence;

        console.log('Heard:', transcript, 'Confidence:', confidence);

        // Only process if confidence is high enough
        if (confidence < 0.7) {
            console.log('Low confidence, ignoring');
            return;
        }

        if (!transcript || transcript.length === 0) {
            return;
        }

        const indicator = document.getElementById('voiceIndicator');
        if (indicator) {
            indicator.innerHTML = '<span>⚡ Processing...</span>';
            indicator.style.backgroundColor = '#FF9800dd';
            indicator.style.display = 'flex';
        }

        let commandText = '';
        let hasWakeWord = false;

        for (let word of WAKE_WORDS) {
            if (transcript.includes(word)) {
                hasWakeWord = true;
                const parts = transcript.split(word);
                commandText = parts[parts.length - 1].trim();
                break;
            }
        }

        const finalCmd = hasWakeWord ? commandText : transcript;
        if (finalCmd) {
            processCommand(finalCmd);
        }
    };
}

function processCommand(cmd) {
    const video = document.getElementById('video');
    if (!video) {
        console.error('Video element not found');
        return;
    }

    let executed = false;
    let feedback = '';

    // Define command patterns with priority (exact matches first)
    const commands = [
        // Exact phrases
        { pattern: /^play$|^start$|^resume$/, action: () => { if (video.paused) { video.play().catch(err => console.error('Play error:', err)); feedback = 'Playing ▶'; executed = true; } else { feedback = 'Already playing ▶'; } } },
        { pattern: /^pause$|^hold$/, action: () => { if (!video.paused) { video.pause(); feedback = 'Paused ⏸'; executed = true; } else { feedback = 'Already paused ⏸'; } } },
        { pattern: /^stop$|^reset$/, action: () => { video.pause(); video.currentTime = 0; feedback = 'Stopped ⏹'; executed = true; } },
        { pattern: /^mute$|^silent$/, action: () => { if (!video.muted) { video.muted = true; feedback = 'Muted 🔇'; executed = true; } } },
        { pattern: /^unmute$|^sound on$|^sound$/, action: () => { if (video.muted) { video.muted = false; feedback = 'Unmuted 🔊'; executed = true; } } },
        { pattern: /^volume up$|^louder$|^turn up$|^increase$/, action: () => { video.volume = Math.min(1, video.volume + 0.1); updateVolumeUI(video); feedback = `Volume ${Math.round(video.volume * 100)}% 🔊`; executed = true; } },
        { pattern: /^volume down$|^quieter$|^turn down$|^less volume$/, action: () => { video.volume = Math.max(0, video.volume - 0.1); updateVolumeUI(video); feedback = `Volume ${Math.round(video.volume * 100)}% 🔉`; executed = true; } },
        { pattern: /^speed up$|^faster$/, action: () => { const newSpeed = Math.min(2, video.playbackRate + 0.25); video.playbackRate = newSpeed; updateSpeedUI(newSpeed); feedback = `Speed ${newSpeed}x ⚡`; executed = true; } },
        { pattern: /^speed down$|^slower$/, action: () => { const newSpeed = Math.max(0.5, video.playbackRate - 0.25); video.playbackRate = newSpeed; updateSpeedUI(newSpeed); feedback = `Speed ${newSpeed}x 🐢`; executed = true; } },
        { pattern: /^rewind$|^back$|^go back$|^10 seconds back$/, action: () => { video.currentTime = Math.max(0, video.currentTime - 10); feedback = 'Rewinded 10s ⏪'; executed = true; } },
        { pattern: /^forward$|^skip$|^10 seconds$|^skip ahead$/, action: () => { video.currentTime = Math.min(video.duration, video.currentTime + 10); feedback = 'Skipped 10s ⏩'; executed = true; } },
        { pattern: /^help$|^commands$/, action: () => { feedback = 'Say: play, pause, stop, mute, unmute, volume up/down, speed up/down, forward, rewind, help'; executed = true; } }
    ];

    // Check for exact matches first
    for (let command of commands) {
        if (command.pattern.test(cmd)) {
            command.action();
            break;
        }
    }

    console.log('Command:', cmd, '| Feedback:', feedback, '| Executed:', executed);

    if (executed || feedback) {
        showNotification(feedback || 'Command not recognized', executed ? 'success' : 'info');
    } else {
        showNotification('Command not recognized. Say "help" for commands', 'info');
    }
}

function updateVolumeUI(video) {
    const volEl = document.getElementById('volume');
    if (volEl) volEl.value = video.volume;
}

function updateSpeedUI(speed) {
    const speedEl = document.getElementById('speedSelect');
    if (speedEl) speedEl.value = speed;
}

// Defer initialization until DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing voice control...');
    initVoiceControl();
    
    // Add a small delay to ensure all elements are ready
    setTimeout(() => {
        if (voiceControlEnabled && recognition) {
            startListening();
        }
    }, 500);
});

// Fallback for older browsers that fire load before DOMContentLoaded
window.addEventListener('load', function() {
    if (!isListening && voiceControlEnabled && recognition) {
        console.log('Window loaded, ensuring voice control is started...');
        startListening();
    }
});
