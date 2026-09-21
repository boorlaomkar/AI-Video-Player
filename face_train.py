import cv2
import numpy as np
import os

def train_model():
    recognizer = cv2.face.LBPHFaceRecognizer_create()
    faces = []
    labels = []
    label_map = {}
    current_label = 0

    dataset_path = "../dataset/faces"

    for user in os.listdir(dataset_path):
        label_map[current_label] = user
        user_path = os.path.join(dataset_path, user)

        for img in os.listdir(user_path):
            img_path = os.path.join(user_path, img)
            face = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            faces.append(face)
            labels.append(current_label)

        current_label += 1

    recognizer.train(faces, np.array(labels))
    recognizer.save("face_model.yml")

    return label_map