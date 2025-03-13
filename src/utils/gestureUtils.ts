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
  
  const currentTime = Date.now();
  
  // Check if we're still in cooldown period after a successful detection
  if (currentTime - lastDetectionTime < DETECTION_COOLDOWN_MS) {
    return { gesture: "none", confidence: 0.99 };
  }

  // For demo purposes, we'll make the random detection less frequent and with higher threshold
  // This will reduce false positives when no V sign is shown
  const random = Math.random();
  
  // Even lower frequency of false detections (from 5% to 2%)
  if (random > 0.98) {
    // Only detect victory gesture with high confidence when detected
    lastDetectionTime = currentTime; // Update last detection time
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
