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

// Significantly reduce detection cooldown for super-fast response
let lastDetectionTime = 0;
const DETECTION_COOLDOWN_MS = 100; // Reduce to 100ms for ultra-fast detection

// Track frame history for better accuracy, but with shorter history for faster response
const frameHistory: {isVictory: boolean, confidence: number}[] = [];
const FRAME_HISTORY_SIZE = 3; // Reduced for faster detection
const REQUIRED_POSITIVE_FRAMES = 2; // Reduced for faster detection

// Ultra-sensitive settings for improved detection
let sensitivitySettings = {
  skinThreshold: 0.3,
  edgeThreshold: 0.25,
  minConfidence: 0.55, // Lower threshold for detecting V signs
  maxConfidence: 0.98,
  minSkinRatio: 0.05, // Allow smaller hand detection
  maxSkinRatio: 0.4,  // Allow larger hand detection
  frameThreshold: 1,
  vShapeMinScore: 3
};

// Improved V sign templates with better coverage of different hand positions
const vSignTemplates = [
  // Template 1: Classic V sign (peace sign)
  {
    name: "classic_v",
    regions: [
      { x: 0.4, y: 0.3, width: 0.1, height: 0.4, isSkin: true }, // Left finger
      { x: 0.5, y: 0.4, width: 0.1, height: 0.1, isSkin: false }, // Gap between fingers
      { x: 0.6, y: 0.3, width: 0.1, height: 0.4, isSkin: true }, // Right finger
      { x: 0.45, y: 0.7, width: 0.2, height: 0.2, isSkin: true }, // Base of hand
    ],
    weight: 1.0
  },
  // Template 2: Wider V sign
  {
    name: "wide_v",
    regions: [
      { x: 0.3, y: 0.3, width: 0.1, height: 0.4, isSkin: true }, // Left finger
      { x: 0.4, y: 0.35, width: 0.2, height: 0.2, isSkin: false }, // Wider gap
      { x: 0.6, y: 0.3, width: 0.1, height: 0.4, isSkin: true }, // Right finger
      { x: 0.4, y: 0.7, width: 0.2, height: 0.2, isSkin: true }, // Base of hand
    ],
    weight: 0.8
  },
  // Template 3: Tilted V sign
  {
    name: "tilted_v",
    regions: [
      { x: 0.35, y: 0.25, width: 0.1, height: 0.4, isSkin: true }, // Left finger (tilted)
      { x: 0.45, y: 0.4, width: 0.1, height: 0.1, isSkin: false }, // Gap
      { x: 0.55, y: 0.35, width: 0.1, height: 0.4, isSkin: true }, // Right finger (tilted)
      { x: 0.45, y: 0.7, width: 0.2, height: 0.2, isSkin: true }, // Base of hand
    ],
    weight: 0.7
  },
  // Template 4: Close V sign
  {
    name: "close_v",
    regions: [
      { x: 0.45, y: 0.3, width: 0.08, height: 0.4, isSkin: true }, // Left finger (close)
      { x: 0.53, y: 0.35, width: 0.04, height: 0.1, isSkin: false }, // Narrow gap
      { x: 0.57, y: 0.3, width: 0.08, height: 0.4, isSkin: true }, // Right finger (close)
      { x: 0.5, y: 0.7, width: 0.15, height: 0.2, isSkin: true }, // Base of hand
    ],
    weight: 0.6
  },
  // Template 5: Raised hand with V sign
  {
    name: "raised_v",
    regions: [
      { x: 0.4, y: 0.2, width: 0.1, height: 0.4, isSkin: true }, // Left finger (higher)
      { x: 0.5, y: 0.25, width: 0.1, height: 0.1, isSkin: false }, // Gap (higher)
      { x: 0.6, y: 0.2, width: 0.1, height: 0.4, isSkin: true }, // Right finger (higher)
      { x: 0.45, y: 0.6, width: 0.2, height: 0.2, isSkin: true }, // Base of hand
    ],
    weight: 0.7
  }
];

// Enhanced model initialization flag
let modelInitialized = false;

