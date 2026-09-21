from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import sqlite3
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image

from database import create_tables
from auth import register_user, validate_user
from face_verify import verify_face_single_frame

app = Flask(__name__)
CORS(app)

# ---------------- BASIC SETUP ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_FOLDER = os.path.join(BASE_DIR, "..", "dataset", "faces")
os.makedirs(DATASET_FOLDER, exist_ok=True)
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DB_PATH = os.path.join(BASE_DIR, "users.db")

create_tables()

# Eye detection cascade classifier
eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")

# ---------------- HOME ----------------
@app.route("/")
def home():
    return "Backend is running successfully"

# ---------------- REGISTER ----------------
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"status": "empty_fields"})

    try:
        register_user(username, password)
        return jsonify({"status": "registered"})
    except:
        return jsonify({"status": "user_exists"})

# ---------------- LOGIN (PASSWORD ONLY) ----------------
@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"status": "empty_fields"})

    if validate_user(username, password):
        print(f"Standard login successful for {username}")
        return jsonify({"status": "success"})
    
    return jsonify({"status": "invalid"})

# ---------------- LOGIN WITH FACE DETECTION ----------------
@app.route("/login-face", methods=["POST"])
def login_with_face():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"status": "empty_fields"})

    if not validate_user(username, password):
        return jsonify({"status": "invalid"})
    
    # ✅ Verify face after password validation
    print(f"Password validated for {username}. Starting face verification...")
    face_verified = verify_face_single_frame(max_attempts=3, confidence_threshold=70)
    
    if not face_verified:
        return jsonify({"status": "face_verification_failed"})
    
    print(f"Face login successful for {username}")
    return jsonify({"status": "success"})

