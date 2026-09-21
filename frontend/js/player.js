(function(){
    const API = "http://localhost:5000";
    const video = document.getElementById("video");
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const progress = document.getElementById('progress');
    const currentEl = document.getElementById('current');
    const durationEl = document.getElementById('duration');
    const speedSelect = document.getElementById('speedSelect');
    const volume = document.getElementById('volume');
    const videoWrap = document.querySelector('.video-wrap');

    if (!video) return;

    let cameraStream = null;
    let eyeCheckInterval = null;
    let eyesClosedTime = 0;

    function startEyeMonitoring() {
        if (eyeCheckInterval) return; // Already monitoring
        
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                cameraStream = stream;
                eyeCheckInterval = setInterval(checkEyes, 1000);
            })
            .catch(err => {
                console.error('Camera access denied:', err);
            });
    }

    function stopEyeMonitoring() {
        if (eyeCheckInterval) {
            clearInterval(eyeCheckInterval);
            eyeCheckInterval = null;
        }
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        eyesClosedTime = 0;
    }

    function checkEyes() {
        if (!cameraStream) return;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const videoTrack = cameraStream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);
        
        imageCapture.grabFrame()
            .then(imageBitmap => {
                canvas.width = imageBitmap.width;
                canvas.height = imageBitmap.height;
                ctx.drawImage(imageBitmap, 0, 0);
                const frameData = canvas.toDataURL('image/jpeg');
                
                fetch('http://127.0.0.1:5000/check-eyes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frame: frameData })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.eyes_open) {
                        eyesClosedTime = 0;
                    } else {
                        eyesClosedTime += 1;
                        if (eyesClosedTime >= 10) {
                            video.pause();
                            stopEyeMonitoring();
                            alert('Video paused because eyes were closed for 10 seconds.');
                        }
                    }
                })
                .catch(err => console.error('Error checking eyes:', err));
            })
            .catch(err => console.error('Error capturing frame:', err));
    }

    function fmt(t){
        if (!isFinite(t)) return '0:00';
        const s = Math.floor(t%60).toString().padStart(2,'0');
        const m = Math.floor(t/60);
        return `${m}:${s}`;
    }

    // ✅ Aspect Ratio Controls
    const aspectBtns = document.querySelectorAll('.aspect-btn');
    aspectBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            aspectBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Get aspect ratio value
            const aspectRatio = btn.dataset.aspect;
            
            // Remove all aspect classes
            videoWrap.classList.remove(
                'aspect-16-9', 'aspect-9-16', 'aspect-4-3', 
                'aspect-1-1', 'aspect-21-9', 'aspect-full'
            );
            
            // Add new aspect class
            videoWrap.classList.add(`aspect-${aspectRatio}`);
            
            // Store preference in localStorage
            localStorage.setItem('videoAspectRatio', aspectRatio);
        });
    });

    // Load saved aspect ratio on page load
    const savedAspectRatio = localStorage.getItem('videoAspectRatio') || '16-9';
    const savedBtn = document.querySelector(`[data-aspect="${savedAspectRatio}"]`);
    if (savedBtn) {
        savedBtn.click();
    }

    video.addEventListener('loadedmetadata', ()=>{
        progress.max = Math.floor(video.duration);
        durationEl.textContent = fmt(video.duration);
    });

    video.addEventListener('timeupdate', ()=>{
        progress.value = Math.floor(video.currentTime);
        currentEl.textContent = fmt(video.currentTime);
    });

    progress.addEventListener('input', ()=>{
        video.currentTime = progress.value;
    });

    playBtn && playBtn.addEventListener('click', ()=> { video.play(); startEyeMonitoring(); });
    pauseBtn && pauseBtn.addEventListener('click', ()=> { video.pause(); stopEyeMonitoring(); });
    stopBtn && stopBtn.addEventListener('click', ()=>{ video.pause(); video.currentTime=0; stopEyeMonitoring(); });

    // Also listen to video events
    video.addEventListener('play', startEyeMonitoring);
    video.addEventListener('pause', stopEyeMonitoring);
    video.addEventListener('ended', stopEyeMonitoring);

    speedSelect && speedSelect.addEventListener('change', (e)=>{ video.playbackRate = parseFloat(e.target.value) });
    volume && volume.addEventListener('input', (e)=>{ video.volume = parseFloat(e.target.value) });

    // ✅ YouTube-Style Fullscreen
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const container = document.querySelector('.container');
    let isInFullscreen = false;
    let hideTimer = null;
    
    function toggleFullscreen() {
        isInFullscreen = !isInFullscreen;
        
        if (isInFullscreen) {
            // Enter fullscreen
            container.classList.add('theater-fullscreen');
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            fullscreenBtn.textContent = '⬇️ FS';
            
            // Show controls initially
            controls.style.opacity = '1';
            controls.style.visibility = 'visible';
            
            // Auto-hide controls after delay
            hideControlsAfterDelay();
            
            // Listen for mouse movement
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('keydown', onKeyPress);
        } else {
            // Exit fullscreen
            container.classList.remove('theater-fullscreen');
            document.documentElement.style.overflow = 'auto';
            document.body.style.overflow = 'auto';
            fullscreenBtn.textContent = '🖥️ FS';
            
            // Show controls in normal mode
            controls.style.opacity = '1';
            controls.style.visibility = 'visible';
            
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('keydown', onKeyPress);
            if (hideTimer) clearTimeout(hideTimer);
        }
    }
    
    function onMouseMove() {
        if (!isInFullscreen) return;
        // Show controls
        controls.style.opacity = '1';
        controls.style.visibility = 'visible';
        
        // Reset hide timer
        if (hideTimer) clearTimeout(hideTimer);
        hideControlsAfterDelay();
    }
    
    function onKeyPress(e) {
        if (!isInFullscreen) return;
        // Show controls on any key press
        controls.style.opacity = '1';
        controls.style.visibility = 'visible';
        
        if (hideTimer) clearTimeout(hideTimer);
        hideControlsAfterDelay();
    }
    
    function hideControlsAfterDelay() {
        if (!isInFullscreen) return;
        hideTimer = setTimeout(() => {
            controls.style.opacity = '0';
            controls.style.visibility = 'hidden';
        }, 3000);
    }
    
    fullscreenBtn && fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Keyboard shortcut: F key for fullscreen
    window.addEventListener('keydown', (e)=>{
        if (e.key === 'f' || e.key === 'F') {
            if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                toggleFullscreen();
            }
        }
        // ESC key to exit fullscreen
        if (e.key === 'Escape' && isInFullscreen) {
            toggleFullscreen();
        }
    });

    // keyboard shortcuts: space toggle, > or < for speed
    window.addEventListener('keydown', (e)=>{
        if (e.code === 'Space') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
        if (e.key === '>') video.playbackRate = Math.min(2, video.playbackRate + 0.25);
        if (e.key === '<') video.playbackRate = Math.max(0.5, video.playbackRate - 0.25);
    });
})();
