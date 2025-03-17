
// This file contains utility functions for gesture detection
import * as XLSX from 'xlsx';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';

// GestureTypes supported by the detection system
export type GestureType = 'none' | 'victory' | 'thumbs_up' | 'open_palm' | 'pointing' | 'fist' | 'manual';

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
  landmarks?: any[];
}

export interface GestureAlert {
  id: string;
  timestamp: Date;
  gestureType: GestureType;
  confidence: number;
  imageData: string | null;
  location: string;
  processed: boolean;
}

// Global state for the hand detection system
const state = {
  model: null as Hands | null,
  camera: null as any,
  lastVideoTime: -1,
  results: null as any,
  modelReady: false,
  handedness: null as string | null,
  currentGesture: 'none' as GestureType,
  confidence: 0,
  consecutiveFrames: 0,
  cooldownActive: false,
  lastDetectionTime: 0,
  sensitivity: 'high' as 'low' | 'medium' | 'high'
};

// Initialization flag to prevent multiple initializations
let initializing = false;

// Initialize the MediaPipe Hands model
const initializeHands = async () => {
  if (initializing) {
    console.log("Hands initialization already in progress");
    return;
  }
  
  initializing = true;
  console.log("Initializing MediaPipe Hands...");
  
  try {
    // Create a new Hands object
    if (!state.model) {
      state.model = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        }
      });
    }
    
    // Configure the model
    await state.model.setOptions({
      selfieMode: true,
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    // Setup the callback for results
    state.model.onResults((results: any) => {
      state.results = results;
      processResults(results);
    });
    
    state.modelReady = true;
    initializing = false;
    console.log("MediaPipe Hands initialized successfully");
    return true;
  } catch (error) {
    initializing = false;
    state.modelReady = false;
    console.error("Error initializing MediaPipe Hands:", error);
    throw error;
  }
};

// Process the results from the hand detection model
const processResults = (results: any) => {
  if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    state.currentGesture = 'none';
    state.confidence = 0;
    state.consecutiveFrames = 0;
    return;
  }
  
  const landmarks = results.multiHandLandmarks[0];
  const handedness = results.multiHandedness[0].label;
  state.handedness = handedness;
  
  // Calculate finger states
  const fingerExtended = calculateFingerExtended(landmarks);
  
  // Determine gesture based on finger states
  const result = determineGesture(fingerExtended, landmarks);
  
  // Only change gesture if confidence is high enough
  if (result.confidence > 0.6) {
    if (result.gesture === state.currentGesture) {
      state.consecutiveFrames++;
    } else {
      state.consecutiveFrames = 0;
    }
    
    // Apply sensitivity settings
    let requiredFrames = 1;
    if (state.sensitivity === 'medium') requiredFrames = 2;
    if (state.sensitivity === 'low') requiredFrames = 3;
    
    if (state.consecutiveFrames >= requiredFrames) {
      state.currentGesture = result.gesture;
      state.confidence = result.confidence;
    }
  }
};

// Calculate which fingers are extended based on landmarks
const calculateFingerExtended = (landmarks: any[]) => {
  // Simplified finger extension detection based on landmark positions
  const thumbExtended = isThumbExtended(landmarks);
  const indexExtended = isFingerExtended(landmarks, 5, 6, 8);
  const middleExtended = isFingerExtended(landmarks, 9, 10, 12);
  const ringExtended = isFingerExtended(landmarks, 13, 14, 16);
  const pinkyExtended = isFingerExtended(landmarks, 17, 18, 20);
  
  return {
    thumb: thumbExtended,
    index: indexExtended,
    middle: middleExtended,
    ring: ringExtended,
    pinky: pinkyExtended
  };
};

// Check if thumb is extended
const isThumbExtended = (landmarks: any[]) => {
  // Simplified thumb extension detection
  const thumbTip = landmarks[4];
  const thumbBase = landmarks[2];
  const palmBase = landmarks[0];
  
  const distance = calculateDistance(thumbTip, palmBase);
  const baseDistance = calculateDistance(thumbBase, palmBase);
  
  return distance > baseDistance * 1.5;
};

