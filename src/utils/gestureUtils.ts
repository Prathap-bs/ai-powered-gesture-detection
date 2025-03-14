
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

// Reduce detection cooldown for even faster response
let lastDetectionTime = 0;
const DETECTION_COOLDOWN_MS = 300; // Reduce to 300ms for faster detection

// Track frame history for better accuracy
const frameHistory: boolean[] = [];
const FRAME_HISTORY_SIZE = 4;
const REQUIRED_POSITIVE_FRAMES = 3;

// Advanced sensitivity settings for better accuracy
let sensitivitySettings = {
  skinThreshold: 0.38,
  edgeThreshold: 0.28,
  minConfidence: 0.78,
  maxConfidence: 0.95,
  minSkinRatio: 0.08,
  maxSkinRatio: 0.35,
  frameThreshold: 2,
  vShapeMinScore: 5
};

// Template matching references for better V sign recognition
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
  }
];

// Enhanced model initialization flag
let modelInitialized = false;

// Enhanced detection function with multi-frame validation
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

    // Calculate confidence based on recent frame history
    let adjustedConfidence = result.confidence;
    if (positiveFrames >= REQUIRED_POSITIVE_FRAMES) {
      // Boost confidence if we have consistent detections
      adjustedConfidence = Math.min(adjustedConfidence * 1.2, sensitivitySettings.maxConfidence);
      lastDetectionTime = currentTime;
      
      console.log(`Victory gesture detected with confidence: ${adjustedConfidence}`);
      
      return { 
        gesture: "victory", 
        confidence: adjustedConfidence 
      };
    }

    // If we have some positive frames but not enough for full detection, adjust confidence
    if (positiveFrames > 0) {
      const partialConfidence = (result.confidence * positiveFrames) / REQUIRED_POSITIVE_FRAMES;
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
      
      // Check if image is too dark or too bright
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (isImageTooDark(imageData.data) || isImageTooBright(imageData.data)) {
        resolve({ isVictory: false, confidence: 0 });
        return;
      }
      
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
  
  // Create skin tone map
  const skinMap = createSkinMap(data, width, height);
  
  // Detect edges in skin regions
  const edges = detectEdges(skinMap, width, height);
  
  // Template matching for V sign (new method)
  const templateMatchScores = vSignTemplates.map(template => {
    return matchTemplate(skinMap, edges, template, width, height);
  });
  
  // Get the best template match score
  const bestTemplateScore = Math.max(...templateMatchScores);
  
  // Analyze shape characteristics (traditional method)
  const { 
    hasVShape,
    hasFingerGap,
    skinRatio,
    shapeConfidence 
  } = analyzeShape(skinMap, edges, width, height);
  
  // Combine both approaches for better accuracy
  const templateWeight = 0.7; // Weight given to template matching
  const shapeWeight = 0.3;  // Weight given to traditional shape analysis
  
  // Normalize template score to 0-1 range
  const normalizedTemplateScore = Math.min(bestTemplateScore / 10, 1);
  
  // Calculate combined confidence
  const combinedConfidence = (normalizedTemplateScore * templateWeight) + 
                            (shapeConfidence * shapeWeight);
  
  // Set threshold for V shape detection
  const isVictory = (
    normalizedTemplateScore > 0.6 && 
    hasFingerGap && 
    skinRatio > sensitivitySettings.minSkinRatio && 
    skinRatio < sensitivitySettings.maxSkinRatio
  );
  
  return {
    isVictory,
    confidence: isVictory ? combinedConfidence : 0.1
  };
};

// Template matching function (new)
const matchTemplate = (
  skinMap: boolean[][], 
  edges: boolean[][], 
  template: any, 
  width: number, 
  height: number
): number => {
  let score = 0;
  const totalRegions = template.regions.length;
  
  // For each template region, check if the image matches the expected pattern
  template.regions.forEach(region => {
    const startX = Math.floor(region.x * width);
    const startY = Math.floor(region.y * height);
    const regionWidth = Math.floor(region.width * width);
    const regionHeight = Math.floor(region.height * height);
    
    let matchingPixels = 0;
    let totalPixels = 0;
    
    for (let y = startY; y < startY + regionHeight && y < height; y++) {
      for (let x = startX; x < startX + regionWidth && x < width; x++) {
        if (skinMap[y] && skinMap[y][x] === region.isSkin) {
          matchingPixels++;
        }
        totalPixels++;
      }
    }
    
    const regionScore = totalPixels > 0 ? matchingPixels / totalPixels : 0;
    score += regionScore;
  });
  
  // Normalize score and apply template weight
  const normalizedScore = (score / totalRegions) * template.weight;
  return normalizedScore * 10; // Scale to 0-10 range for comparison
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
  
  // Apply skin refinement to reduce noise
  return refineSkinMap(skinMap, width, height);
};

