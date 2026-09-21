import cv2
import os

def verify_face(expected_user):
    """
    Interactive face verification - shows camera window and returns True if face is recognized.
    Used for desktop/local verification.
    """
    try:
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        recognizer.read("face_model.yml")

        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        cam = cv2.VideoCapture(0)
        verified = False

        while True:
            ret, frame = cam.read()
            if not ret:
                break
                
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)

            for (x,y,w,h) in faces:
                face_img = gray[y:y+h, x:x+w]
                label, confidence = recognizer.predict(face_img)

                # confidence lower = better match
                if confidence < 70:
                    verified = True
                    break

            cv2.imshow("Face Login - Press Q to Quit", frame)

            if verified or cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cam.release()
        cv2.destroyAllWindows()
        return verified
    except:
        return False


def verify_face_single_frame(max_attempts=3, confidence_threshold=70):
    """
    Non-interactive face verification - captures a single frame from webcam.
    Returns True if a face is detected with confidence below threshold.
    Used for automated login verification.
    """
    try:
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        
        if not os.path.exists("face_model.yml"):
            return False
            
        recognizer.read("face_model.yml")

        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        cam = cv2.VideoCapture(0)
        verified = False
        attempts = 0

        while attempts < max_attempts and not verified:
            ret, frame = cam.read()
            if not ret:
                attempts += 1
                continue
                
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)

            if len(faces) > 0:
                for (x, y, w, h) in faces:
                    face_img = gray[y:y+h, x:x+w]
                    label, confidence = recognizer.predict(face_img)

                    # confidence lower = better match
                    if confidence < confidence_threshold:
                        verified = True
                        break
            
            attempts += 1

        cam.release()
        return verified
    except Exception as e:
        print(f"Face verification error: {e}")
        return False