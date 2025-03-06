
// This file contains utility functions for gesture detection

export type GestureType = 
  | "sos" 
  | "help" 
  | "danger" 
  | "medical" 
  | "police" 
  | "none";

export type GestureAlert = {
  id: string;
  timestamp: Date;
  gestureType: GestureType;
  confidence: number;
  imageData?: string; // Base64 encoded image
  location?: string;
  processed: boolean;
};

// Mock function to simulate gesture detection (in a real app, this would be ML-based)
export const detectGesture = async (videoElement: HTMLVideoElement | null): Promise<{ 
  gesture: GestureType; 
  confidence: number; 
}> => {
  if (!videoElement) {
    return { gesture: "none", confidence: 0 };
  }

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // For demo purposes, randomly return gestures occasionally, but mostly "none"
  const random = Math.random();
  
  if (random > 0.92) {
    return { gesture: "sos", confidence: 0.7 + (Math.random() * 0.25) };
  } else if (random > 0.88) {
    return { gesture: "help", confidence: 0.7 + (Math.random() * 0.2) };
  } else if (random > 0.85) {
    return { gesture: "danger", confidence: 0.65 + (Math.random() * 0.3) };
  } else if (random > 0.83) {
    return { gesture: "medical", confidence: 0.6 + (Math.random() * 0.35) };
  } else if (random > 0.8) {
    return { gesture: "police", confidence: 0.75 + (Math.random() * 0.2) };
  } else {
    return { gesture: "none", confidence: 0.9 + (Math.random() * 0.1) };
  }
};

// Function to capture image from video feed
export const captureImage = (videoElement: HTMLVideoElement | null): string | null => {
  if (!videoElement) return null;
  
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  return canvas.toDataURL("image/jpeg", 0.8);
};

// Get a color based on the gesture type
export const getGestureColor = (gesture: GestureType): string => {
  switch (gesture) {
    case "sos": return "text-red-500";
    case "help": return "text-orange-500";
    case "danger": return "text-yellow-500";
    case "medical": return "text-blue-500";
    case "police": return "text-indigo-500";
    case "none": return "text-gray-500";
    default: return "text-gray-500";
  }
};

// Get a display name for the gesture type
export const getGestureDisplayName = (gesture: GestureType): string => {
  switch (gesture) {
    case "sos": return "SOS Emergency";
    case "help": return "Help Needed";
    case "danger": return "Danger Alert";
    case "medical": return "Medical Assistance";
    case "police": return "Police Required";
    case "none": return "No Gesture";
    default: return "Unknown";
  }
};

// Mock function to generate alert history for demonstration purposes
export const generateMockAlerts = (count: number = 10): GestureAlert[] => {
  const gestures: GestureType[] = ["sos", "help", "danger", "medical", "police"];
  const alerts: GestureAlert[] = [];
  
  for (let i = 0; i < count; i++) {
    const gesture = gestures[Math.floor(Math.random() * gestures.length)];
    
    alerts.push({
      id: `alert-${i}-${Date.now()}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Random time in last 7 days
      gestureType: gesture,
      confidence: 0.7 + (Math.random() * 0.3),
      location: "Camera Feed 1",
      processed: Math.random() > 0.3, // 70% chance of being processed
    });
  }
  
  // Sort by timestamp (newest first)
  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};