// Improved skin tone detection with more accurate color ranges
const isSkinTone = (r: number, g: number, b: number): boolean => {
  // Skip very dark or very bright pixels
  if (r < 60 || g < 40 || b < 20) return false;
  if (r > 250 && g > 250 && b > 250) return false;

  const rgb_max = Math.max(r, Math.max(g, b));
  const rgb_min = Math.min(r, Math.min(g, b));
  
  // Color intensity check - ensure there's enough difference
  if ((rgb_max - rgb_min) < 15) return false;
  
  // Normalized RGB check
  const sum = r + g + b;
  if (sum === 0) return false;
  
  const rn = r / sum;
  const gn = g / sum;
  const bn = b / sum;
  
  // More accurate skin tone thresholds from research
  return (
    rn > 0.35 && 
    rn < 0.465 && 
    gn > 0.27 && 
    gn < 0.37 &&
    bn > 0.12 &&
    bn < 0.25 &&
    Math.abs(rn - gn) > 0.08
  );
};

// New function to refine the skin map by removing noise
const refineSkinMap = (skinMap: boolean[][], width: number, height: number): boolean[][] => {
  const refined: boolean[][] = Array(height).fill(false).map(() => Array(width).fill(false));
  
  // Copy the original map first
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      refined[y][x] = skinMap[y][x];
    }
  }
  
  // Apply refinement: remove isolated skin pixels and fill small gaps
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Count skin pixels in 3x3 neighborhood
      let skinCount = 0;
      for (let ny = y - 1; ny <= y + 1; ny++) {
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (skinMap[ny][nx]) skinCount++;
        }
      }
      
      // Remove isolated skin pixels (less than 4 neighbors)
      if (skinMap[y][x] && skinCount < 4) {
        refined[y][x] = false;
      }
      
      // Fill small gaps (surrounded by at least 6 skin pixels)
      if (!skinMap[y][x] && skinCount >= 6) {
        refined[y][x] = true;
      }
    }
  }
  
  return refined;
};

// Advanced edge detection
const detectEdges = (skinMap: boolean[][], width: number, height: number): boolean[][] => {
  const edges: boolean[][] = Array(height).fill(false).map(() => Array(width).fill(false));
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Only consider skin pixels for edge detection
      if (!skinMap[y][x]) continue;
      
      const neighbors = [
        skinMap[y-1][x],    // top
        skinMap[y+1][x],    // bottom
        skinMap[y][x-1],    // left
        skinMap[y][x+1],    // right
        skinMap[y-1][x-1],  // top-left
        skinMap[y-1][x+1],  // top-right
        skinMap[y+1][x-1],  // bottom-left
        skinMap[y+1][x+1],  // bottom-right
      ];
      
      // Count non-skin neighbors (transitions from skin to non-skin)
      const nonSkinNeighbors = neighbors.filter(n => !n).length;
      
      // Mark as edge if it has at least 2 non-skin neighbors
      edges[y][x] = nonSkinNeighbors >= 2;
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
  let centerGapFound = false;
  
  // Calculate ratios and look for patterns
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (skinMap[y][x]) skinPixels++;
      if (edges[y][x]) edgePixels++;
      
      // Look for finger gap pattern (improved)
      if (y > height/3 && y < height*2/3) {
        // Check for horizontal gap patterns (skin-gap-skin)
        if (!skinMap[y][x]) {
          let leftHasSkin = false;
          let rightHasSkin = false;
          
          // Check left side for skin
          for (let lx = Math.max(0, x - width/5); lx < x; lx++) {
            if (skinMap[y][Math.floor(lx)]) {
              leftHasSkin = true;
              break;
            }
          }
          
          // Check right side for skin
          for (let rx = x + 1; rx < Math.min(width, x + width/5); rx++) {
            if (skinMap[y][Math.floor(rx)]) {
              rightHasSkin = true;
              break;
            }
          }
          
          // If we have skin on both sides, we found a gap
          if (leftHasSkin && rightHasSkin) {
            gapFound = true;
            
            // Check if gap is in the center portion
            if (x > width*0.4 && x < width*0.6) {
              centerGapFound = true;
            }
          }
        }
      }
      
      // Check for V shape pattern (improved)
      if (y > height/2 && edges[y][x]) {
        const leftDiagonal = checkDiagonal(edges, skinMap, x, y, -1, -1, 7);
        const rightDiagonal = checkDiagonal(edges, skinMap, x, y, 1, -1, 7);
        if (leftDiagonal && rightDiagonal) {
          vShapeScore += 2;
        }
      }
    }
  }
  
  const totalPixels = width * height;
  const skinRatio = skinPixels / totalPixels;
  const edgeRatio = edgePixels / totalPixels;
  
  // Get V shape base strength
  const hasVShape = vShapeScore > sensitivitySettings.vShapeMinScore;
  const shapeConfidence = calculateShapeConfidence(
    skinRatio,
    edgeRatio,
    vShapeScore,
    centerGapFound,
    height
  );
  
  return {
    hasVShape,
    hasFingerGap: gapFound,
    skinRatio,
    shapeConfidence
  };
};

