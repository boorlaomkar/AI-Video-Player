const API = "http://127.0.0.1:5000";
let username = "";
let capturing = false;
let faceCount = 0;
const MAX_FACES = 20;
const MIN_FACES = 10;
let stream = null;
let canvas = null;
let ctx = null;

// Get username from URL parameter
document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    username = urlParams.get("username");

    if (!username) {
        showMessage("Error: Username not provided", "error");
        return;
    }

    canvas = document.getElementById("webcam");
    ctx = canvas.getContext("2d");
    console.log("Face registration initialized. Canvas:", canvas, "Username:", username);
});

async function startCapture() {
    if (!username) {
        showMessage("Username not found", "error");
        return;
    }

    try {
        showMessage("🎥 Requesting camera access...", "info");
        console.log("Requesting camera access...");
        
        // Request access to webcam
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            },
            audio: false
        });

        console.log("Camera access granted. Stream:", stream);
        
        // Set canvas size
        canvas.width = 640;
        canvas.height = 480;
        
        // Fill canvas with black initially
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Play video stream on canvas
        playCanvasStream(stream);

        capturing = true;
        faceCount = 0;
        document.getElementById("startBtn").style.display = "none";
        document.getElementById("stopBtn").style.display = "inline-block";
        showMessage("✅ Camera ready! Face detection in progress...", "info");

        // Send initial capture request to backend
        fetch(API + "/start-face-capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username })
        })
        .then(res => res.json())
        .then(data => {
            console.log("Capture started on backend:", data);
        })
        .catch(err => {
            console.error("Error starting capture:", err);
            showMessage("Error starting face capture", "error");
        });

        // Capture frames periodically
        captureFrames();
    } catch (err) {
        console.error("Camera error:", err);
        if (err.name === "NotAllowedError") {
            showMessage("❌ Camera permission denied. Please allow camera access.", "error");
        } else if (err.name === "NotFoundError") {
            showMessage("❌ No camera found. Please check your device.", "error");
        } else {
            showMessage("❌ Could not access camera: " + err.message, "error");
        }
    }
}

function playCanvasStream(stream) {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.setAttribute("muted", "true");
    video.setAttribute("autoplay", "true");
    
    console.log("Video element created, setting up stream...");
    
    // Wait for video to load before playing
    video.onloadedmetadata = () => {
        console.log("Video metadata loaded. Dimensions:", video.videoWidth, "x", video.videoHeight);
        video.play().catch(err => console.error("Video play error:", err));
    };
    
    video.onplay = () => {
        console.log("Video playback started");
    };

    function drawFrame() {
        if (capturing) {
            try {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                }
            } catch (err) {
                console.error("Draw error:", err);
            }
        }
        if (capturing) {
            requestAnimationFrame(drawFrame);
        }
    }
    
    // Start drawing after a small delay to ensure video is ready
    setTimeout(() => {
        console.log("Starting frame drawing...");
        drawFrame();
    }, 1000);
}

function captureFrames() {
    if (!capturing) return;

    // Capture frame from canvas every 200ms
    const interval = setInterval(() => {
        if (!capturing) {
            clearInterval(interval);
            return;
        }

        const dataUrl = canvas.toDataURL("image/jpeg");
        
        // Send frame to backend
        fetch(API + "/capture-face-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: username,
                frame: dataUrl
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "face_detected") {
                faceCount++;
                updateProgress();
                console.log(`Face captured: ${faceCount}/${MAX_FACES}`);
                
                if (faceCount >= MAX_FACES) {
                    stopCapture();
                    trainModel();
                }
            }
        })
        .catch(err => console.error("Frame capture error:", err));
    }, 200);
}

function updateProgress() {
    document.getElementById("faceCount").textContent = faceCount;
    const progress = (faceCount / MAX_FACES) * 100;
    document.getElementById("progressFill").style.width = progress + "%";
}

function stopCapture() {
    capturing = false;

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    document.getElementById("startBtn").style.display = "inline-block";
    document.getElementById("stopBtn").style.display = "none";
    
    console.log("Capture stopped. Faces captured:", faceCount);
    
    if (faceCount < MIN_FACES) {
        showMessage(`⚠️ Only ${faceCount} faces captured. Minimum: ${MIN_FACES}+`, "error");
    } else {
        showMessage(`✅ Successfully captured ${faceCount} faces. Training model...`, "info");
    }
}

function trainModel() {
    document.getElementById("loadingContainer").style.display = "block";
    showMessage("", "info");

    fetch(API + "/train-face-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("loadingContainer").style.display = "none";
        
        console.log("Model training response:", data);
        
        if (data.status === "model_trained") {
            showMessage("✅ Face model trained successfully! Redirecting to login...", "success");
            setTimeout(() => {
                window.location.href = "./login.html";
            }, 2000);
        } else if (data.status === "insufficient_faces") {
            showMessage("❌ " + data.message, "error");
        } else {
            showMessage("❌ Error training model: " + (data.message || "Unknown error"), "error");
        }
    })
    .catch(err => {
        document.getElementById("loadingContainer").style.display = "none";
        console.error("Training error:", err);
        showMessage("❌ Error training face model: " + err.message, "error");
    });
}

function cancelRegistration() {
    if (capturing) {
        stopCapture();
    }
    if (confirm("Cancel face registration and return to login?")) {
        window.location.href = "./login.html";
    }
}

function showMessage(msg, type) {
    const messageDiv = document.getElementById("message");
    if (!msg) {
        messageDiv.innerHTML = "";
        return;
    }
    messageDiv.className = "message " + type;
    messageDiv.textContent = msg;
    console.log(`[${type.toUpperCase()}] ${msg}`);
}