// Check if a finger is extended
const isFingerExtended = (landmarks: any[], baseIdx: number, midIdx: number, tipIdx: number) => {
  const fingerBase = landmarks[baseIdx];
  const fingerMid = landmarks[midIdx];
  const fingerTip = landmarks[tipIdx];
  const palmBase = landmarks[0];
  
  // Calculate distances
  const tipToBase = calculateDistance(fingerTip, palmBase);
  const midToBase = calculateDistance(fingerMid, palmBase);
  
  // Finger is extended if tip is farther from palm than middle joint
  return tipToBase > midToBase * 1.2;
};

// Calculate distance between two 3D points
const calculateDistance = (point1: any, point2: any) => {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  const dz = point1.z - point2.z;
  
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
};

// Determine the gesture based on finger states
const determineGesture = (fingerExtended: any, landmarks: any[]): GestureResult => {
  const { thumb, index, middle, ring, pinky } = fingerExtended;
  
  // Victory sign: index and middle fingers extended, others closed
  if (index && middle && !thumb && !ring && !pinky) {
    // Verify V shape
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const angle = calculateAngleBetweenFingers(landmarks[5], indexTip, middleTip);
    
    if (angle > 0.3 && angle < 0.7) {
      return { gesture: 'victory', confidence: 0.9, landmarks };
    }
    return { gesture: 'victory', confidence: 0.7, landmarks };
  }
  
  // Thumbs up: only thumb extended
  if (thumb && !index && !middle && !ring && !pinky) {
    return { gesture: 'thumbs_up', confidence: 0.8, landmarks };
  }
  
  // Open palm: all fingers extended
  if (thumb && index && middle && ring && pinky) {
    return { gesture: 'open_palm', confidence: 0.8, landmarks };
  }
  
  // Pointing: only index finger extended
  if (!thumb && index && !middle && !ring && !pinky) {
    return { gesture: 'pointing', confidence: 0.85, landmarks };
  }
  
  // Fist: no fingers extended
  if (!thumb && !index && !middle && !ring && !pinky) {
    return { gesture: 'fist', confidence: 0.75, landmarks };
  }
  
  // Unknown gesture
  return { gesture: 'none', confidence: 0.5, landmarks };
};

// Calculate angle between fingers
const calculateAngleBetweenFingers = (palmPoint: any, finger1Tip: any, finger2Tip: any) => {
  // Create vectors from palm to fingertips
  const vector1 = {
    x: finger1Tip.x - palmPoint.x,
    y: finger1Tip.y - palmPoint.y
  };
  
  const vector2 = {
    x: finger2Tip.x - palmPoint.x,
    y: finger2Tip.y - palmPoint.y
  };
  
  // Normalize vectors
  const length1 = Math.sqrt(vector1.x*vector1.x + vector1.y*vector1.y);
  const length2 = Math.sqrt(vector2.x*vector2.x + vector2.y*vector2.y);
  
  vector1.x /= length1;
  vector1.y /= length1;
  vector2.x /= length2;
  vector2.y /= length2;
  
  // Calculate dot product
  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
  
  // Calculate angle (0-1 range, where 0 is aligned, 1 is perpendicular)
  return (1 - dotProduct) / 2;
};

// Main detection function - process a video frame
export const detectGesture = async (videoElement: HTMLVideoElement): Promise<GestureResult> => {
  if (state.cooldownActive) {
    return { gesture: state.currentGesture, confidence: state.confidence };
  }
  
  if (!state.modelReady) {
    try {
      await initializeHands();
    } catch (error) {
      console.error("Failed to initialize hands:", error);
      return { gesture: 'none', confidence: 0 };
    }
  }
  
  if (videoElement && state.model && videoElement.readyState === 4) {
    try {
      // Only process new frames
      if (videoElement.currentTime !== state.lastVideoTime) {
        state.lastVideoTime = videoElement.currentTime;
        
        // Send the frame to the model for processing
        await state.model.send({ image: videoElement });
      }
    } catch (error) {
      console.error("Error detecting gesture:", error);
    }
  }
  
  return {
    gesture: state.currentGesture,
    confidence: state.confidence
  };
};

