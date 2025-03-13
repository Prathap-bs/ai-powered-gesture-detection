// This file contains utility functions for gesture detection
import * as XLSX from 'xlsx';

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

// Track the last detection time to implement cooldown
let lastDetectionTime = 0;
const DETECTION_COOLDOWN_MS = 5000; // 5 seconds cooldown between detections

// Improved mock function to simulate better gesture detection
export const detectGesture = async (videoElement: HTMLVideoElement | null): Promise<{ 
  gesture: GestureType; 
  confidence: number; 
}> => {
  if (!videoElement) {
    return { gesture: "none", confidence: 0 };
  }

  // Simulate processing delay (reduced from 500ms to 150ms for faster response)
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const currentTime = Date.now();
  
  // Check if we're still in cooldown period after a successful detection
  if (currentTime - lastDetectionTime < DETECTION_COOLDOWN_MS) {
    return { gesture: "none", confidence: 0.99 };
  }

  // To simulate a more trained model, we'll use a different approach:
  // In a real ML model, we would analyze pixel data here
  
  // Increased response rate (now 1% chance of detection instead of previous 2%)
  // This simulates a more sensitive but still controlled detection rate
  const detectionThreshold = 0.99; // 1% chance of detection on each frame
  const random = Math.random();
  
  if (random > detectionThreshold) {
    // When detected, always use high confidence to simulate a well-trained model
    lastDetectionTime = currentTime; // Update last detection time
    return { 
      gesture: "victory", 
      confidence: 0.92 + (Math.random() * 0.08) // Higher confidence range (92-100%)
    };
  } else {
    // Higher confidence for "none" state to avoid mistaken detections
    return { 
      gesture: "none", 
      confidence: 0.98 + (Math.random() * 0.02) // Very high confidence for "none" (98-100%)
    };
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
  
  // Enhanced metadata overlay on captured images
  const timestamp = new Date().toLocaleString();
  const location = "Primary Camera";
  
  // Add black semi-transparent overlay at the bottom
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
  
  // Add timestamp and location info
  ctx.font = "bold 16px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(`Captured: ${timestamp}`, 10, canvas.height - 35);
  ctx.fillText(`Location: ${location}`, 10, canvas.height - 15);
  
  // Add "EMERGENCY ALERT" text for victory gestures
  ctx.font = "bold 20px Arial";
  ctx.fillStyle = "red";
  ctx.fillText("EMERGENCY ALERT - V SIGN DETECTED", 10, canvas.height - 60);
  
  return canvas.toDataURL("image/jpeg", 0.9); // Higher quality (0.9) for better evidence
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
  const locations = ["Main Entrance", "Reception Area", "Parking Lot", "Hallway Camera", "Primary Camera"];
  
  for (let i = 0; i < count; i++) {
    // Only generate victory gesture alerts
    const gesture: GestureType = Math.random() > 0.3 ? "victory" : "manual";
    
    alerts.push({
      id: `alert-${i}-${Date.now()}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Random time in last 7 days
      gestureType: gesture,
      confidence: 0.85 + (Math.random() * 0.15), // Higher confidence (85-100%)
      location: locations[Math.floor(Math.random() * locations.length)],
      processed: Math.random() > 0.3, // 70% chance of being processed
    });
  }
  
  // Sort by timestamp (newest first)
  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

// Function to export alerts to Excel file
export const exportAlertsToExcel = (alerts: GestureAlert[]): void => {
  try {
    // Prepare data for Excel export
    const exportData = alerts.map(alert => ({
      'Date': alert.timestamp.toLocaleDateString(),
      'Time': alert.timestamp.toLocaleTimeString(),
      'Type': getGestureDisplayName(alert.gestureType),
      'Confidence': `${(alert.confidence * 100).toFixed(1)}%`,
      'Location': alert.location || 'Unknown',
      'Status': alert.processed ? 'Processed' : 'Unprocessed'
    }));
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Emergency Alerts');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `emergency-alerts-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error('Error exporting alerts to Excel:', error);
  }
};

// Function to reset the detection cooldown (useful for testing)
export const resetDetectionCooldown = (): void => {
  lastDetectionTime = 0;
};
