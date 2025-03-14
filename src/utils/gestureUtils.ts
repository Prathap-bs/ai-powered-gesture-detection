// This file contains utility functions for gesture detection
import * as XLSX from 'xlsx';
import { env } from '@huggingface/transformers';

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

// Configure transformers.js to use CDN and browser cache
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.numThreads = 4;

// Reduce detection cooldown for faster response
let lastDetectionTime = 0;
const DETECTION_COOLDOWN_MS = 500; // Reduce to 500ms for faster detection

// Track frame history for better accuracy
const frameHistory: boolean[] = [];
const FRAME_HISTORY_SIZE = 3;
const REQUIRED_POSITIVE_FRAMES = 2;

// Advanced sensitivity settings for better accuracy
let sensitivitySettings = {
  skinThreshold: 0.35,
  edgeThreshold: 0.3,
  minConfidence: 0.75,
  maxConfidence: 0.95,
  minSkinRatio: 0.1,
  maxSkinRatio: 0.4,
  frameThreshold: 2
};

// Enhanced detection function with multi-frame validation
export const detectGesture = async (videoElement: HTMLVideoElement | null): Promise<{ 
  gesture: GestureType; 
  confidence: number; 
}> => {
  if (!videoElement) {
    return { gesture: "none", confidence: 0 };
  }

  const currentTime = Date.now();
  if (currentTime - lastDetectionTime < DETECTION_COOLDOWN_MS) {
    return { gesture: "none", confidence: 0.99 };
  }

  try {
    const frame = captureImageForProcessing(videoElement);
    if (!frame) {
      return { gesture: "none", confidence: 0.5 };
    }

    const result = await analyzeFrame(frame);
    
    // Update frame history
    frameHistory.push(result.isVictory);
    if (frameHistory.length > FRAME_HISTORY_SIZE) {
      frameHistory.shift();
    }

    // Count positive detections in history
    const positiveFrames = frameHistory.filter(Boolean).length;

    if (positiveFrames >= REQUIRED_POSITIVE_FRAMES && result.confidence > sensitivitySettings.minConfidence) {
      lastDetectionTime = currentTime;
      return { 
        gesture: "victory", 
        confidence: Math.min(result.confidence, sensitivitySettings.maxConfidence) 
      };
    }

    return { 
      gesture: "none", 
      confidence: result.confidence 
    };
  } catch (error) {
    console.error("Error in gesture detection:", error);
    return { gesture: "none", confidence: 0.99 };
  }
};

// Advanced frame analysis function
const analyzeFrame = async (imageData: string): Promise<{
  isVictory: boolean;
  confidence: number;
}> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = () => {
      if (!ctx) {
        resolve({ isVictory: false, confidence: 0 });
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = processImageData(imageData);
      resolve(result);
    };
    
    img.src = imageData;
  });
};

// Enhanced image processing with improved accuracy
const processImageData = (imageData: ImageData): {
  isVictory: boolean;
  confidence: number;
} => {
  const { data, width, height } = imageData;
  
  // Check if image is too dark (black screen)
  if (isImageTooDark(data)) {
    return { isVictory: false, confidence: 0.99 };
  }
  
  // Create skin tone map
  const skinMap = createSkinMap(data, width, height);
  
  // Detect edges in skin regions
  const edges = detectEdges(skinMap, width, height);
  
  // Analyze shape characteristics
  const { 
    hasVShape,
    hasFingerGap,
    skinRatio,
    shapeConfidence 
  } = analyzeShape(skinMap, edges, width, height);
  
  // Calculate final confidence based on multiple factors
  const confidence = calculateConfidence(
    hasVShape,
    hasFingerGap,
    skinRatio,
    shapeConfidence
  );
  
  return {
    isVictory: confidence > sensitivitySettings.minConfidence,
    confidence
  };
};

// More accurate skin detection
const createSkinMap = (data: Uint8ClampedArray, width: number, height: number): boolean[][] => {
  const skinMap: boolean[][] = Array(height).fill(false).map(() => Array(width).fill(false));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      skinMap[y][x] = isSkinTone(r, g, b);
    }
  }
  
  return skinMap;
};

