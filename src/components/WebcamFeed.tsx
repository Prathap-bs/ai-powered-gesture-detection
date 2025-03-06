
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fullscreen, Maximize2, Minimize2, Video, VideoOff, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const startStream = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media devices API not supported in this browser.");
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Make sure videoRef.current exists before setting srcObject
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        
        if (onVideoRef) {
          onVideoRef(videoRef.current);
        }
        
        toast({
          title: "Camera Connected",
          description: "Your camera is now active and streaming.",
        });
      } else {
        throw new Error("Video element not initialized.");
      }
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
        }
      }
      
      setError(errorMessage);
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
    if (!videoRef.current) return;
    
    const stream = videoRef.current.srcObject as MediaStream;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
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

  useEffect(() => {
    // Start stream automatically with a short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      startStream();
    }, 500);
    
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
  }, [deviceId]);

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
      <CardContent className="p-0 flex-grow flex items-center justify-center bg-black/5 dark:bg-white/5">
        {error ? (
          <div className="text-center p-4 text-red-500 text-sm flex flex-col items-center">
            <p className="mb-2">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={startStream} 
              disabled={isLoading}
            >
              Try Again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center p-4">
            <div className="animate-pulse h-4 w-4 bg-primary rounded-full mb-2"></div>
            <p className="text-sm text-muted-foreground">Connecting to camera...</p>
          </div>
        ) : (
          <div className="webcam-container w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              onCanPlay={() => setIsLoading(false)}
            />
            <div className="webcam-overlay"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WebcamFeed;
