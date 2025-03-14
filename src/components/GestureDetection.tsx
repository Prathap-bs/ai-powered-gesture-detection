
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ChevronUp, ChevronDown, Info, Download, Camera, RefreshCw, Loader2, Settings } from "lucide-react";
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
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const detectionIntervalRef = useRef<number | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (videoRef) {
      trainModel();
    }
  }, [videoRef]);

  const trainModel = async () => {
    setIsModelLoading(true);
    setTrainingProgress(0);
    
    try {
      await simulateModelTraining((progress) => {
        setTrainingProgress(progress);
      });
      
      toast({
        title: "Model Trained",
        description: "Hand gesture detection model is ready!",
      });
    } catch (error) {
      console.error("Error training model:", error);
      toast({
        title: "Model Training Failed",
        description: "Using fallback detection method",
        variant: "destructive",
      });
    } finally {
      setIsModelLoading(false);
    }
  };

  const handleDetection = async () => {
    if (!videoRef || !detectionActive || cooldownActive) return;
    
    try {
      const result = await detectGesture(videoRef);
      setCurrentGesture(result.gesture);
      setConfidence(result.confidence);
      
      // Lower confidence threshold to 0.55 for better detection
      if (result.gesture === "victory" && result.confidence > 0.55) {
        const imageData = captureImage(videoRef);
        setLastCapturedImage(imageData);
        
        const alert: GestureAlert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          gestureType: result.gesture,
          confidence: result.confidence,
          imageData,
          location: "Primary Camera",
          processed: false
        };
        
        if (onGestureDetected) {
          onGestureDetected(alert);
        }
        
        setCooldownActive(true);
        startCooldownTimer();
        
        // Lower confidence threshold for automatic downloads too
        if (result.confidence > 0.65) {
          const success = downloadImage(imageData, result.gesture);
          
          toast({
            title: "⚠️ Emergency Gesture Detected",
            description: `Victory sign detected with high confidence. ${success ? 'Evidence image saved to downloads.' : ''}`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error in gesture detection:", error);
    }
  };

  const startCooldownTimer = () => {
    const cooldownDuration = 3000; // 3 seconds cooldown (shortened from 5s)
    const updateInterval = 50; // Update progress every 50ms
    let elapsed = 0;
    
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    
    cooldownTimerRef.current = window.setInterval(() => {
      elapsed += updateInterval;
      const progress = (elapsed / cooldownDuration) * 100;
      setCooldownProgress(progress);
      
      if (elapsed >= cooldownDuration) {
        setCooldownActive(false);
        setCooldownProgress(0);
        clearInterval(cooldownTimerRef.current!);
        cooldownTimerRef.current = null;
      }
    }, updateInterval);
  };

  const resetCooldown = () => {
    setCooldownActive(false);
    setCooldownProgress(0);
    
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    
    resetDetectionCooldown();
    
    toast({
      title: "Detection Reset",
      description: "Gesture detection cooldown has been reset.",
    });
  };

  useEffect(() => {
    if (detectionActive && videoRef) {
      // Increased detection frequency for better responsiveness (200ms instead of 300ms)
      detectionIntervalRef.current = window.setInterval(handleDetection, 200);
    }
    
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, [detectionActive, videoRef, cooldownActive]);

  const toggleDetection = () => {
    setDetectionActive(!detectionActive);
    
    if (!detectionActive) {
      toast({
        title: "Gesture Detection Enabled",
        description: "AI-powered gesture detection is now active.",
      });
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      
      toast({
        title: "Gesture Detection Disabled",
        description: "AI-powered gesture detection is now paused.",
      });
    }
  };

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
      const success = downloadImage(imageData, "manual");
      
      toast({
        title: "Manual Capture",
        description: success 
          ? "Image captured and saved to downloads." 
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
        ? "The captured image has been saved to your downloads folder." 
        : "Failed to download the image.",
      variant: success ? "default" : "destructive",
    });
  };

  const changeSensitivity = (level: 'low' | 'medium' | 'high') => {
    setSensitivity(level);
    setDetectionSensitivity(level);
    
    toast({
      title: `Sensitivity Set to ${level.toUpperCase()}`,
      description: `Hand gesture detection sensitivity has been adjusted.`,
    });
  };

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
          Victory Sign Detection
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 hover:bg-transparent">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">
                  The AI system analyzes video feed to detect the "V" or Victory sign gesture.
                  <br />
                  When detected, an emergency alert is triggered and evidence is captured.
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
              onClick={toggleDetection}
              variant={detectionActive ? "destructive" : "outline"} 
              size="sm"
              className="h-7 text-xs"
              disabled={isModelLoading}
            >
              {detectionActive ? "Pause Detection" : "Start Detection"}
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
                      <span className="text-xs font-medium">Training ML Model:</span>
                      <span className="text-xs font-medium">{trainingProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={trainingProgress} className="h-2 bg-blue-200" />
                    <p className="text-xs text-muted-foreground mt-1 flex items-center">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Loading gesture recognition model...
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium">Current Status:</span>
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Confidence: {(confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
                
                {cooldownActive && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">Cooldown:</span>
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
                      Detection paused for {((3 - (cooldownProgress / 33.3))).toFixed(1)}s
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
                    <p className="font-semibold">Detecting "V" Sign</p>
                    <p className="text-xs text-muted-foreground">
                      Hold up index and middle finger to trigger emergency alert
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
                        'border-primary/50 bg-primary/5' : 
                        'border-border bg-background hover:bg-secondary/40'
                      }
                      transition-all
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <span>Victory Sign Emergency</span>
                      <span 
                        className={`h-2 w-2 rounded-full ${
                          currentGesture === "victory" ? 'bg-primary animate-pulse' : 'bg-gray-300'
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