# ---------------- VIDEO UPLOAD ----------------
@app.route("/upload-video", methods=["POST"])
def upload_video():
    username = request.form.get("username")
    video = request.files.get("video")

    print(f"Upload attempt - username: {username}, video: {video}")  # Debug

    if not username or not video:
        print("Missing data")  # Debug
        return jsonify({"status": "missing_data"})

    user_folder = os.path.join(UPLOAD_FOLDER, username)
    os.makedirs(user_folder, exist_ok=True)

    video_path = os.path.join(user_folder, video.filename)
    try:
        video.save(video_path)
        print(f"Video saved to: {video_path}")  # Debug
    except Exception as e:
        print(f"Error saving video: {e}")  # Debug
        return jsonify({"status": "save_error"})

    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                video_path TEXT
            )
        """)

        cur.execute(
            "INSERT INTO videos (username, video_path) VALUES (?, ?)",
            (username, video.filename)
        )
        conn.commit()
        conn.close()
        print(f"Video recorded in DB: {username} - {video.filename}")  # Debug
    except Exception as e:
        print(f"Database error: {e}")  # Debug
        return jsonify({"status": "db_error"})

    return jsonify({"status": "video_uploaded"})

# ---------------- GET USER VIDEOS ----------------
@app.route("/get-videos/<username>")
def get_videos(username):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"GET VIDEOS - Looking for videos for user: {username}")  # Debug
    
    cur.execute(
        "SELECT video_path FROM videos WHERE username = ?",
        (username,)
    )
    rows = cur.fetchall()
    print(f"GET VIDEOS - Found {len(rows)} videos in database: {rows}")  # Debug
    conn.close()

    # Normalize to a simple list of filenames for the frontend
    video_names = [row[0] for row in rows]
    print(f"GET VIDEOS - Returning: {video_names}")  # Debug
    return jsonify(video_names)

# ---------------- SERVE VIDEO FILE ----------------
@app.route("/videos/<username>/<filename>")
def serve_video(username, filename):
    return send_from_directory(
        os.path.join(UPLOAD_FOLDER, username),
        filename
    )

# ---------------- FACE REGISTRATION: START CAPTURE ----------------
@app.route("/start-face-capture", methods=["POST"])
def start_face_capture():
    data = request.json
    username = data.get("username")
    
    if not username:
        return jsonify({"status": "error", "message": "Username required"})
    
    # Create user face directory
    user_face_dir = os.path.join(DATASET_FOLDER, username)
    os.makedirs(user_face_dir, exist_ok=True)
    
    # Clear existing faces for this user
    for file in os.listdir(user_face_dir):
        file_path = os.path.join(user_face_dir, file)
        try:
            os.remove(file_path)
        except:
            pass
    
    print(f"Face capture started for {username}")
    return jsonify({"status": "capture_ready"})

# Face detection cascade classifier
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# Store face count per user session
face_counts = {}

# ---------------- FACE REGISTRATION: CAPTURE FRAME ----------------
@app.route("/capture-face-frame", methods=["POST"])
def capture_face_frame():
    data = request.json
    username = data.get("username")
    frame_data = data.get("frame")
    
    if not username or not frame_data:
        return jsonify({"status": "error", "message": "Missing data"})
    
    try:
        # Decode base64 image
        frame_bytes = base64.b64decode(frame_data.split(',')[1])
        frame_image = Image.open(BytesIO(frame_bytes))
        frame = cv2.cvtColor(np.array(frame_image), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) > 0:
            # Save the face crop
            user_face_dir = os.path.join(DATASET_FOLDER, username)
            
            # Initialize count for this user if not exists
            if username not in face_counts:
                face_counts[username] = len(os.listdir(user_face_dir))
            
            # Save largest face detected
            largest_face = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = largest_face
            
            # Add padding
            padding = 20
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = w + 2 * padding
            h = h + 2 * padding
            
            face_crop = gray[y:y+h, x:x+w]
            
            face_counts[username] += 1
            face_path = os.path.join(user_face_dir, f"{face_counts[username]}.jpg")
            cv2.imwrite(face_path, face_crop)
            
            print(f"Face {face_counts[username]} captured for {username}")
            return jsonify({"status": "face_detected", "count": face_counts[username]})
        else:
            return jsonify({"status": "no_face_detected"})
        
    except Exception as e:
        print(f"Error capturing frame: {e}")
        return jsonify({"status": "error", "message": str(e)})

# ---------------- FACE REGISTRATION: TRAIN MODEL ----------------
@app.route("/train-face-model", methods=["POST"])
def train_face_model():
    data = request.json
    username = data.get("username")
    
    if not username:
        return jsonify({"status": "error", "message": "Username required"})
    
    try:
        # Check face count
        user_face_dir = os.path.join(DATASET_FOLDER, username)
        face_files = [f for f in os.listdir(user_face_dir) if f.endswith('.jpg')]
        
        if len(face_files) < 10:
            return jsonify({
                "status": "insufficient_faces",
                "message": f"Only {len(face_files)} faces captured. Need at least 10.",
                "count": len(face_files)
            })
        
        print(f"Training face model for {username}...")
        
        # Train the model
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        faces = []
        labels = []
        label_map = {}
        current_label = 0
        
        # Load all user faces from dataset
        for user_folder in os.listdir(DATASET_FOLDER):
            user_path = os.path.join(DATASET_FOLDER, user_folder)
            if not os.path.isdir(user_path):
                continue
                
            label_map[current_label] = user_folder
            
            for img_file in os.listdir(user_path):
                if img_file.endswith('.jpg'):
                    img_path = os.path.join(user_path, img_file)
                    try:
                        face = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                        if face is not None:
                            faces.append(face)
                            labels.append(current_label)
                    except:
                        pass
            
            current_label += 1
        
        if len(faces) > 0:
            recognizer.train(faces, np.array(labels))
            
            # Save model
            model_path = os.path.join(BASE_DIR, "face_model.yml")
            recognizer.save(model_path)
            
            # Save label map
            label_map_path = os.path.join(BASE_DIR, "label_map.txt")
            with open(label_map_path, 'w') as f:
                for label, name in label_map.items():
                    f.write(f"{label}:{name}\n")
            
            print(f"Model trained successfully for {username}")
            
            # Clear session count
            if username in face_counts:
                del face_counts[username]
            
            return jsonify({
                "status": "model_trained",
                "message": "Face model trained successfully",
                "face_count": len(faces)
            })
        else:
            return jsonify({
                "status": "error",
                "message": "No valid faces found to train"
            })
        
    except Exception as e:
        print(f"Error training model: {e}")
        return jsonify({"status": "error", "message": str(e)})

# ---------------- CHECK EYES ----------------
@app.route("/check-eyes", methods=["POST"])
def check_eyes():
    data = request.json
    frame_data = data.get("frame")
    
    if not frame_data:
        return jsonify({"eyes_open": True})  # Default to open if no frame
    
    try:
        # Decode base64 image
        frame_bytes = base64.b64decode(frame_data.split(',')[1])
        frame_image = Image.open(BytesIO(frame_bytes))
        frame = cv2.cvtColor(np.array(frame_image), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale for eye detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect eyes
        eyes = eye_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(eyes) > 0:
            return jsonify({"eyes_open": True})
        else:
            return jsonify({"eyes_open": False})
    
    except Exception as e:
        print(f"Error checking eyes: {e}")
        return jsonify({"eyes_open": True})  # Default to open on error

# ---------------- MAIN ----------------
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0')