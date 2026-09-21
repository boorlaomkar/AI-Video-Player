console.log('auth.js loaded');
const API = "http://localhost:5000";

// ---------------- REGISTER ----------------
function register() {
    const usernameVal = document.getElementById("regUsername").value.trim();
    const passwordVal = document.getElementById("regPassword").value.trim();
    const confirmPasswordVal = document.getElementById("regConfirmPassword").value.trim();

    if (!usernameVal || !passwordVal) {
        alert("Please enter username and password");
        return;
    }

    if (passwordVal !== confirmPasswordVal) {
        alert("Passwords do not match");
        return;
    }

    fetch(API + "/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: usernameVal,
            password: passwordVal
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Register response:", data);
        alert(data.status);

        // ✅ CLEAR INPUTS AFTER REGISTER
        document.getElementById("regUsername").value = "";
        document.getElementById("regPassword").value = "";
        document.getElementById("regConfirmPassword").value = "";
    })
    .catch(err => {
        console.error("Register error:", err);
        alert("Server error");
    });
}

// ---------------- STANDARD LOGIN (PASSWORD ONLY) ----------------
function login() {
    const usernameVal = document.getElementById("username").value.trim();
    const passwordVal = document.getElementById("password").value.trim();

    if (!usernameVal || !passwordVal) {
        alert("Please enter username and password");
        return;
    }

    fetch(API + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: usernameVal,
            password: passwordVal
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Standard login response:", data);

        if (data.status === "success") {
            localStorage.setItem("username", usernameVal);
            alert("Login successful! Welcome back!");
            window.location.href = "./dashboard.html";
        } else if (data.status === "invalid") {
            alert("Invalid username or password");
        } else if (data.status === "empty_fields") {
            alert("Please fill in all fields");
        } else {
            alert("Login failed: " + data.status);
        }
    })
    .catch(err => {
        console.error("Login error:", err);
        alert("Server error. Please try again.");
    });
}

// ---------------- LOGIN WITH FACE DETECTION ----------------
function loginWithFace() {
    const usernameVal = document.getElementById("faceLoginUsername").value.trim();
    const passwordVal = document.getElementById("faceLoginPassword").value.trim();

    if (!usernameVal || !passwordVal) {
        alert("Please enter username and password");
        return;
    }

    alert("Validating credentials and face... Please allow camera access and face the webcam.");

    fetch(API + "/login-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: usernameVal,
            password: passwordVal
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Face login response:", data);

        if (data.status === "success") {
            localStorage.setItem("username", usernameVal);
            alert("Face verification successful! Welcome back!");
            window.location.href = "./dashboard.html";
        } else if (data.status === "face_verification_failed") {
            alert("Face verification failed. Please ensure your face is clearly visible and you are registered.");
        } else if (data.status === "invalid") {
            alert("Invalid username or password");
        } else if (data.status === "empty_fields") {
            alert("Please fill in all fields");
        } else {
            alert("Login failed: " + data.status);
        }
    })
    .catch(err => {
        console.error("Login error:", err);
        alert("Server error. Please check your connection.");
    });
}

// ---------------- FACE REGISTRATION ----------------
function registerFace() {
    const usernameVal = document.getElementById("faceUsername").value.trim();

    if (!usernameVal) {
        alert("Please enter your username");
        return;
    }

    // Redirect to face registration page with username as parameter
    window.location.href = `./face_registration.html?username=${encodeURIComponent(usernameVal)}`;
}