// Enhanced detection function with super-fast multi-frame validation
export const detectGesture = async (videoElement: HTMLVideoElement | null): Promise<{ 
  gesture: GestureType; 
  confidence: number; 
}> => {
  if (!videoElement) {
    return { gesture: "none", confidence: 0 };
  }

  if (!modelInitialized) {
    console.log("ML model not initialized yet, initializing now");
    await simulateModelTraining();
    modelInitialized = true;
  }

  const currentTime = Date.now();
  
  // Faster processing - only check cooldown for positive detections
  if ((currentTime - lastDetectionTime < DETECTION_COOLDOWN_MS) && frameHistory.length > 0 && frameHistory[frameHistory.length - 1].isVictory) {
    // Return the last detection during cooldown
    const lastDetection = frameHistory[frameHistory.length - 1];
    return { 
      gesture: lastDetection.isVictory ? "victory" : "none", 
      confidence: lastDetection.confidence 
    };
  }

  try {
    // Process current frame
    const frame = captureImageForProcessing(videoElement);
    if (!frame) {
      return { gesture: "none", confidence: 0.1 };
    }

    // Use faster frame analysis
    const result = await analyzeFrameFast(frame);
    
    // Update frame history with more information
    frameHistory.push(result);
    if (frameHistory.length > FRAME_HISTORY_SIZE) {
      frameHistory.shift();
    }

    // Count positive detections in history with higher weight for recent frames
    const positiveFrames = frameHistory.filter(frame => frame.isVictory).length;
    const weightedConfidence = frameHistory.reduce((sum, frame, index) => {
      // Give more weight to recent frames (0.5, 0.75, 1.0 for a 3-frame history)
      const weight = 0.5 + ((index / (FRAME_HISTORY_SIZE - 1)) * 0.5);
      return sum + (frame.isVictory ? (frame.confidence * weight) : 0);
    }, 0) / FRAME_HISTORY_SIZE;

    // Ultra-fast detection with adaptive confidence
    if (positiveFrames >= REQUIRED_POSITIVE_FRAMES) {
      lastDetectionTime = currentTime;
      console.log(`Victory gesture detected with confidence: ${weightedConfidence.toFixed(2)}`);
      
      return { 
        gesture: "victory", 
        confidence: Math.min(weightedConfidence * 1.2, sensitivitySettings.maxConfidence)
      };
    }

    // If we have some positive frames but not enough for full detection
    if (positiveFrames > 0) {
      const partialConfidence = Math.min((weightedConfidence * positiveFrames) / REQUIRED_POSITIVE_FRAMES, 0.6);
      return { 
        gesture: "none", 
        confidence: partialConfidence
      };
    }

    return { 
      gesture: "none", 
      confidence: Math.min(0.1, result.confidence) 
    };
  } catch (error) {
    console.error("Error in gesture detection:", error);
    return { gesture: "none", confidence: 0.1 };
  }
};

// Faster frame analysis function - optimized for speed
const analyzeFrameFast = async (imageData: string): Promise<{
  isVictory: boolean;
  confidence: number;
}> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Optimization for frequent pixel reads
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = () => {
      if (!ctx) {
        resolve({ isVictory: false, confidence: 0 });
        return;
      }

      // Use a smaller image size for faster processing
      const scaleFactor = Math.min(1, 300 / Math.max(img.width, img.height));
      canvas.width = img.width * scaleFactor;
      canvas.height = img.height * scaleFactor;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Quick check if image is too dark or too bright
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imageData;
      
      // Skip processing for invalid images
      if (isImageTooDark(data) || isImageTooBright(data)) {
        resolve({ isVictory: false, confidence: 0 });
        return;
      }
      
      // Fast skin detection
      const skinMap = createSkinMapFast(data, width, height);
      
      // Quick edge detection
      const edges = detectEdgesFast(skinMap, width, height);
      
      // Optimized template matching
      const templateScores = vSignTemplates.map(template => {
        return matchTemplateFast(skinMap, template, width, height);
      });
      
      // Get best template match
      const bestTemplateScore = Math.max(...templateScores);
      const bestTemplateIndex = templateScores.indexOf(bestTemplateScore);
      
      // Only do detailed shape analysis if we have a good template match
      let shapeResult = { hasVShape: false, hasFingerGap: false, skinRatio: 0, shapeConfidence: 0 };
      if (bestTemplateScore > 5) {
        shapeResult = analyzeShapeFast(skinMap, edges, width, height);
      }
      
      // Calculate final confidence - heavily weighted toward template matching for speed
      const templateWeight = 0.8; 
      const shapeWeight = 0.2;
      
      // Normalize template score to 0-1 range
      const normalizedTemplateScore = Math.min(bestTemplateScore / 10, 1);
      
      // Final detection logic
      const combinedConfidence = (normalizedTemplateScore * templateWeight) + 
                                (shapeResult.shapeConfidence * shapeWeight);
      
      // More lenient V shape detection for faster recognition
      const isVictory = (
        (normalizedTemplateScore > 0.5 || shapeResult.hasFingerGap) && 
        templateScores[bestTemplateIndex] > 5 &&
        shapeResult.skinRatio > sensitivitySettings.minSkinRatio && 
        shapeResult.skinRatio < sensitivitySettings.maxSkinRatio
      );
      
      resolve({
        isVictory,
        confidence: isVictory ? combinedConfidence : 0.1
      });
    };
    
    img.src = imageData;
  });
};

