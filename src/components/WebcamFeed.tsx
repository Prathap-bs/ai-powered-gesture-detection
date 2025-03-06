
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fullscreen, Maximize2, Minimize2, Video, VideoOff, Download, Shield, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type WebcamFeedProps = {
  feedName: string;
  width?: number;
  height?: number;
  deviceId?: string;
  onVideoRef?: (ref: HTMLVideoElement | null) => void;
};

const WebcamFeed: React.FC<WebcamFeedProps> = ({
  feedName,
  width = 640,
  height = 480,
  deviceId,
  onVideoRef,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [permissionState, setPermissionState] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [streamReady, setStreamReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Function to check camera permissions
  const checkCameraPermission = async () => {
    try {
      // Check if the browser supports permissions API
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log("Camera permission state:", result.state);
        setPermissionState(result.state);
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          console.log("Permission changed to:", result.state);
          setPermissionState(result.state);
          if (result.state === 'granted') {
            startStream();
          }
        });
        
        return result.state;
      }
      return null;
    } catch (err) {
      console.log("Permission API not supported");
      return null;
    }
  };

  const startStream = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Starting camera stream attempt", retryCount + 1);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media devices API not supported in this browser.");
      }

      // First check permissions
      const permissionStatus = await checkCameraPermission();
      console.log("Current permission status:", permissionStatus);
      
      if (permissionStatus === 'denied') {
        throw new Error("Camera permission has been denied. Please reset permissions in your browser settings.");
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      };
      
      console.log("Requesting media with constraints:", JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Stream obtained successfully", stream.id);
      
      // Store stream reference to prevent garbage collection
      streamRef.current = stream;
      setStreamReady(true);
      
      // We'll handle setting the stream to video element in the useEffect
      
    } catch (err) {
      console.error("Error accessing webcam:", err);
      let errorMessage = "Failed to access camera. Please check permissions.";
      
      // More specific error messages
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          errorMessage = "No camera detected. Please connect a camera and try again.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          errorMessage = "Camera is in use by another application. Please close other applications and try again.";
        } else if (err.name === "AbortError") {
          errorMessage = "Camera initialization was aborted. Please try again.";
        } else if (err.name === "TypeError") {
          errorMessage = "Camera initialization failed. Please refresh the page and try again.";
        } else {
          errorMessage = `Camera error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      console.log("Error details:", err);
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      console.log("Stopping all tracks in stream");
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => {
        console.log(`Stopping track: ${track.kind}`);
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setStreamReady(false);
    setIsStreaming(false);
    
    if (onVideoRef) {
      onVideoRef(null);
    }
    
    toast({
      title: "Camera Stopped",
      description: "The camera stream has been disconnected.",
    });
  };

  const toggleFullscreen = () => {
    if (!cardRef.current) return;
    
    if (!document.fullscreenElement) {
      cardRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
        toast({
          title: "Fullscreen Error",
          description: `Could not enter fullscreen mode: ${err.message}`,
          variant: "destructive",
        });
      });
    } else {
      document.exitFullscreen();
    }
  };

  const captureAndDownloadImage = () => {
    if (!videoRef.current || !isStreaming) {
      toast({
        title: "Capture Failed",
        description: "Cannot capture image: camera is not streaming.",
        variant: "destructive",
      });
      return;
    }
    
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast({
        title: "Capture Failed",
        description: "Failed to create canvas context.",
        variant: "destructive",
      });
      return;
    }
    
    // Draw the current video frame to the canvas
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Add timestamp to the image
    const timestamp = new Date().toLocaleString();
    ctx.font = "16px Arial";
    ctx.fillStyle = "white";
    ctx.fillRect(10, canvas.height - 30, ctx.measureText(timestamp).width + 10, 20);
    ctx.fillStyle = "black";
    ctx.fillText(timestamp, 15, canvas.height - 15);
    
    // Convert to data URL and download
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `safety-capture-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Image Captured",
        description: "The image has been saved to your downloads folder.",
      });
    } catch (error) {
      console.error("Error saving image:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download the captured image.",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    console.log("Retrying camera connection");
    setRetryCount(prev => prev + 1);
    stopStream();
    setTimeout(() => {
      startStream();
    }, 500);
  };

  // Effect to handle stream initialization after DOM is ready
  useEffect(() => {
    if (streamReady && streamRef.current && videoRef.current) {
      console.log("Setting stream to video element now that both are ready");
      videoRef.current.srcObject = streamRef.current;
      
      videoRef.current.onloadedmetadata = () => {
        console.log("Video metadata loaded");
        if (videoRef.current) {
          videoRef.current.play()
            .then(() => {
              console.log("Video playback started successfully");
              setIsStreaming(true);
              
              if (onVideoRef) {
                onVideoRef(videoRef.current);
              }
              
              toast({
                title: "Camera Connected",
                description: "Your camera is now active and streaming.",
              });
            })
            .catch(e => {
              console.error("Error playing video:", e);
              setError("Could not start video playback. Please try again.");
            });
        }
      };
      
      videoRef.current.onerror = (event) => {
        console.error("Video element error:", event);
        setError("Error in video playback. Please refresh the page and try again.");
      };
    }
  }, [streamReady, videoRef.current]);

  // Initial setup effect
  useEffect(() => {
    // Allow DOM to fully initialize before starting camera
    console.log("WebcamFeed component mounted");
    const timer = setTimeout(() => {
      console.log("Initial camera check after delay");
      checkCameraPermission().then((permissionStatus) => {
        console.log("Initial permission status:", permissionStatus);
        // Only auto-start if we have permission or it's undefined (first time)
        if (permissionStatus !== 'denied') {
          console.log("Attempting to start stream");
          startStream();
        }
      });
    }, 1500); // Increased delay to ensure DOM is ready
    
    // Check fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    // Cleanup
    return () => {
      clearTimeout(timer);
      stopStream();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [deviceId]); // Only re-run this effect if deviceId changes

  return (
    <Card ref={cardRef} className="overflow-hidden h-full flex flex-col">
      <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center">
          <Video className="w-4 h-4 mr-1.5" />
          {feedName}
          {isStreaming && (
            <Badge variant="outline" className="ml-2 py-0 h-5 bg-green-500/10 text-green-500 border-green-500/20">
              Live
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-1">
          {isStreaming && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={captureAndDownloadImage}
              title="Capture and download image"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className={`h-7 w-7 ${!isStreaming ? "text-primary" : "text-destructive"}`} 
            onClick={isStreaming ? stopStream : startStream}
            disabled={isLoading}
            title={isStreaming ? "Stop camera" : "Start camera"}
          >
            {isStreaming ? (
              <VideoOff className="h-3.5 w-3.5" />
            ) : (
              <Video className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow flex items-center justify-center bg-black/5 dark:bg-white/5 relative">
        {error ? (
          <div className="text-center p-4 flex flex-col items-center">
            <Alert variant="destructive" className="mb-3 max-w-md">
              <Shield className="h-4 w-4 mr-2" />
              <AlertTitle>Camera Access Error</AlertTitle>
              <AlertDescription className="text-sm">
                {error}
              </AlertDescription>
            </Alert>
            
            <div className="mb-3 text-sm max-w-md">
              <p className="font-medium mb-2">To enable camera access:</p>
              <ol className="list-decimal list-inside text-left space-y-1">
                <li>Click the camera icon in your browser's address bar</li>
                <li>Select "Allow" for camera access</li>
                <li>Click the "Try Again" button below</li>
              </ol>
            </div>
            
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRetry}
              className="mt-2 flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-4">
            <div className="animate-pulse h-4 w-4 bg-primary rounded-full mb-2"></div>
            <p className="text-sm text-muted-foreground">Connecting to camera...</p>
          </div>
        ) : (
          <div className="webcam-container w-full h-full relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onCanPlay={() => {
                console.log("Video can play event fired");
                setIsLoading(false);
                setIsStreaming(true);
              }}
            />
            <div className="webcam-overlay"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WebcamFeed;