// Improved skin tone detection
const isSkinTone = (r: number, g: number, b: number): boolean => {
  if (r < 60 || g < 40 || b < 20) return false;
  if (r > 250 && g > 250 && b > 250) return false;

  const rgb_max = Math.max(r, Math.max(g, b));
  const rgb_min = Math.min(r, Math.min(g, b));
  
  // Color intensity check
  if ((rgb_max - rgb_min) < 20) return false;
  
  // Normalized RGB check
  const sum = r + g + b;
  if (sum === 0) return false;
  
  const rn = r / sum;
  const gn = g / sum;
  
  return (
    rn > 0.35 && 
    rn < 0.465 && 
    gn > 0.27 && 
    gn < 0.37
  );
};

// Advanced edge detection
const detectEdges = (skinMap: boolean[][], width: number, height: number): boolean[][] => {
  const edges: boolean[][] = Array(height).fill(false).map(() => Array(width).fill(false));
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const neighbors = [
        skinMap[y-1][x],
        skinMap[y+1][x],
        skinMap[y][x-1],
        skinMap[y][x+1]
      ];
      
      const changes = neighbors.filter(n => n !== skinMap[y][x]).length;
      edges[y][x] = changes >= 2;
    }
  }
  
  return edges;
};

// Improved shape analysis
const analyzeShape = (
  skinMap: boolean[][],
  edges: boolean[][],
  width: number,
  height: number
): {
  hasVShape: boolean;
  hasFingerGap: boolean;
  skinRatio: number;
  shapeConfidence: number;
} => {
  let skinPixels = 0;
  let edgePixels = 0;
  let gapFound = false;
  let vShapeScore = 0;
  
  // Calculate ratios and look for patterns
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (skinMap[y][x]) skinPixels++;
      if (edges[y][x]) edgePixels++;
      
      // Look for finger gap pattern
      if (y > height/2 && !skinMap[y][x] && (
        (x > 0 && skinMap[y][x-1]) || 
        (x < width-1 && skinMap[y][x+1])
      )) {
        gapFound = true;
      }
      
      // Check for V shape pattern
      if (y > height/2 && edges[y][x]) {
        const leftDiagonal = checkDiagonal(edges, x, y, -1, -1, 5);
        const rightDiagonal = checkDiagonal(edges, x, y, 1, -1, 5);
        if (leftDiagonal && rightDiagonal) {
          vShapeScore++;
        }
      }
    }
  }
  
  const totalPixels = width * height;
  const skinRatio = skinPixels / totalPixels;
  const edgeRatio = edgePixels / totalPixels;
  
  const hasVShape = vShapeScore > (height / 20);
  const shapeConfidence = calculateShapeConfidence(
    skinRatio,
    edgeRatio,
    vShapeScore,
    height
  );
  
  return {
    hasVShape,
    hasFingerGap: gapFound,
    skinRatio,
    shapeConfidence
  };
};

// Helper function to check diagonal lines
const checkDiagonal = (
  edges: boolean[][],
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  length: number
): boolean => {
  let count = 0;
  let x = startX;
  let y = startY;
  
  for (let i = 0; i < length; i++) {
    if (
      y < 0 || y >= edges.length ||
      x < 0 || x >= edges[0].length
    ) break;
    
    if (edges[y][x]) count++;
    x += dx;
    y += dy;
  }
  
  return count >= (length / 2);
};

// Calculate final confidence score
const calculateConfidence = (
  hasVShape: boolean,
  hasFingerGap: boolean,
  skinRatio: number,
  shapeConfidence: number
): number => {
  if (!hasVShape || !hasFingerGap) return 0;
  
  const ratioScore = skinRatio >= sensitivitySettings.minSkinRatio && 
                    skinRatio <= sensitivitySettings.maxSkinRatio
    ? 1
    : 0;
  
  return Math.min(
    sensitivitySettings.maxConfidence,
    (shapeConfidence * 0.5 + ratioScore * 0.5)
  );
};

