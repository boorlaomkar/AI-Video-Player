import cv2
import os

def capture_faces(username):
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    cam = cv2.VideoCapture(0)
    count = 0

    user_dir = f"../dataset/faces/{username}"
    os.makedirs(user_dir, exist_ok=True)

    while True:
        ret, frame = cam.read()
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        for (x, y, w, h) in faces:
            count += 1
            face_img = gray[y:y+h, x:x+w]
            cv2.imwrite(f"{user_dir}/{count}.jpg", face_img)
            cv2.rectangle(frame, (x,y), (x+w,y+h), (0,255,0), 2)

        cv2.imshow("Register Face - Press Q to Quit", frame)

        if cv2.waitKey(1) & 0xFF == ord('q') or count >= 30:
            break

    cam.release()
    cv2.destroyAllWindows()