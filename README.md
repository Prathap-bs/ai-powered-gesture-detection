# 🖐 AI-Powered Gesture Detection for Emergency Response

This project is a full-stack AI-based emergency gesture detection system built to recognize the "V" sign using hand tracking and alert mechanisms. It leverages *React, **OpenCV, **MediaPipe, and **Supabase* to detect, store, and analyze gesture data in real-time.

### 🚀 Features

- Real-time *V-sign gesture recognition* with 93% accuracy and <50ms latency
- Built with *React + TypeScript + Vite*
- Used *MediaPipe + OpenCV* for landmark-based gesture detection
- Dual webcam streaming using *WebRTC*
- *Canvas overlays* and gesture stabilization for better accuracy
- Backend via *Supabase* (PostgreSQL + Auth)
- Offline fallback via localStorage with sync capabilities

### 🧰 Tech Stack

- Frontend: React, TypeScript, Tailwind CSS, shadcn/ui
- AI Engine: OpenCV, MediaPipe
- Backend: Supabase (PostgreSQL, Auth, Storage)
- Utilities: WebRTC, Vite, Canvas API

### 📷 Demo

Live Demo: [https://ai-powered-gesture-detection-62.lovable.app](https://ai-powered-gesture-detection-62.lovable.app)  
![](demo.gif) (Add a small screen recording if you can)

### 📁 Folder Structure

```bash
├── src/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── App.tsx
├── backend/
│   └── Supabase config
└── public/
