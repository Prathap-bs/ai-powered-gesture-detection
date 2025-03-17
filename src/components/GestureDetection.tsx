
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ChevronUp, ChevronDown, Info, Download, Camera, RefreshCw, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { 
  detectGesture, 
  captureImage, 
  downloadImage,
  resetDetectionCooldown,
  simulateModelTraining,
  setDetectionSensitivity,
  GestureType, 
  GestureAlert,
  getGestureColor,
  getGestureDisplayName
} from "@/utils/gestureUtils";

type GestureDetectionProps = {
  videoRef: HTMLVideoElement | null;
  onGestureDetected?: (alert: GestureAlert) => void;
};

const GestureDetection: React.FC<GestureDetectionProps> = ({ 
  videoRef,
  onGestureDetected
}) => {
  const [detectionActive, setDetectionActive] = useState(true);
  const [currentGesture, setCurrentGesture] = useState<GestureType>("none");
  const [confidence, setConfidence] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownProgress, setCooldownProgress] = useState(0);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('high');
  const [consecutiveFrames, setConsecutiveFrames] = useState(0);
  const detectionIntervalRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const { toast } = useToast();
  const lastGestureRef = useRef<GestureType>("none");
  const lastAlertTimeRef = useRef<number>(0);
  const captureIntervalRef = useRef<number | null>(null);
  const [handDetectionError, setHandDetectionError] = useState<string | null>(null);

  // Initialize detection on component mount
  useEffect(() => {
    if (videoRef) {
      trainModel();
    }
    
    return () => {
      // Cleanup detection and cooldown timers on unmount
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [videoRef]);

  // Train the model and set up detection
  const trainModel = async () => {
    setIsModelLoading(true);
    setTrainingProgress(0);
    setConsecutiveFrames(0);
    setHandDetectionError(null);
    
    try {
      // Simulate model training with progress updates
      const success = await simulateModelTraining((progress) => {
        setTrainingProgress(progress);
      });
      
      if (success) {
        toast({
          title: "V Sign Detection Ready",
          description: "Hand detection model is now active and looking for emergency gestures.",
        });
      } else {
        setHandDetectionError("Model training failed");
        toast({
          title: "Detection Setup Issue",
          description: "There was a problem setting up the detector. Try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error training model:", error);
      setHandDetectionError(error instanceof Error ? error.message : "Unknown error");
      toast({
        title: "Model Setup Failed",
        description: "Using basic detection instead. Performance may be limited.",
        variant: "destructive",
      });
    } finally {
      setIsModelLoading(false);
      // Start detection regardless of setup outcome
      startDetection();
    }
  };

  // Start the detection process
  const startDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Very fast detection interval - 25ms (40fps)
    detectionIntervalRef.current = window.setInterval(handleDetection, 25);
    setDetectionActive(true);
  };

  // Handle each detection frame
  const handleDetection = async () => {
    if (!videoRef || !detectionActive) return;
    
    try {
      // Get current gesture detection
      const result = await detectGesture(videoRef);
      setCurrentGesture(result.gesture);
      setConfidence(result.confidence);
      
      // Victory gesture detected
      if (result.gesture === "victory" && result.confidence > 0.5) {
        // Only trigger if it's a new gesture or sufficient time has passed
        const currentTime = Date.now();
        const newGesture = result.gesture !== lastGestureRef.current;
        const timeElapsed = currentTime - lastAlertTimeRef.current > 1000;
        
        if (newGesture || timeElapsed) {
          // Capture image for the alert
          const imageData = captureImage(videoRef);
          setLastCapturedImage(imageData);
          
          // Create a new alert
          const alert: GestureAlert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestamp: new Date(),
            gestureType: result.gesture,
            confidence: result.confidence,
            imageData,
            location: "Primary Camera",
            processed: false
          };
          
          // Notify parent component
          if (onGestureDetected) {
            onGestureDetected(alert);
          }
          
          // Auto-save the image
          if (imageData) {
            const success = downloadImage(imageData, result.gesture);
            
            toast({
              title: "🚨 EMERGENCY GESTURE DETECTED",
              description: `Victory sign detected with ${Math.round(result.confidence * 100)}% confidence. ${success ? 'Evidence saved automatically.' : ''}`,
              variant: "destructive",
            });
          }
          
          // Start cooldown to prevent spam
          setCooldownActive(true);
          startCooldownTimer();
          
          // Update last detection references
          lastGestureRef.current = result.gesture;
          lastAlertTimeRef.current = currentTime;
        }
      } else if (result.gesture !== "victory") {
        // Update last gesture reference when not victory
        lastGestureRef.current = result.gesture;
      }
    } catch (error) {
      console.error("Error in gesture detection:", error);
      // Only set error if it's a new error to avoid constant UI updates
      if (error instanceof Error && !handDetectionError) {
        setHandDetectionError(error.message);
      }
    }
  };

  // Handle the detection cooldown period
  const startCooldownTimer = () => {
    const cooldownDuration = 500; // Reduced cooldown: 500ms
    const updateInterval = 25; // Faster updates
    let elapsed = 0;
    
    // Clear existing timer
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    
    // Start new timer
    cooldownTimerRef.current = window.setInterval(() => {
      elapsed += updateInterval;
      const progress = (elapsed / cooldownDuration) * 100;
      setCooldownProgress(progress);
      
      if (elapsed >= cooldownDuration) {
        // End cooldown
        setCooldownActive(false);
        setCooldownProgress(0);
        setConsecutiveFrames(0);
        clearInterval(cooldownTimerRef.current!);
        cooldownTimerRef.current = null;
        resetDetectionCooldown(); // Reset detection state
      }
    }, updateInterval);
  };

  // Reset cooldown and detection state
  const resetCooldown = () => {
    setCooldownActive(false);
    setCooldownProgress(0);
    setConsecutiveFrames(0);
    setHandDetectionError(null);
    
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    
    resetDetectionCooldown();
    lastGestureRef.current = "none";
    lastAlertTimeRef.current = 0;
    
    toast({
      title: "Detection Reset",
      description: "Gesture detection has been reset and is ready.",
    });
  };

  // Toggle detection on/off
  const toggleDetection = () => {
    setDetectionActive(!detectionActive);
    setConsecutiveFrames(0);
    
    if (!detectionActive) {
      resetCooldown(); // Reset cooldown when enabling detection
      startDetection();
      
      toast({
        title: "Gesture Detection Enabled",
        description: "Hand detection is now active.",
      });
    } else {
      // Stop detection
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      
      toast({
        title: "Gesture Detection Paused",
        description: "Hand detection is now paused.",
      });
    }
  };

  // Handle manual image capture
  const handleManualCapture = () => {
    if (!videoRef) {
      toast({
        title: "Capture Failed",
        description: "Camera is not available.",
        variant: "destructive",
      });
      return;
    }
    
    const imageData = captureImage(videoRef);
    setLastCapturedImage(imageData);
    
    if (imageData) {
      // Create manual alert
      const alert: GestureAlert = {
        id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date(),
        gestureType: "manual",
        confidence: 1.0,
        imageData,
        location: "Primary Camera",
        processed: false
      };
      
      // Notify parent component
      if (onGestureDetected) {
        onGestureDetected(alert);
      }
      
      // Download the image
      const success = downloadImage(imageData, "manual");
      
      toast({
        title: "Manual Capture",
        description: success 
          ? "Image captured and saved." 
          : "Image captured but download failed.",
        variant: success ? "default" : "destructive",
      });
    } else {
      toast({
        title: "Capture Failed",
        description: "Failed to capture image from camera.",
        variant: "destructive",
      });
    }
  };

  // Download the last captured image
  const handleDownloadLastImage = () => {
    if (!lastCapturedImage) {
      toast({
        title: "Download Failed",
        description: "No image has been captured yet.",
        variant: "destructive",
      });
      return;
    }
    
    const success = downloadImage(lastCapturedImage, currentGesture);
    
    toast({
      title: success ? "Image Downloaded" : "Download Failed",
      description: success 
        ? "The captured image has been saved to your downloads." 
        : "Failed to download the image.",
      variant: success ? "default" : "destructive",
    });
  };

  // Change detection sensitivity
  const changeSensitivity = (level: 'low' | 'medium' | 'high') => {
    setSensitivity(level);
    setDetectionSensitivity(level);
    setConsecutiveFrames(0);
    resetCooldown(); // Reset when changing sensitivity
    
    toast({
      title: `Sensitivity: ${level.toUpperCase()}`,
      description: level === 'high' 
        ? "Maximum sensitivity - will detect gestures quickly."
        : level === 'medium'
        ? "Balanced sensitivity - fewer false positives."
        : "Low sensitivity - only clear gestures detected.",
    });
  };

  // Get the color for the confidence bar
  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.9) return "bg-green-500";
    if (confidence > 0.7) return "bg-amber-500";
    if (confidence > 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="px-4 py-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center">
          <AlertTriangle className="w-4 h-4 mr-1.5" />
          V Sign Emergency Detection
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 hover:bg-transparent">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">
                  Hold up index and middle finger in a V shape to trigger emergency alert.
                  <br />
                  Evidence is automatically captured and saved.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="w-auto"
        >
          <div className="flex items-center gap-1">
            <Button 
              onClick={resetCooldown}
              variant="outline" 
              size="sm"
              className="h-7 text-xs"
              disabled={isModelLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button 
              onClick={toggleDetection}
              variant={detectionActive ? "destructive" : "outline"} 
              size="sm"
              className="h-7 text-xs"
              disabled={isModelLoading}
            >
              {detectionActive ? "Pause" : "Start"}
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                {isOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent className="overflow-hidden">
            <CardContent className="px-4 py-3 text-sm">
              <div className="space-y-4">
                {isModelLoading ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">Loading Detection Model:</span>
                      <span className="text-xs font-medium">{trainingProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={trainingProgress} className="h-2 bg-blue-200" />
                    <p className="text-xs text-muted-foreground mt-1 flex items-center">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Initializing gesture detection system...
                    </p>
                  </div>
                ) : (
                  <div>
                    {handDetectionError ? (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-3">
                        <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                          MediaPipe Hands Initialization Error
                        </p>
                        <p className="text-xs mt-1 text-red-600 dark:text-red-300">
                          {handDetectionError}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs h-7 w-full border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
                          onClick={trainModel}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry Initialization
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium">Detected Gesture:</span>
                          <span 
                            className={`text-xs font-semibold ${getGestureColor(currentGesture)}`}
                          >
                            {getGestureDisplayName(currentGesture)}
                          </span>
                        </div>
                        <Progress 
                          value={confidence * 100} 
                          className={`h-2 ${getConfidenceColor(confidence)}`} 
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Confidence: {(confidence * 100).toFixed(1)}%</span>
                          {currentGesture === "victory" && (
                            <span className="text-red-500 font-medium animate-pulse">ACTIVE!</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {cooldownActive && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">Alert Cooldown:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={resetCooldown}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                    <Progress value={cooldownProgress} className="h-2 bg-blue-200" />
                    <p className="text-xs text-muted-foreground mt-1">
                      Next alert available in {((1 - (cooldownProgress / 100)) * 0.5).toFixed(1)}s
                    </p>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 flex items-center"
                    onClick={handleManualCapture}
                    disabled={!videoRef || isModelLoading}
                  >
                    <Camera className="h-3 w-3 mr-1" /> 
                    Capture
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 flex items-center"
                    onClick={trainModel}
                    disabled={isModelLoading}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${isModelLoading ? 'animate-spin' : ''}`} /> 
                    Retrain
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 flex items-center"
                    onClick={handleDownloadLastImage}
                    disabled={!lastCapturedImage}
                  >
                    <Download className="h-3 w-3 mr-1" /> 
                    Save
                  </Button>
                </div>
                
                <div className="flex flex-col gap-1 text-xs mt-2">
                  <div className="text-center mb-2">
                    <img 
                      src="/lovable-uploads/9453398e-17d9-44af-a929-edc786769fdb.png" 
                      alt="Victory sign gesture" 
                      className="h-20 mx-auto mb-2"
                    />
                    <p className="font-semibold">Hold up two fingers in a "V" shape</p>
                    <p className="text-xs text-muted-foreground">
                      Index and middle finger extended to trigger emergency
                    </p>
                  </div>
                  
                  <div className="flex justify-between gap-2 mb-2">
                    <Button
                      variant={sensitivity === 'low' ? "default" : "outline"}
                      size="sm"
                      className="text-xs flex-1"
                      onClick={() => changeSensitivity('low')}
                    >
                      Low
                    </Button>
                    <Button
                      variant={sensitivity === 'medium' ? "default" : "outline"}
                      size="sm"
                      className="text-xs flex-1"
                      onClick={() => changeSensitivity('medium')}
                    >
                      Medium
                    </Button>
                    <Button
                      variant={sensitivity === 'high' ? "default" : "outline"}
                      size="sm"
                      className="text-xs flex-1"
                      onClick={() => changeSensitivity('high')}
                    >
                      High
                    </Button>
                  </div>
                  
                  <div 
                    className={`
                      border rounded-md p-2
                      ${currentGesture === "victory" ? 
                        'border-red-500 bg-red-100 dark:bg-red-950/30' : 
                        'border-border bg-background hover:bg-secondary/40'
                      }
                      transition-all
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <span>Victory Sign Emergency</span>
                      <span 
                        className={`h-2 w-2 rounded-full ${
                          currentGesture === "victory" ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
                        }`}
                      ></span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
};

export default GestureDetection;