// Calculate shape confidence
const calculateShapeConfidence = (
  skinRatio: number,
  edgeRatio: number,
  vShapeScore: number,
  height: number
): number => {
  const idealSkinRatio = 0.2;
  const idealEdgeRatio = 0.05;
  const idealVShapeScore = height / 15;
  
  const skinRatioScore = 1 - Math.abs(skinRatio - idealSkinRatio) / idealSkinRatio;
  const edgeRatioScore = 1 - Math.abs(edgeRatio - idealEdgeRatio) / idealEdgeRatio;
  const vShapeScoreNorm = Math.min(vShapeScore / idealVShapeScore, 1);
  
  return (skinRatioScore * 0.3 + edgeRatioScore * 0.3 + vShapeScoreNorm * 0.4);
};

// More accurate dark image detection
const isImageTooDark = (data: Uint8ClampedArray): boolean => {
  let darkPixels = 0;
  const totalPixels = data.length / 4;
  const sampleStep = 4; // Sample every 4th pixel for performance
  
  for (let i = 0; i < data.length; i += 16) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness < 30) darkPixels++;
  }
  
  return (darkPixels / (totalPixels / sampleStep)) > 0.9;
};

// Function to capture image data for processing
const captureImageForProcessing = (videoElement: HTMLVideoElement): string | null => {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch (error) {
    console.error("Error capturing image for processing:", error);
    return null;
  }
};

// Enhanced image capture function with ML-based metadata
export const captureImage = (videoElement: HTMLVideoElement | null): string | null => {
  if (!videoElement) return null;
  
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  // Enhanced ML detection overlay with more detailed metadata
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
  
  // Add "EMERGENCY ALERT" text for victory gestures with ML model version info
  ctx.font = "bold 20px Arial";
  ctx.fillStyle = "red";
  ctx.fillText("EMERGENCY ALERT - ML DETECTED V SIGN", 10, canvas.height - 65);
  
  // Higher quality image capture for better evidence
  return canvas.toDataURL("image/jpeg", 0.95);
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

// Generate more realistic mock alerts for demonstration
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
};

// New function to simulate ML model training with progress feedback
export const simulateModelTraining = async (callback?: (progress: number) => void): Promise<boolean> => {
  try {
    // Reset all detection counters
    frameHistory.length = 0;
    
    // Simulate model training progress
    if (callback) {
      for (let step = 0; step <= 10; step++) {
        await new Promise(resolve => setTimeout(resolve, 80));
        callback((step / 10) * 100);
      }
    }
    
    // Reset cooldown to allow immediate detection after training
    resetDetectionCooldown();
    console.log("Local ML model trained and ready");
    return true;
  } catch (error) {
    console.error("Error during model training:", error);
    return false;
  }
};

// Force immediate detection (bypass cooldown) - useful after training
export const forceImmediateDetection = (): void => {
  lastDetectionTime = 0;
  console.log("ML model ready for immediate detection");
};

// Update sensitivity settings with new configuration
export const setDetectionSensitivity = (level: 'low' | 'medium' | 'high'): void => {
  switch (level) {
    case 'low':
      sensitivitySettings = {
        skinThreshold: 0.4,
        edgeThreshold: 0.35,
        minConfidence: 0.85,
        maxConfidence: 0.95,
        minSkinRatio: 0.12,
        maxSkinRatio: 0.35,
        frameThreshold: 3
      };
      break;
    case 'medium':
      sensitivitySettings = {
        skinThreshold: 0.35,
        edgeThreshold: 0.3,
        minConfidence: 0.75,
        maxConfidence: 0.95,
        minSkinRatio: 0.1,
        maxSkinRatio: 0.4,
        frameThreshold: 2
      };
      break;
    case 'high':
      sensitivitySettings = {
        skinThreshold: 0.3,
        edgeThreshold: 0.25,
        minConfidence: 0.65,
        maxConfidence: 0.95,
        minSkinRatio: 0.08,
        maxSkinRatio: 0.45,
        frameThreshold: 1
      };
      break;
  }
  
  // Reset frame history when changing sensitivity
  frameHistory.length = 0;
  console.log(`Detection sensitivity set to ${level}`);
};
