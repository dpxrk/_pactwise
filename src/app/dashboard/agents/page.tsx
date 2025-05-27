'use client';

import React, { useState } from "react";
import { useConvexQuery, useConvexMutation } from "@/lib/api-client";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Activity,
  Settings,
  Eye,
  EyeOff,
  Clock,
  BarChart2,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Agent } from "@/types/agents.types";

export const AgentDashboard = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch agent system status
  const { data: systemStatus, isLoading, error } = useConvexQuery(
    api.agents.manager.getAgentSystemStatus,
    {}
  );

  // Fetch recent insights
  const { data: recentInsights } = useConvexQuery(
    api.agents.manager.getRecentInsights,
    { limit: 5 }
  );

  // Fetch recent logs
  const { data: recentLogs } = useConvexQuery(
    api.agents.manager.getAgentLogs,
    { limit: 10 }
  );

  // Mutations
  const initializeSystem = useConvexMutation(api.agents.manager.initializeAgentSystem);
  const startSystem = useConvexMutation(api.agents.manager.startAgentSystem);
  const stopSystem = useConvexMutation(api.agents.manager.stopAgentSystem);
  const toggleAgent = useConvexMutation(api.agents.manager.toggleAgent);
  const createTestInsight = useConvexMutation(api.agents.manager.createTestInsight);
  const markInsightAsRead = useConvexMutation(api.agents.manager.markInsightAsRead);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setMessage(null);
    try {
      const result = await initializeSystem.execute({});
      if (result?.success) {
        setMessage({ type: 'success', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to initialize' });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStartSystem = async () => {
    try {
      const result = await startSystem.execute({});
      if (result?.success) {
        setMessage({ type: 'success', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to start system' });
    }
  };

  const handleStopSystem = async () => {
    try {
      const result = await stopSystem.execute({});
      if (result?.success) {
        setMessage({ type: 'success', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to stop system' });
    }
  };

  const handleToggleAgent = async (agentId: string, enabled: boolean) => {
    try {
      await toggleAgent.execute({ agentId: agentId as any, enabled });
      setMessage({ type: 'success', text: `Agent ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to toggle agent' });
    }
  };

  const handleCreateTestInsight = async () => {
    try {
      await createTestInsight.execute({});
      setMessage({ type: 'success', text: 'Test insight created successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to create test insight' });
    }
  };

  const handleMarkAsRead = async (insightId: string) => {
    try {
      await markInsightAsRead.execute({ insightId: insightId as any });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to mark insight as read' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'stopped': return 'bg-red-100 text-red-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'disabled': return 'bg-red-100 text-red-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'stopped':
      case 'inactive':
        return <AlertCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading agent system...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  const { system, agents, stats } = systemStatus || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Bot className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Agent Management</h1>
        </div>
        
        {/* System Controls */}
        <div className="flex items-center space-x-2">
          {!system ? (
            <Button 
              onClick={handleInitialize}
              disabled={isInitializing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isInitializing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Initialize Agents
            </Button>
          ) : (
            <>
              {system.isRunning ? (
                <Button 
                  onClick={handleStopSystem}
                  variant="destructive"
                  disabled={stopSystem.isLoading}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop System
                </Button>
              ) : (
                <Button 
                  onClick={handleStartSystem}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={startSystem.isLoading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start System
                </Button>
              )}
              <Button
                onClick={handleCreateTestInsight}
                variant="outline"
                disabled={createTestInsight.isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Test Insight
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* System Status */}
      {system && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon(system.status)}
              <span>System Status</span>
              <Badge className={getStatusColor(system.status)}>
                {system.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Agents</p>
                <p className="text-2xl font-bold">{stats?.totalAgents || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Agents</p>
                <p className="text-2xl font-bold">{stats?.activeAgents || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recent Insights</p>
                <p className="text-2xl font-bold">{stats?.recentInsights || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <p className="text-2xl font-bold">{stats?.pendingTasks || 0}</p>
              </div>
            </div>
            
            {system.lastStarted && (
              <div className="mt-4 text-sm text-muted-foreground">
                Last started: {formatDate(system.lastStarted)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs for different views */}
      <Tabs defaultValue="agents" className="w-full">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <div className="grid gap-4">
            {agents && agents.length > 0 ? (
              agents.map((agent:Agent) => (
                <Card key={agent._id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center space-x-2">
                        <Bot className="h-5 w-5" />
                        <span>{agent.name}</span>
                        <Badge className={getStatusColor(agent.status)}>
                          {agent.status}
                        </Badge>
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleAgent(agent._id, !agent.isEnabled)}
                        disabled={toggleAgent.isLoading}
                      >
                        {agent.isEnabled ? (
                          <Eye className="h-4 w-4 mr-1" />
                        ) : (
                          <EyeOff className="h-4 w-4 mr-1" />
                        )}
                        {agent.isEnabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {agent.description || 'No description available'}
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2 font-medium">{agent.type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Run Count:</span>
                        <span className="ml-2 font-medium">{agent.runCount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Errors:</span>
                        <span className="ml-2 font-medium">{agent.errorCount}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Run:</span>
                        <span className="ml-2 font-medium">
                          {agent.lastRun ? formatDate(agent.lastRun) : 'Never'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No agents found. Initialize the system to get started.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <div className="space-y-4">
            {recentInsights && recentInsights.length > 0 ? (
              recentInsights.map((insight:any) => (
                <Card key={insight._id} className={cn(!insight.isRead && "border-l-4 border-l-blue-500")}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{insight.title}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline">{insight.type}</Badge>
                          <Badge className={cn(
                            insight.priority === 'critical' && 'bg-red-100 text-red-800',
                            insight.priority === 'high' && 'bg-orange-100 text-orange-800',
                            insight.priority === 'medium' && 'bg-yellow-100 text-yellow-800',
                            insight.priority === 'low' && 'bg-green-100 text-green-800'
                          )}>
                            {insight.priority}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            by {insight.agentName}
                          </span>
                        </div>
                      </div>
                      {!insight.isRead && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsRead(insight._id)}
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{insight.description}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatDate(insight.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No insights generated yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <div className="space-y-2">
            {recentLogs && recentLogs.length > 0 ? (
              recentLogs.map((log:any) => (
                <div
                  key={log._id}
                  className={cn(
                    "p-3 rounded-md text-sm",
                    log.level === 'error' && 'bg-red-50 border border-red-200',
                    log.level === 'warn' && 'bg-yellow-50 border border-yellow-200',
                    log.level === 'info' && 'bg-blue-50 border border-blue-200',
                    log.level === 'debug' && 'bg-gray-50 border border-gray-200'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          log.level === 'error' && 'border-red-300 text-red-700',
                          log.level === 'warn' && 'border-yellow-300 text-yellow-700',
                          log.level === 'info' && 'border-blue-300 text-blue-700',
                          log.level === 'debug' && 'border-gray-300 text-gray-700'
                        )}
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{log.agentName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1">{log.message}</p>
                </div>
              ))
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No logs available.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};