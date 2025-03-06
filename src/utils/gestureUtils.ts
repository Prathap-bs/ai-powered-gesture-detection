// This file contains utility functions for gesture detection

export type GestureType = 
  | "victory" // V sign with index and middle finger
  | "manual"  // Manual capture
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

  // For demo purposes, we'll make the random detection less frequent and with higher threshold
  // This will reduce false positives when no V sign is shown
  const random = Math.random();
  
  // Lowering the frequency of false detections significantly (from 15% to 5%)
  if (random > 0.95) {
    // Only detect victory gesture with high confidence when detected
    return { gesture: "victory", confidence: 0.85 + (Math.random() * 0.15) };
  } else {
    // Higher confidence for "none" state to avoid mistaken detections
    return { gesture: "none", confidence: 0.95 + (Math.random() * 0.05) };
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
  
  // Add timestamp and gesture indicator
  const timestamp = new Date().toLocaleString();
  ctx.font = "16px Arial";
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
  ctx.fillStyle = "white";
  ctx.fillText(`Captured: ${timestamp}`, 10, canvas.height - 15);
  
  return canvas.toDataURL("image/jpeg", 0.8);
};

// Function to download image
export const downloadImage = (imageData: string | null, gesture: GestureType): boolean => {
  if (!imageData) return false;
  
  try {
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `${gesture}-alert-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error("Error downloading image:", error);
    return false;
  }
};

// Get a color based on the gesture type
export const getGestureColor = (gesture: GestureType): string => {
  switch (gesture) {
    case "victory": return "text-red-500";
    case "manual": return "text-blue-500";
    case "none": return "text-gray-500";
    default: return "text-gray-500";
  }
};

// Get a display name for the gesture type
export const getGestureDisplayName = (gesture: GestureType): string => {
  switch (gesture) {
    case "victory": return "Victory Sign Emergency";
    case "manual": return "Manual Capture";
    case "none": return "No Gesture";
    default: return "Unknown";
  }
};

// Mock function to generate alert history for demonstration purposes
export const generateMockAlerts = (count: number = 10): GestureAlert[] => {
  const alerts: GestureAlert[] = [];
  
  for (let i = 0; i < count; i++) {
    // Only generate victory gesture alerts
    const gesture: GestureType = Math.random() > 0.3 ? "victory" : "none";
    
    if (gesture !== "none") {
      alerts.push({
        id: `alert-${i}-${Date.now()}`,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Random time in last 7 days
        gestureType: gesture,
        confidence: 0.7 + (Math.random() * 0.3),
        location: "Camera Feed 1",
        processed: Math.random() > 0.3, // 70% chance of being processed
      });
    }
  }
  
  // Sort by timestamp (newest first)
  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};
