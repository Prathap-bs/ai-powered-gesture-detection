
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Bell, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  MoreVertical 
} from "lucide-react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GestureAlert, getGestureColor, getGestureDisplayName } from "@/utils/gestureUtils";

type AlertHistoryProps = {
  alerts: GestureAlert[];
  onProcessAlert?: (alertId: string) => void;
  onDeleteAlert?: (alertId: string) => void;
  maxHeight?: number;
};

const AlertHistory: React.FC<AlertHistoryProps> = ({
  alerts,
  onProcessAlert,
  onDeleteAlert,
  maxHeight = 350
}) => {
  const [isOpen, setIsOpen] = useState(true);
  
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };
  
  const formatDate = (date: Date) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
      }).format(date);
    }
  };

  const getUnprocessedCount = () => {
    return alerts.filter(alert => !alert.processed).length;
  };

  const handleProcess = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onProcessAlert) {
      onProcessAlert(alertId);
    }
  };

  const handleDelete = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteAlert) {
      onDeleteAlert(alertId);
    }
  };

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="px-4 py-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center">
          <Bell className="w-4 h-4 mr-1.5" />
          Alert History
          {getUnprocessedCount() > 0 && (
            <Badge variant="destructive" className="ml-2 py-0 h-5">
              {getUnprocessedCount()} new
            </Badge>
          )}
        </CardTitle>
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="w-auto"
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              {isOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="overflow-hidden">
            <CardContent className="px-4 py-0 text-sm">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p>No alerts recorded yet</p>
                </div>
              ) : (
                <ScrollArea className={`pr-3 -mr-3`} style={{ maxHeight }}>
                  <div className="space-y-1 py-2">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`
                          rounded-md border p-2
                          ${!alert.processed ? 'bg-destructive/5 border-destructive/30' : 'bg-card border-border'}
                          transition-all hover:bg-accent/50
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <div className="flex items-center">
                              <span className={`font-medium ${getGestureColor(alert.gestureType)}`}>
                                {getGestureDisplayName(alert.gestureType)}
                              </span>
                              {!alert.processed && (
                                <Badge variant="outline" className="ml-2 py-0 h-5 bg-red-500/10 text-red-500 border-red-500/20">
                                  New
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>{formatDate(alert.timestamp)} at {formatTime(alert.timestamp)}</span>
                            </div>
                            {alert.location && (
                              <span className="text-xs text-muted-foreground mt-0.5">
                                Location: {alert.location}
                              </span>
                            )}
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!alert.processed && (
                                <DropdownMenuItem onClick={(e) => handleProcess(alert.id, e as React.MouseEvent)}>
                                  Mark as processed
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => handleDelete(alert.id, e as React.MouseEvent)}
                              >
                                Delete alert
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        {alert.imageData && (
                          <div className="mt-2">
                            <img 
                              src={alert.imageData} 
                              alt="Alert capture" 
                              className="w-full h-20 object-cover rounded-sm"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
};

export default AlertHistory;
