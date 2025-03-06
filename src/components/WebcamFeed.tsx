
import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullScreen, Maximize2, Minimize2, Video, VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  const startStream = async () => {
    if (!videoRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      setIsStreaming(true);
      
      if (onVideoRef) {
        onVideoRef(videoRef.current);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError("Failed to access camera. Please check permissions.");
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
  };

  const toggleFullscreen = () => {
    if (!cardRef.current) return;
    
    if (!document.fullscreenElement) {
      cardRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    // Start stream automatically
    startStream();
    
    // Check fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    // Cleanup
    return () => {
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
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={toggleFullscreen}
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
          <div className="text-center p-4 text-red-500 text-sm">{error}</div>
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