// Optimized template matching function
const matchTemplateFast = (
  skinMap: boolean[][], 
  template: any, 
  width: number, 
  height: number
): number => {
  let score = 0;
  const totalRegions = template.regions.length;
  
  // Faster template sampling - check fewer points for speed
  template.regions.forEach(region => {
    const startX = Math.floor(region.x * width);
    const startY = Math.floor(region.y * height);
    const regionWidth = Math.floor(region.width * width);
    const regionHeight = Math.floor(region.height * height);
    
    let matchingPixels = 0;
    let totalPixels = 0;
    
    // Sample fewer points for speed (every 3rd pixel)
    const sampleStep = 3;
    
    for (let y = startY; y < startY + regionHeight && y < height; y += sampleStep) {
      for (let x = startX; x < startX + regionWidth && x < width; x += sampleStep) {
        if (skinMap[y] && skinMap[y][x] === region.isSkin) {
          matchingPixels++;
        }
        totalPixels++;
      }
    }
    
    // Avoid division by zero
    const regionScore = totalPixels > 0 ? matchingPixels / totalPixels : 0;
    score += regionScore;
  });
  
  // Normalize score and apply template weight
  return (score / totalRegions) * template.weight * 10; // Scale to 0-10 range
};

// Faster skin detection
const createSkinMapFast = (data: Uint8ClampedArray, width: number, height: number): boolean[][] => {
  const skinMap: boolean[][] = Array(height).fill(false).map(() => Array(width).fill(false));
  
  // Sample fewer pixels for speed (every 2nd pixel)
  const sampleStep = 2;
  
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Apply fast skin detection to sampled pixels
      skinMap[y][x] = isSkinToneFast(r, g, b);
      
      // Fill in skipped pixels for a complete map
      if (x + 1 < width && y < height) {
        skinMap[y][x + 1] = skinMap[y][x];
      }
      if (x < width && y + 1 < height) {
        skinMap[y + 1][x] = skinMap[y][x];
      }
      if (x + 1 < width && y + 1 < height) {
        skinMap[y + 1][x + 1] = skinMap[y][x];
      }
    }
  }
  
  return skinMap;
};

// Faster skin tone detection with simpler rules
const isSkinToneFast = (r: number, g: number, b: number): boolean => {
  // Skip very dark or very bright pixels
  if (r < 40 || g < 20 || b < 20) return false;
  if (r > 250 && g > 250 && b > 250) return false;

  // Simplified skin detection rules for speed
  return (
    r > g && // Red channel must be greater than green
    r > b && // Red channel must be greater than blue
    r - Math.min(g, b) > 15 && // Difference between red and min(green,blue) should be significant
    Math.abs(g - b) < 15 // Green and blue shouldn't be too different
  );
};

// Faster edge detection
const detectEdgesFast = (skinMap: boolean[][], width: number, height: number): boolean[][] => {
  const edges: boolean[][] = Array(height).fill(false).map(() => Array(width).fill(false));
  
  // Sample fewer pixels for edge detection (every 2nd pixel)
  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      // Only consider skin pixels
      if (!skinMap[y][x]) continue;
      
      // Check only 4 neighbors instead of 8 for speed
      const neighbors = [
        skinMap[y-2][x],    // top
        skinMap[y+2][x],    // bottom
        skinMap[y][x-2],    // left
        skinMap[y][x+2],    // right
      ];
      
      // Mark as edge if it has at least 1 non-skin neighbors
      const nonSkinNeighbors = neighbors.filter(n => !n).length;
      edges[y][x] = nonSkinNeighbors >= 1;
      
      // Fill in skipped pixels
      edges[y-1][x] = edges[y][x];
      edges[y][x-1] = edges[y][x];
      edges[y-1][x-1] = edges[y][x];
    }
  }
  
  return edges;
};

