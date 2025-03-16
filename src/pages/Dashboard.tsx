
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import WebcamFeed from "@/components/WebcamFeed";
import GestureDetection from "@/components/GestureDetection";
import AlertHistory from "@/components/AlertHistory";
import { GestureAlert, generateMockAlerts, exportAlertsToExcel, resetDetectionCooldown } from "@/utils/gestureUtils";
import { Button } from "@/components/ui/button";
import { Plus, Camera, FileSpreadsheet, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

const Dashboard = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [webcams, setWebcams] = useState<MediaDeviceInfo[]>([]);
  const [activeVideoRef, setActiveVideoRef] = useState<HTMLVideoElement | null>(null);
  const [alerts, setAlerts] = useState<GestureAlert[]>([]);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    // Load mock alerts
    setAlerts(generateMockAlerts(5));
    
    // Get available webcams
    const getWebcams = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === "videoinput");
        setWebcams(videoDevices);
      } catch (err) {
        console.error("Error getting webcams:", err);
      }
    };
    
    getWebcams();
  }, []);

  const handleVideoRef = (ref: HTMLVideoElement | null) => {
    setActiveVideoRef(ref);
  };

  const handleGestureDetected = (alert: GestureAlert) => {
    // Always add the alert, including "none" type
    setAlerts(prev => [alert, ...prev]);
    
    // Show toast for victory gesture with high confidence
    if (alert.gestureType === "victory" && alert.confidence > 0.7) {
      toast({
        title: "Emergency Gesture Detected!",
        description: `A Victory sign was detected on camera with ${(alert.confidence * 100).toFixed(0)}% confidence.`,
        variant: "destructive",
      });
    }
  };

  const handleProcessAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, processed: true } 
          : alert
      )
    );
    
    toast({
      title: "Alert Processed",
      description: "The alert has been marked as processed.",
    });
  };

  const handleDeleteAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    
    toast({
      title: "Alert Deleted",
      description: "The alert has been removed from history.",
    });
  };

  const handleAddWebcam = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Support for multiple webcams will be available in the next update.",
    });
  };

  const handleExportToExcel = () => {
    if (alerts.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no alerts to export to Excel.",
        variant: "destructive",
      });
      return;
    }
    
    exportAlertsToExcel(alerts);
    
    toast({
      title: "Export Successful",
      description: "Alert data has been exported to Excel file.",
    });
  };
  
  const handleResetDetection = () => {
    resetDetectionCooldown();
    
    toast({
      title: "Detection Reset",
      description: "Gesture detection system has been reset.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-8 bg-primary/50 rounded-full mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background animate-fade-in">
      <Navbar />
      
      <main className="flex-1 container py-4 md:py-6 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Surveillance Dashboard</h1>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center"
              onClick={handleResetDetection}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              <span>Reset Detection</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center"
              onClick={handleExportToExcel}
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              <span>Export to Excel</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center"
              onClick={handleAddWebcam}
            >
              <Plus className="mr-1 h-4 w-4" />
              <span>Add Camera</span>
            </Button>
          </div>
        </div>
      
        {/* New prominent reset button for emergency gesture detection */}
        <Button 
          variant="destructive" 
          className="mb-4 flex items-center justify-center gap-2 w-full"
          onClick={handleResetDetection}
        >
          <AlertTriangle className="h-5 w-5" />
          <span className="font-bold">RESET GESTURE DETECTION</span>
          <AlertTriangle className="h-5 w-5" />
        </Button>

        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-4 mb-4`}>
          <div className={`${isMobile ? '' : 'col-span-2'}`}>
            <WebcamFeed 
              feedName="Primary Camera"
              onVideoRef={handleVideoRef}
            />
          </div>
          
          {!isMobile && (
            <div className="space-y-4">
              <GestureDetection 
                videoRef={activeVideoRef} 
                onGestureDetected={handleGestureDetected}
              />
              <AlertHistory 
                alerts={alerts}
                onProcessAlert={handleProcessAlert}
                onDeleteAlert={handleDeleteAlert}
              />
            </div>
          )}
        </div>
        
        {isMobile && (
          <div className="space-y-4 mb-4">
            <GestureDetection 
              videoRef={activeVideoRef}
              onGestureDetected={handleGestureDetected}
            />
            <AlertHistory 
              alerts={alerts}
              onProcessAlert={handleProcessAlert}
              onDeleteAlert={handleDeleteAlert}
              maxHeight={300}
            />
          </div>
        )}
        
        <div className="p-4 bg-card border rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center space-y-2 md:space-y-0">
          <div>
            <h3 className="text-sm font-medium">Available Cameras</h3>
            <p className="text-xs text-muted-foreground">
              {webcams.length > 0 
                ? `${webcams.length} camera${webcams.length !== 1 ? 's' : ''} connected` 
                : 'No external cameras detected'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {webcams.length > 0 ? (
              webcams.map((webcam, index) => (
                <Button
                  key={webcam.deviceId}
                  variant="outline"
                  size="sm"
                  className="text-xs flex items-center"
                >
                  <Camera className="mr-1 h-3 w-3" />
                  <span>Camera {index + 1}</span>
                </Button>
              ))
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleAddWebcam}
              >
                <Camera className="mr-1 h-3 w-3" />
                <span>Connect Camera</span>
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
