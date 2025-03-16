
// This file contains utility functions for gesture detection
import * as XLSX from 'xlsx';
import { Hands, Results, VERSION } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

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

// MediaPipe Hands configuration
let hands: Hands | null = null;
let camera: Camera | null = null;
let lastResults: Results | null = null;
let handDetectionActive = true;

// Victory sign detection parameters
const VICTORY_ANGLE_THRESHOLD = 20; // degrees - reduced from 25 to be more sensitive
const VICTORY_DISTANCE_THRESHOLD = 0.05; // normalized distance - reduced from 0.08
const DETECTION_COOLDOWN_MS = 20; // Reduced from 100ms to make detection ultra-fast

// Gesture detection state
let lastDetectionTime = 0;
let detectionConfidence = 0;
let currentGesture: GestureType = "none";
let consecutiveVictoryFrames = 0;
let sensitivityLevel: 'low' | 'medium' | 'high' = 'high';

// Initialize MediaPipe Hands
export const initializeHandTracking = async (): Promise<boolean> => {
  try {
    console.log('Initializing MediaPipe Hands...');
    
    // Create a new Hands instance with error handling
    if (hands) {
      // Already initialized
      return true;
    }
    
    hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSION}/${file}`;
      }
    });
    
    // Configure for better performance and higher sensitivity
    await hands.setOptions({
      maxNumHands: 1, // Track only one hand for better performance
      modelComplexity: 0, // Changed to 0 (lite) for faster performance
      minDetectionConfidence: 0.5, // Reduced from 0.6 for better detection
      minTrackingConfidence: 0.5
    });
    
    console.log(`MediaPipe Hands (version ${VERSION}) initialized successfully`);
    return true;
  } catch (error) {
    console.error('Error initializing MediaPipe Hands:', error);
    return false;
  }
};

// Set up camera with MediaPipe Hands
export const setupMediaPipeCamera = (videoElement: HTMLVideoElement): void => {
  if (!hands) {
    console.error('Hands not initialized');
    return;
  }
  
  // Set up the camera utility with error handling
  try {
    camera = new Camera(videoElement, {
      onFrame: async () => {
        if (!hands || !handDetectionActive) return;
        
        try {
          await hands.send({ image: videoElement });
        } catch (error) {
          console.error('Error in MediaPipe camera processing:', error);
          // Continue despite errors - don't stop detection
        }
      },
      width: 640,
      height: 480
    });
    
    // Set up results handler
    hands.onResults((results) => {
      if (handDetectionActive) {
        lastResults = results;
        processHandResults(results);
      }
    });
    
    // Start camera
    camera.start().catch(error => {
      console.error('Error starting camera:', error);
    });
    console.log('MediaPipe camera setup complete');
  } catch (error) {
    console.error('Error setting up MediaPipe camera:', error);
  }
};

// Process hand tracking results
const processHandResults = (results: Results): void => {
  // If no hands detected, reset detection
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    currentGesture = "none";
    detectionConfidence = 0;
    consecutiveVictoryFrames = 0;
    return;
  }
  
  // Get hand landmarks from the first detected hand
  const landmarks = results.multiHandLandmarks[0];
  
  // Check if this is a victory sign - simplified detection logic
  const isVictory = detectVictorySign(landmarks);
  
  if (isVictory.detected) {
    // Update consecutive frames counter
    consecutiveVictoryFrames++;
    
    // Make detection faster - require fewer consecutive frames
    let requiredFrames = 1; // Default for high sensitivity
    
    if (sensitivityLevel === 'low') {
      requiredFrames = 2; // Reduced from 3
    } else if (sensitivityLevel === 'medium') {
      requiredFrames = 1; // Reduced from 2
    }
    
    // If we have enough consecutive frames, register the victory gesture
    if (consecutiveVictoryFrames >= requiredFrames) {
      currentGesture = "victory";
      detectionConfidence = isVictory.confidence;
      
      // Check cooldown for triggering an alert
      const currentTime = Date.now();
      if (currentTime - lastDetectionTime > DETECTION_COOLDOWN_MS) {
        lastDetectionTime = currentTime;
      }
    } else {
      // Still detecting, but not enough consecutive frames
      currentGesture = "none";
      detectionConfidence = isVictory.confidence * 0.5;
    }
  } else {
    // Reset if not a victory sign
    currentGesture = "none";
    detectionConfidence = 0;
    consecutiveVictoryFrames = 0;
  }
};

// Detect if the hand is making a victory sign - simplified for reliability
const detectVictorySign = (landmarks: any[]): { detected: boolean; confidence: number } => {
  try {
    // Key finger landmarks for a victory sign:
    // - Index: 5 (base), 8 (tip)
    // - Middle: 9 (base), 12 (tip)
    // - Ring: 13 (base), 16 (tip)
    // - Pinky: 17 (base), 20 (tip)
    // - Wrist: 0
    
    // Simplified detection that's more reliable
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];
    const indexBase = landmarks[5];
    const middleBase = landmarks[9];
    
    // Check if index and middle fingers are extended
    const indexExtended = indexTip.y < indexBase.y - 0.1;
    const middleExtended = middleTip.y < middleBase.y - 0.1;
    
    // Check if ring and pinky are not extended as much
    const ringLessExtended = ringTip.y > indexTip.y + 0.05;
    const pinkyLessExtended = pinkyTip.y > indexTip.y + 0.05;
    
    // Check distance between index and middle tips (should be separated)
    const tipDistance = Math.sqrt(
      Math.pow(indexTip.x - middleTip.x, 2) + 
      Math.pow(indexTip.y - middleTip.y, 2)
    );
    
    // Victory sign criteria:
    // 1. Index and middle fingers extended
    // 2. Ring and pinky fingers not extended as much
    // 3. Index and middle tips separated
    
    const isVictorySign = 
      indexExtended && 
      middleExtended && 
      (ringLessExtended || pinkyLessExtended) &&
      tipDistance > 0.05;
    
    // Calculate confidence
    let confidence = 0;
    
    if (isVictorySign) {
      confidence = 0.8; // Higher base confidence
      
      // Improve confidence if more criteria are strongly met
      if (ringLessExtended && pinkyLessExtended) confidence += 0.1;
      if (tipDistance > 0.1) confidence += 0.1;
      
      // Cap at 1.0
      confidence = Math.min(confidence, 1.0);
    }
    
    return { 
      detected: isVictorySign, 
      confidence: confidence 
    };
  } catch (error) {
    console.error('Error in victory sign detection:', error);
    return { detected: false, confidence: 0 };
  }
};

// Calculate 3D distance between two points
const getDistance3D = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number => {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + 
    Math.pow(a.y - b.y, 2) + 
    Math.pow(a.z - b.z, 2)
  );
};

// Calculate angle between two lines defined by 4 points
const calculateAngle = (
  a1: { x: number; y: number }, 
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): number => {
  // Get direction vectors
  const vecA = { x: a2.x - a1.x, y: a2.y - a1.y };
  const vecB = { x: b2.x - b1.x, y: b2.y - b1.y };
  
  // Normalize vectors
  const magA = Math.sqrt(vecA.x * vecA.x + vecA.y * vecA.y);
  const magB = Math.sqrt(vecB.x * vecB.x + vecB.y * vecB.y);
  
  if (magA === 0 || magB === 0) return 0;
  
  const normA = { x: vecA.x / magA, y: vecA.y / magA };
  const normB = { x: vecB.x / magB, y: vecB.y / magB };
  
  // Calculate dot product
  const dotProduct = normA.x * normB.x + normA.y * normB.y;
  
  // Calculate angle in degrees
  const angleRadians = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
  return angleRadians * (180 / Math.PI);
};

// Enhanced detection function that uses MediaPipe
export const detectGesture = async (videoElement: HTMLVideoElement | null): Promise<{ 
  gesture: GestureType; 
  confidence: number; 
}> => {
  if (!videoElement) {
    return { gesture: "none", confidence: 0 };
  }
  
  // If MediaPipe is not initialized, set it up
  if (!hands) {
    await initializeHandTracking();
    setupMediaPipeCamera(videoElement);
  }
  
  // Return current detection state (updated by MediaPipe callback)
  return { 
    gesture: currentGesture, 
    confidence: detectionConfidence 
  };
};

// Function to capture high-quality image
export const captureImage = (videoElement: HTMLVideoElement | null): string | null => {
  if (!videoElement) return null;
  
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Draw hand landmarks for better visualization
    if (lastResults && lastResults.multiHandLandmarks && lastResults.multiHandLandmarks.length > 0) {
      const landmarks = lastResults.multiHandLandmarks[0];
      
      // Draw dots at landmark positions
      landmarks.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = currentGesture === "victory" ? "rgba(255, 50, 50, 0.7)" : "rgba(0, 255, 0, 0.7)";
        ctx.fill();
      });
      
      // Draw connecting lines for fingers
      const fingers = [
        [0, 1, 2, 3, 4], // thumb
        [0, 5, 6, 7, 8], // index
        [0, 9, 10, 11, 12], // middle
        [0, 13, 14, 15, 16], // ring
        [0, 17, 18, 19, 20] // pinky
      ];
      
      fingers.forEach(finger => {
        ctx.beginPath();
        finger.forEach((idx, i) => {
          const point = landmarks[idx];
          if (i === 0) {
            ctx.moveTo(point.x * canvas.width, point.y * canvas.height);
          } else {
            ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
          }
        });
        ctx.strokeStyle = currentGesture === "victory" ? "rgba(255, 50, 50, 0.7)" : "rgba(0, 255, 0, 0.7)";
        ctx.lineWidth = 3;
        ctx.stroke();
      });
    }
    
    // Add metadata overlay
    const timestamp = new Date().toLocaleString();
    const location = "Primary Camera";
    
    // Add black semi-transparent overlay at the bottom
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, canvas.height - 65, canvas.width, 65);
    
    // Add timestamp and location info
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(`Captured: ${timestamp}`, 10, canvas.height - 40);
    ctx.fillText(`Location: ${location}`, 10, canvas.height - 20);
    
    // Add "EMERGENCY ALERT" text for victory gestures
    if (currentGesture === "victory") {
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "red";
      ctx.fillText("EMERGENCY ALERT - DETECTED V SIGN", 10, canvas.height - 65);
    }
    
    // Higher quality image capture for better evidence
    return canvas.toDataURL("image/jpeg", 0.95);
  } catch (error) {
    console.error('Error capturing image:', error);
    return null;
  }
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

// Generate mock alerts for demonstration
export const generateMockAlerts = (count: number = 10): GestureAlert[] => {
  const alerts: GestureAlert[] = [];
  const locations = ["Main Entrance", "Reception Area", "Parking Lot", "Hallway Camera", "Primary Camera"];
  
  for (let i = 0; i < count; i++) {
    // Generate more realistic alerts with higher confidence for ML model
    const gesture: GestureType = Math.random() > 0.3 ? "victory" : "manual";
    
    alerts.push({
      id: `alert-${i}-${Date.now()}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Random time in last 7 days
      gestureType: gesture,
      confidence: 0.94 + (Math.random() * 0.06), // Higher confidence range for ML model (94-100%)
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
  consecutiveVictoryFrames = 0;
  console.log("Detection cooldown and consecutive frames reset");
};

// Function to simulate model training (for UI feedback)
export const simulateModelTraining = async (callback?: (progress: number) => void): Promise<boolean> => {
  try {
    // Reset detection counters
    consecutiveVictoryFrames = 0;
    
    // Show progress for UX
    if (callback) {
      for (let step = 0; step <= 5; step++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        callback((step / 5) * 100);
      }
    }
    
    // Initialize MediaPipe if not already done
    if (!hands) {
      const success = await initializeHandTracking();
      if (!success) {
        console.error("Failed to initialize MediaPipe Hands");
        return false;
      }
    }
    
    // Reset cooldown to allow immediate detection
    resetDetectionCooldown();
    console.log("MediaPipe Hands model ready for detection");
    return true;
  } catch (error) {
    console.error("Error during model initialization:", error);
    return false;
  }
};

// Set detection sensitivity
export const setDetectionSensitivity = (level: 'low' | 'medium' | 'high'): void => {
  sensitivityLevel = level;
  consecutiveVictoryFrames = 0; // Reset consecutive frames counter
  console.log(`Detection sensitivity set to ${level}`);
};
