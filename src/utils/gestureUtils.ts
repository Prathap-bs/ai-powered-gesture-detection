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
const VICTORY_DISTANCE_THRESHOLD = 0.05; // normalized distance - reduced for better sensitivity
const DETECTION_COOLDOWN_MS = 10; // Extremely short cooldown for immediate response

// Gesture detection state
let lastDetectionTime = 0;
let detectionConfidence = 0;
let currentGesture: GestureType = "none";
let consecutiveVictoryFrames = 0;
let sensitivityLevel: 'low' | 'medium' | 'high' = 'high';
let isModelInitialized = false;

// Initialize MediaPipe Hands with better error handling
export const initializeHandTracking = async (): Promise<boolean> => {
  try {
    // If already initialized, return
    if (hands && isModelInitialized) {
      console.log('MediaPipe Hands already initialized');
      return true;
    }
    
    console.log('Initializing MediaPipe Hands...');
    
    // Create a new Hands instance with better error handling
    hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSION}/${file}`;
      }
    });
    
    // Set up options for maximum sensitivity - minimal filtering
    await hands.setOptions({
      maxNumHands: 1, 
      modelComplexity: 0, // Use lite model for speed
      minDetectionConfidence: 0.3, // Lower threshold for better detection
      minTrackingConfidence: 0.3 // Lower threshold for continued tracking
    });
    
    isModelInitialized = true;
    console.log(`MediaPipe Hands (version ${VERSION}) initialized successfully`);
    return true;
  } catch (error) {
    console.error('Error initializing MediaPipe Hands:', error);
    // Reset state on error
    hands = null;
    isModelInitialized = false;
    return false;
  }
};

// Set up camera with MediaPipe Hands - with better error handling
export const setupMediaPipeCamera = (videoElement: HTMLVideoElement): void => {
  if (!hands) {
    console.error('Hands not initialized');
    initializeHandTracking()
      .then(success => {
        if (success) setupMediaPipeCamera(videoElement);
      });
    return;
  }
  
  try {
    // If we already have a camera, don't create a new one
    if (camera) {
      console.log('Camera already set up');
      return;
    }
    
    camera = new Camera(videoElement, {
      onFrame: async () => {
        if (!hands || !handDetectionActive) return;
        
        try {
          // Process the current video frame
          await hands.send({ image: videoElement });
        } catch (error) {
          console.error('Error in MediaPipe camera processing:', error);
          // Continue despite errors - don't stop detection
        }
      },
      width: 640,
      height: 480
    });
    
    // Set up results handler with better error handling
    hands.onResults((results) => {
      try {
        if (handDetectionActive) {
          lastResults = results;
          processHandResults(results);
        }
      } catch (error) {
        console.error('Error processing hand results:', error);
        // Reset the current gesture on error
        currentGesture = "none";
        detectionConfidence = 0;
      }
    });
    
    // Start camera with error handling
    camera.start()
      .then(() => console.log('MediaPipe camera started successfully'))
      .catch(error => {
        console.error('Error starting camera:', error);
      });
  } catch (error) {
    console.error('Error setting up MediaPipe camera:', error);
    camera = null;
  }
};

// Process hand tracking results with simplified logic for better reliability
const processHandResults = (results: Results): void => {
  // If no hands are detected, reset the detection state
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    currentGesture = "none";
    detectionConfidence = 0;
    consecutiveVictoryFrames = 0;
    return;
  }
  
  try {
    // Get the landmarks for the first detected hand
    const landmarks = results.multiHandLandmarks[0];
    
    // Skip if no landmarks
    if (!landmarks || landmarks.length < 21) {
      currentGesture = "none";
      detectionConfidence = 0;
      return;
    }
    
    // Simplified victory detection for more reliable results
    const isVictory = detectVictorySignSimple(landmarks);
    
    if (isVictory.detected) {
      // Update consecutive frames with a victory gesture
      consecutiveVictoryFrames++;
      
      // Only require 1 frame for high sensitivity
      let requiredFrames = 1;
      
      // Set current gesture as victory if we have enough consecutive frames
      if (consecutiveVictoryFrames >= requiredFrames) {
        currentGesture = "victory";
        detectionConfidence = isVictory.confidence;
        
        // Check for cooldown period
        const currentTime = Date.now();
        if (currentTime - lastDetectionTime > DETECTION_COOLDOWN_MS) {
          lastDetectionTime = currentTime;
        }
      }
    } else {
      // Reset if not a victory sign
      currentGesture = "none";
      detectionConfidence = 0;
      consecutiveVictoryFrames = 0;
    }
  } catch (error) {
    console.error('Error in hand result processing:', error);
    currentGesture = "none";
    detectionConfidence = 0;
  }
};

// Very simplified victory sign detection that is more reliable
const detectVictorySignSimple = (landmarks: any[]): { detected: boolean; confidence: number } => {
  try {
    // Basic check if we have valid landmarks
    if (!landmarks || landmarks.length < 21) {
      return { detected: false, confidence: 0 };
    }
    
    // Key landmarks we need
    const indexTip = landmarks[8];   // Index finger tip
    const middleTip = landmarks[12]; // Middle finger tip 
    const ringTip = landmarks[16];   // Ring finger tip
    const pinkyTip = landmarks[20];  // Pinky tip
    const wrist = landmarks[0];      // Wrist position
    
    // Check if index and middle fingers are higher (lower y) than wrist
    const indexRaised = indexTip.y < wrist.y - 0.1;
    const middleRaised = middleTip.y < wrist.y - 0.1;
    
    // Check if ring and pinky are lower than index and middle
    const ringLower = ringTip.y > middleTip.y + 0.03;
    const pinkyLower = pinkyTip.y > middleTip.y + 0.03;
    
    // Calculate distance between index and middle fingertips
    const tipDistance = Math.sqrt(
      Math.pow(indexTip.x - middleTip.x, 2) + 
      Math.pow(indexTip.y - middleTip.y, 2)
    );
    
    // Simple criteria for V sign: 
    // 1. Index and middle fingers need to be raised
    // 2. Ring and pinky should be lower
    // 3. Index and middle tips should be somewhat separated
    const isVictory = 
      indexRaised && 
      middleRaised && 
      (ringLower || pinkyLower) &&
      tipDistance > 0.03;
    
    // Calculate confidence - start with high base confidence
    let confidence = 0;
    
    if (isVictory) {
      confidence = 0.7; // Start with 70% base confidence
      
      // Add confidence if fingers are clearly separated
      if (tipDistance > 0.05) confidence += 0.1;
      
      // Add confidence if ring and pinky are clearly lower
      if (ringLower && pinkyLower) confidence += 0.2;
      
      // Cap at 1.0
      confidence = Math.min(confidence, 1.0);
    }
    
    return { 
      detected: isVictory, 
      confidence: confidence 
    };
  } catch (error) {
    console.error('Error in simplified victory detection:', error);
    return { detected: false, confidence: 0 };
  }
};

// Enhanced detection function with retry logic
export const detectGesture = async (videoElement: HTMLVideoElement | null): Promise<{ 
  gesture: GestureType; 
  confidence: number; 
}> => {
  // Return empty result if no video element
  if (!videoElement) {
    return { gesture: "none", confidence: 0 };
  }
  
  // Initialize MediaPipe if not already done
  if (!hands || !isModelInitialized) {
    const success = await initializeHandTracking();
    if (success) {
      setupMediaPipeCamera(videoElement);
    }
  }
  
  // Return current detection state - this is updated by the MediaPipe callback
  return { 
    gesture: currentGesture, 
    confidence: detectionConfidence 
  };
};

// Improved function to capture high-quality image with debug info
export const captureImage = (videoElement: HTMLVideoElement | null): string | null => {
  if (!videoElement) return null;
  
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    // Draw the video frame to the canvas
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Draw hand landmarks if available
    if (lastResults && lastResults.multiHandLandmarks && lastResults.multiHandLandmarks.length > 0) {
      const landmarks = lastResults.multiHandLandmarks[0];
      
      // Draw connection lines for fingers to make the gesture more visible
      const fingerConnections = [
        [0, 1, 2, 3, 4], // thumb
        [0, 5, 6, 7, 8], // index 
        [0, 9, 10, 11, 12], // middle
        [0, 13, 14, 15, 16], // ring
        [0, 17, 18, 19, 20] // pinky
      ];
      
      // Draw the connections
      fingerConnections.forEach(points => {
        if (points.length < 2) return;
        
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const point = landmarks[points[i]];
          if (i === 0) {
            ctx.moveTo(point.x * canvas.width, point.y * canvas.height);
          } else {
            ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
          }
        }
        ctx.strokeStyle = currentGesture === "victory" ? "rgba(255, 0, 0, 0.7)" : "rgba(0, 255, 0, 0.7)";
        ctx.lineWidth = 4;
        ctx.stroke();
      });
      
      // Draw dots at landmark positions
      landmarks.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = currentGesture === "victory" ? "rgba(255, 0, 0, 0.8)" : "rgba(0, 255, 0, 0.8)";
        ctx.fill();
      });
    }
    
    // Add timestamp and location info with background
    const timestamp = new Date().toLocaleString();
    const location = "Primary Camera";
    
    // Add semi-transparent black overlay at the bottom
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
    
    // Add text
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(`Time: ${timestamp}`, 10, canvas.height - 50);
    ctx.fillText(`Location: ${location}`, 10, canvas.height - 20);
    
    // Add emergency alert text for victory gestures
    if (currentGesture === "victory") {
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "red";
      ctx.fillText("⚠️ EMERGENCY ALERT - V SIGN DETECTED ⚠️", 10, canvas.height - 80);
    }
    
    // Convert to high-quality JPEG
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch (error) {
    console.error('Error capturing image:', error);
    return null;
  }
};

// Function to download image automatically and to a fixed location
export const downloadImage = (imageData: string | null, gesture: GestureType): boolean => {
  if (!imageData) return false;
  
  try {
    const link = document.createElement("a");
    link.href = imageData;
    
    // Generate a more descriptive filename
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}-${date.getMinutes()
      .toString().padStart(2, '0')}-${date.getSeconds().toString().padStart(2, '0')}`;
    
    // Create filename with timestamp for uniqueness
    link.download = `emergency-${gesture}-alert-${formattedDate}-${formattedTime}.jpg`;
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

// Function to reset the detection cooldown and state
export const resetDetectionCooldown = (): void => {
  lastDetectionTime = 0;
  consecutiveVictoryFrames = 0;
  currentGesture = "none";
  detectionConfidence = 0;
  console.log("Detection reset: cooldown and consecutive frames reset");
};

// Function to simulate model training (for UI feedback)
export const simulateModelTraining = async (callback?: (progress: number) => void): Promise<boolean> => {
  try {
    // Reset detection counters
    consecutiveVictoryFrames = 0;
    currentGesture = "none";
    detectionConfidence = 0;
    
    // Show progress for UX
    if (callback) {
      for (let step = 0; step <= 10; step++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        callback((step / 10) * 100);
      }
    }
    
    // Initialize MediaPipe Hands
    const success = await initializeHandTracking();
    
    // Reset cooldown to allow immediate detection
    resetDetectionCooldown();
    return success;
  } catch (error) {
    console.error("Error during model initialization:", error);
    return false;
  }
};

// Set detection sensitivity
export const setDetectionSensitivity = (level: 'low' | 'medium' | 'high'): void => {
  sensitivityLevel = level;
  
  // Update actual detection parameters based on sensitivity
  if (hands && isModelInitialized) {
    let detectionConfidence = 0.5;
    let trackingConfidence = 0.5;
    
    if (level === 'high') {
      detectionConfidence = 0.3;
      trackingConfidence = 0.3;
    } else if (level === 'medium') {
      detectionConfidence = 0.5;
      trackingConfidence = 0.5;
    } else {
      detectionConfidence = 0.7;
      trackingConfidence = 0.7;
    }
    
    try {
      // Call setOptions directly without chaining promises
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: detectionConfidence,
        minTrackingConfidence: trackingConfidence
      });
      console.log(`Detection sensitivity updated to ${level}`);
    } catch (error) {
      console.error('Error updating sensitivity:', error);
    }
  }
  
  consecutiveVictoryFrames = 0;
  console.log(`Detection sensitivity set to ${level}`);
};