// Reset the cooldown state
export const resetDetectionCooldown = () => {
  state.cooldownActive = false;
  state.consecutiveFrames = 0;
  console.log("Detection cooldown reset");
};

// Capture a still image from the video
export const captureImage = (videoElement: HTMLVideoElement): string | null => {
  if (!videoElement) {
    console.error("No video element provided for capture");
    return null;
  }
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Failed to get canvas context");
      return null;
    }
    
    // Draw the current video frame to the canvas
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Add timestamp to image
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, canvas.height - 40, 350, 30);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    const timestamp = new Date().toLocaleString();
    ctx.fillText(`Captured: ${timestamp}`, 20, canvas.height - 20);
    
    // Convert to data URL
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error("Error capturing image:", error);
    return null;
  }
};

// Download the captured image
export const downloadImage = (dataUrl: string, gestureName: string): boolean => {
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `emergency-${gestureName}-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error("Error downloading image:", error);
    return false;
  }
};

// Export data to Excel
export const exportToExcel = (data: GestureAlert[]): void => {
  try {
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Process data for Excel
    const processedData = data.map(alert => ({
      'Alert ID': alert.id,
      'Date & Time': alert.timestamp.toLocaleString(),
      'Gesture Type': alert.gestureType,
      'Confidence': `${(alert.confidence * 100).toFixed(0)}%`,
      'Location': alert.location,
      'Processed': alert.processed ? 'Yes' : 'No'
    }));
    
    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(processedData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Emergency Alerts');
    
    // Generate Excel file and trigger download
    XLSX.writeFile(wb, `Emergency_Alerts_${new Date().toLocaleDateString()}.xlsx`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
  }
};

// Simulate model training for UI feedback
export const simulateModelTraining = (progressCallback: (progress: number) => void): Promise<boolean> => {
  return new Promise(async (resolve) => {
    try {
      // Initialize the hands model first
      await initializeHands();
      
      // Then show progress simulation
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 5;
        if (progress > 100) {
          progress = 100;
          clearInterval(interval);
          resolve(true);
        }
        progressCallback(progress);
      }, 100);
    } catch (error) {
      console.error("Error in model training:", error);
      progressCallback(100); // Complete the progress bar anyway
      resolve(false);
    }
  });
};

// Set the detection sensitivity
export const setDetectionSensitivity = (level: 'low' | 'medium' | 'high'): void => {
  state.sensitivity = level;
  
  if (!state.model) {
    console.warn("Cannot set sensitivity: model not initialized");
    return;
  }
  
  try {
    // Set different confidence thresholds based on sensitivity level
    state.model.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: level === 'high' ? 0.5 : level === 'medium' ? 0.65 : 0.8,
      minTrackingConfidence: level === 'high' ? 0.5 : level === 'medium' ? 0.65 : 0.8
    });
  } catch (error) {
    console.error("Error setting detection sensitivity:", error);
  }
  
  console.log(`Detection sensitivity set to ${level}`);
};

// Get color for gesture display
export const getGestureColor = (gesture: GestureType): string => {
  switch (gesture) {
    case 'victory':
      return 'text-red-500';
    case 'thumbs_up':
      return 'text-green-500';
    case 'open_palm':
      return 'text-blue-500';
    case 'pointing':
      return 'text-amber-500';
    case 'fist':
      return 'text-purple-500';
    case 'manual':
      return 'text-indigo-500';
    default:
      return 'text-gray-500';
  }
};

// Get display name for gesture
export const getGestureDisplayName = (gesture: GestureType): string => {
  switch (gesture) {
    case 'victory':
      return 'Victory Sign ✌️';
    case 'thumbs_up':
      return 'Thumbs Up 👍';
    case 'open_palm':
      return 'Open Palm ✋';
    case 'pointing':
      return 'Pointing ☝️';
    case 'fist':
      return 'Fist ✊';
    case 'manual':
      return 'Manual Capture 📸';
    default:
      return 'No Gesture';
  }
};