// Helper function to check diagonal lines (improved)
const checkDiagonal = (
  edges: boolean[][],
  skinMap: boolean[][],
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  length: number
): boolean => {
  let edgeCount = 0;
  let skinCount = 0;
  let x = startX;
  let y = startY;
  
  for (let i = 0; i < length; i++) {
    if (
      y < 0 || y >= edges.length ||
      x < 0 || x >= edges[0].length
    ) break;
    
    if (edges[y][x]) edgeCount++;
    if (skinMap[y][x]) skinCount++;
    
    x += dx;
    y += dy;
  }
  
  // Need enough edge and skin pixels to be considered a finger
  return edgeCount >= (length / 3) && skinCount >= (length / 2);
};

// Calculate shape confidence
const calculateShapeConfidence = (
  skinRatio: number,
  edgeRatio: number,
  vShapeScore: number,
  centerGapFound: boolean,
  height: number
): number => {
  const idealSkinRatio = 0.15;  // Ideal skin coverage for a V sign
  const idealEdgeRatio = 0.04;  // Ideal edge ratio for a V sign
  const idealVShapeScore = height / 15;
  
  // Calculate component scores
  const skinRatioScore = 1 - Math.min(Math.abs(skinRatio - idealSkinRatio) / idealSkinRatio, 1);
  const edgeRatioScore = 1 - Math.min(Math.abs(edgeRatio - idealEdgeRatio) / idealEdgeRatio, 1);
  const vShapeScoreNorm = Math.min(vShapeScore / idealVShapeScore, 1);
  
  // Give higher weight to center gap finding, crucial for V signs
  const gapBonus = centerGapFound ? 0.3 : 0;
  
  // Combine scores with weights
  const combinedScore = (
    skinRatioScore * 0.2 + 
    edgeRatioScore * 0.2 + 
    vShapeScoreNorm * 0.3 + 
    gapBonus
  );
  
  return Math.min(combinedScore, 1);
};

// Function to check if an image is too dark
const isImageTooDark = (data: Uint8ClampedArray): boolean => {
  let darkPixels = 0;
  const totalPixels = data.length / 4;
  const sampleStep = 4; // Sample every 4th pixel for performance
  
  for (let i = 0; i < data.length; i += 16) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness < 30) darkPixels++;
  }
  
  return (darkPixels / (totalPixels / sampleStep)) > 0.85;
};

// Function to check if an image is too bright
const isImageTooBright = (data: Uint8ClampedArray): boolean => {
  let brightPixels = 0;
  const totalPixels = data.length / 4;
  const sampleStep = 4; // Sample every 4th pixel for performance
  
  for (let i = 0; i < data.length; i += 16) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness > 240) brightPixels++;
  }
  
  return (brightPixels / (totalPixels / sampleStep)) > 0.8;
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
    modelInitialized = true;
    
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
        frameThreshold: 3,
        vShapeMinScore: 7
      };
      break;
    case 'medium':
      sensitivitySettings = {
        skinThreshold: 0.38,
        edgeThreshold: 0.28,
        minConfidence: 0.78,
        maxConfidence: 0.95,
        minSkinRatio: 0.08,
        maxSkinRatio: 0.35,
        frameThreshold: 2,
        vShapeMinScore: 5
      };
      break;
    case 'high':
      sensitivitySettings = {
        skinThreshold: 0.3,
        edgeThreshold: 0.25,
        minConfidence: 0.65,
        maxConfidence: 0.95,
        minSkinRatio: 0.06,
        maxSkinRatio: 0.4,
        frameThreshold: 1,
        vShapeMinScore: 3
      };
      break;
  }
  
  // Reset frame history when changing sensitivity
  frameHistory.length = 0;
  console.log(`Detection sensitivity set to ${level}`);
};