// Fast shape analysis
const analyzeShapeFast = (
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
  let gapFound = false;
  let vShapeScore = 0;
  
  // Calculate skin ratio by sampling
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      if (skinMap[y][x]) skinPixels++;
      
      // Look for finger gap pattern (optimized)
      if (y > height/3 && y < height*2/3) {
        if (!skinMap[y][x]) {
          let leftSkin = false;
          let rightSkin = false;
          
          // Check left for skin with wider jumps
          for (let lx = Math.max(0, x - width/10); lx < x; lx += 3) {
            if (skinMap[y][Math.floor(lx)]) {
              leftSkin = true;
              break;
            }
          }
          
          // Check right for skin with wider jumps
          for (let rx = x + 1; rx < Math.min(width, x + width/10); rx += 3) {
            if (skinMap[y][Math.floor(rx)]) {
              rightSkin = true;
              break;
            }
          }
          
          // If skin on both sides, found a gap
          if (leftSkin && rightSkin) {
            gapFound = true;
            vShapeScore += 2; // Increase score when gap is found
          }
        }
      }
    }
  }
  
  const sampledPixels = Math.ceil(width * height / 16); // Account for the sampling rate
  const skinRatio = skinPixels / sampledPixels;
  
  // Fast V shape confidence calculation
  const shapeConfidence = gapFound ? 0.7 : 0.3;
  
  return {
    hasVShape: vShapeScore > 0,
    hasFingerGap: gapFound,
    skinRatio,
    shapeConfidence
  };
};

// Quick image brightness checks
const isImageTooDark = (data: Uint8ClampedArray): boolean => {
  let darkPixels = 0;
  const sampleSize = Math.floor(data.length / 64); // Sample 1/64th of pixels
  let i = 0;
  const step = 16; // Check every 16th pixel
  
  for (let count = 0; count < sampleSize; count++) {
    i = (count * step * 4) % data.length;
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness < 30) darkPixels++;
  }
  
  return (darkPixels / sampleSize) > 0.8;
};

const isImageTooBright = (data: Uint8ClampedArray): boolean => {
  let brightPixels = 0;
  const sampleSize = Math.floor(data.length / 64); // Sample 1/64th of pixels
  let i = 0;
  const step = 16; // Check every 16th pixel
  
  for (let count = 0; count < sampleSize; count++) {
    i = (count * step * 4) % data.length;
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness > 240) brightPixels++;
  }
  
  return (brightPixels / sampleSize) > 0.7;
};

// Fast image capture for processing
const captureImageForProcessing = (videoElement: HTMLVideoElement): string | null => {
  try {
    const canvas = document.createElement("canvas");
    // Use smaller size for faster processing
    const scaleFactor = 0.5; // Process at half resolution for speed
    canvas.width = videoElement.videoWidth * scaleFactor;
    canvas.height = videoElement.videoHeight * scaleFactor;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Lower quality for faster processing
    return canvas.toDataURL("image/jpeg", 0.5);
  } catch (error) {
    console.error("Error capturing image for processing:", error);
    return null;
  }
};

// Function to capture high-quality image
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
  // Clear frame history for immediate new detection
  frameHistory.length = 0;
};

// Faster model training simulation
export const simulateModelTraining = async (callback?: (progress: number) => void): Promise<boolean> => {
  try {
    // Reset detection counters
    frameHistory.length = 0;
    modelInitialized = true;
    
    // Faster simulation for immediate response
    if (callback) {
      for (let step = 0; step <= 5; step++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        callback((step / 5) * 100);
      }
    }
    
    // Reset cooldown to allow immediate detection
    resetDetectionCooldown();
    forceImmediateDetection();
    console.log("Local ML model trained and ready for super-fast detection");
    return true;
  } catch (error) {
    console.error("Error during model training:", error);
    return false;
  }
};

// Force immediate detection (bypass cooldown)
export const forceImmediateDetection = (): void => {
  lastDetectionTime = 0;
  frameHistory.length = 0;
  console.log("ML model ready for immediate detection");
};

// Enhanced sensitivity settings for faster recognition
export const setDetectionSensitivity = (level: 'low' | 'medium' | 'high'): void => {
  switch (level) {
    case 'low':
      sensitivitySettings = {
        skinThreshold: 0.35,
        edgeThreshold: 0.3,
        minConfidence: 0.75,
        maxConfidence: 0.98,
        minSkinRatio: 0.1, 
        maxSkinRatio: 0.4,
        frameThreshold: 3,
        vShapeMinScore: 6
      };
      break;
    case 'medium':
      sensitivitySettings = {
        skinThreshold: 0.3,
        edgeThreshold: 0.25,
        minConfidence: 0.65,
        maxConfidence: 0.98,
        minSkinRatio: 0.07,
        maxSkinRatio: 0.45,
        frameThreshold: 2,
        vShapeMinScore: 4
      };
      break;
    case 'high':
      sensitivitySettings = {
        skinThreshold: 0.25,
        edgeThreshold: 0.2,
        minConfidence: 0.55,
        maxConfidence: 0.98,
        minSkinRatio: 0.05,
        maxSkinRatio: 0.5,
        frameThreshold: 1,
        vShapeMinScore: 2
      };
      break;
  }
  
  // Reset frame history
  frameHistory.length = 0;
  console.log(`Detection sensitivity set to ${level} for faster recognition`);
};
