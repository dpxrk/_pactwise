'use client';

import React, { useState } from "react";
import { useConvexQuery, useConvexMutation } from "@/lib/api-client";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  AlertCircle,
  Loader2,
  Brain,
  Activity,
  FileText,
} from "lucide-react";
import { Agent } from "@/types/agents.types";
import AgentSystemStatus from "@/app/_components/agents/AgentSystemStatus";
import AgentCard from "@/app/_components/agents/AgentCard";
import InsightCard from "@/app/_components/agents/InsightCard";
import AgentLogViewer from "@/app/_components/agents/AgentLogViewer";

const AgentDashboard = () => {
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
    setMessage(null);
    try {
      const result = await initializeSystem.execute({});
      if (result?.success) {
        setMessage({ type: 'success', text: result.message });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to initialize' });
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

  const handleRefreshStatus = () => {
    // Trigger a re-fetch of the system status
    window.location.reload();
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

  const handleExportLogs = () => {
    // Export logs functionality
    setMessage({ type: 'success', text: 'Log export feature coming soon' });
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Bot className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">AI Agent Management</h1>
      </div>

      {/* Message Display */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* System Status */}
      <AgentSystemStatus
        systemStatus={systemStatus}
        onStartSystem={handleStartSystem}
        onStopSystem={handleStopSystem}
        onInitializeSystem={handleInitialize}
        onRefreshStatus={handleRefreshStatus}
        loading={isLoading}
        startLoading={startSystem.isLoading}
        stopLoading={stopSystem.isLoading}
        initLoading={initializeSystem.isLoading}
      />

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center space-x-2">
            <Bot className="h-4 w-4" />
            <span>Agents</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center space-x-2">
            <Brain className="h-4 w-4" />
            <span>Insights</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Agents */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Agent Activity</h3>
              {systemStatus?.agents && systemStatus.agents.length > 0 ? (
                <div className="space-y-3">
                  {systemStatus.agents.slice(0, 3).map((agent: Agent) => (
                    <AgentCard
                      key={agent._id}
                      agent={agent}
                      onToggleAgent={handleToggleAgent}
                      loading={toggleAgent.isLoading}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No agents available</p>
              )}
            </div>

            {/* Recent Insights */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Latest Insights</h3>
              {recentInsights && recentInsights.length > 0 ? (
                <div className="space-y-3">
                  {recentInsights.slice(0, 3).map((insight: any) => (
                    <InsightCard
                      key={insight._id}
                      insight={insight}
                      onMarkAsRead={handleMarkAsRead}
                      loading={markInsightAsRead.isLoading}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No insights generated yet</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemStatus?.agents && systemStatus.agents.length > 0 ? (
              systemStatus.agents.map((agent: Agent) => (
                <AgentCard
                  key={agent._id}
                  agent={agent}
                  onToggleAgent={handleToggleAgent}
                  loading={toggleAgent.isLoading}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No agents found. Initialize the system to get started.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          {recentInsights && recentInsights.length > 0 ? (
            <div className="space-y-4">
              {recentInsights.map((insight: any) => (
                <InsightCard
                  key={insight._id}
                  insight={insight}
                  onMarkAsRead={handleMarkAsRead}
                  loading={markInsightAsRead.isLoading}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No insights generated yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Insights will appear here once the agent system is running.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <AgentLogViewer
            logs={recentLogs || []}
            onRefresh={handleRefreshStatus}
            onExportLogs={handleExportLogs}
            loading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentDashboard;