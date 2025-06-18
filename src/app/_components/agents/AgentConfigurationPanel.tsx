'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useConvexQuery, useConvexMutation } from '@/lib/api-client';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { useUser } from '@clerk/nextjs';

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Icons
import {
  Settings,
  Bot,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Save,
  Edit3,
  BarChart3,
  AlertCircle,
  Activity,
  Users,
  DollarSign
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Agent,
  AgentType,
  AgentConfig,
  TaskPriority,
  AGENT_TYPE_LABELS,
  STATUS_COLORS,
  taskPriorityOptions
} from '@/types/agents.types';

interface AgentConfigurationPanelProps {
  className?: string;
}

interface ConfigFormData {
  runIntervalMinutes: number;
  retryAttempts: number;
  timeoutMinutes: number;
  enabled: boolean;
  priority: TaskPriority;
  maxConcurrentTasks: number;
  riskThreshold: number;
  autoRestart: boolean;
  notificationSettings: {
    onSuccess: boolean;
    onFailure: boolean;
    onCriticalError: boolean;
  };
  customSettings: Record<string, unknown>;
}

const defaultConfig: ConfigFormData = {
  runIntervalMinutes: 60,
  retryAttempts: 3,
  timeoutMinutes: 30,
  enabled: true,
  priority: 'medium',
  maxConcurrentTasks: 5,
  riskThreshold: 75,
  autoRestart: false,
  notificationSettings: {
    onSuccess: false,
    onFailure: true,
    onCriticalError: true,
  },
  customSettings: {},
};

const agentTypeConfigs = {
  financial: {
    icon: DollarSign,
    color: 'text-green-600',
    description: 'Handles financial analysis, cost optimization, and risk assessment',
    defaultSettings: {
      riskThresholds: { low: 25, medium: 50, high: 75 },
      currencyConversion: true,
      reportingFrequency: 'weekly'
    }
  },
  legal: {
    icon: Shield,
    color: 'text-blue-600',
    description: 'Manages legal compliance, contract analysis, and regulatory monitoring',
    defaultSettings: {
      jurisdictions: ['US', 'EU'],
      complianceFrameworks: ['GDPR', 'SOX'],
      autoReviewEnabled: true
    }
  },
  analytics: {
    icon: BarChart3,
    color: 'text-purple-600',
    description: 'Provides data analysis, insights generation, and performance metrics',
    defaultSettings: {
      reportTypes: ['monthly_summary', 'performance_dashboard'],
      realTimeAnalysis: true,
      machineLearningEnabled: false
    }
  },
  notifications: {
    icon: AlertCircle,
    color: 'text-orange-600',
    description: 'Manages alerts, communications, and notification delivery',
    defaultSettings: {
      channels: { email: true, slack: false, webhook: false },
      urgencyLevels: { critical: { delay: 0, retries: 3 } }
    }
  },
  manager: {
    icon: Users,
    color: 'text-indigo-600',
    description: 'Orchestrates system operations, health monitoring, and agent coordination',
    defaultSettings: {
      healthCheckIntervalMinutes: 5,
      taskCleanupHours: 24,
      systemMetricsCollection: true
    }
  }
} as const;

export const AgentConfigurationPanel: React.FC<AgentConfigurationPanelProps> = ({ className }) => {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [configFormData, setConfigFormData] = useState<ConfigFormData>(defaultConfig);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get enterpriseId from Clerk user's metadata
  const enterpriseId = clerkUser?.publicMetadata?.enterpriseId as Id<"enterprises"> | undefined;

  // Fetch agents
  const { data: agents, isLoading: isLoadingAgents } = useConvexQuery(
    api.agents.manager.getAgentSystemStatus,
    {}
  );

  const agentsList = agents?.agents || [];

  // Mutations
  const updateAgentConfig = useConvexMutation(api.agents.manager.updateAgentConfig);
  const toggleAgent = useConvexMutation(api.agents.manager.toggleAgent);
  const restartAgent = useConvexMutation(api.agents.manager.restartAgent);

  const handleAgentSelect = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    
    // Populate form with current agent config
    setConfigFormData({
      runIntervalMinutes: agent.config?.runIntervalMinutes || 60,
      retryAttempts: agent.config?.retryAttempts || 3,
      timeoutMinutes: agent.config?.timeoutMinutes || 30,
      enabled: agent.isEnabled,
      priority: agent.config?.priority || 'medium',
      maxConcurrentTasks: agent.config?.maxConcurrentTasks || 5,
      riskThreshold: agent.config?.riskThreshold || 75,
      autoRestart: agent.config?.autoRestart || false,
      notificationSettings: agent.config?.notificationSettings || defaultConfig.notificationSettings,
      customSettings: agent.config?.customSettings || {},
    });
    
    setIsConfigDialogOpen(true);
  }, []);

  const handleConfigSubmit = useCallback(async () => {
    if (!selectedAgent) return;

    try {
      setMessage(null);
      
      const updatedConfig: AgentConfig = {
        runIntervalMinutes: configFormData.runIntervalMinutes,
        retryAttempts: configFormData.retryAttempts,
        timeoutMinutes: configFormData.timeoutMinutes,
        enabled: configFormData.enabled,
        priority: configFormData.priority,
        maxConcurrentTasks: configFormData.maxConcurrentTasks,
        riskThreshold: configFormData.riskThreshold,
        autoRestart: configFormData.autoRestart,
        notificationSettings: configFormData.notificationSettings,
        customSettings: configFormData.customSettings,
      };

      await updateAgentConfig.execute({
        agentId: selectedAgent._id as unknown as string,
        config: updatedConfig,
        isEnabled: configFormData.enabled
      });

      setMessage({ type: 'success', text: 'Agent configuration updated successfully' });
      setIsConfigDialogOpen(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update agent configuration';
      setMessage({ type: 'error', text: errorMessage });
    }
  }, [selectedAgent, configFormData, updateAgentConfig]);

  const handleToggleAgent = useCallback(async (agentId: string, enabled: boolean) => {
    try {
      await toggleAgent.execute({ agentId: agentId as unknown as Id<"agents">, enabled });
      setMessage({ 
        type: 'success', 
        text: `Agent ${enabled ? 'enabled' : 'disabled'} successfully` 
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle agent';
      setMessage({ type: 'error', text: errorMessage });
    }
  }, [toggleAgent]);

  const handleRestartAgent = useCallback(async (agentId: string) => {
    try {
      await restartAgent.execute({ agentId: agentId as unknown as Id<"agents"> });
      setMessage({ type: 'success', text: 'Agent restarted successfully' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restart agent';
      setMessage({ type: 'error', text: errorMessage });
    }
  }, [restartAgent]);

  const getAgentPerformanceScore = useCallback((agent: Agent): number => {
    if (agent.runCount === 0) return 0;
    return Math.round(((agent.runCount - agent.errorCount) / agent.runCount) * 100);
  }, []);

  const getAgentTypeInfo = useCallback((type: AgentType) => {
    return agentTypeConfigs[type] || {
      icon: Bot,
      color: 'text-gray-600',
      description: 'General purpose agent',
      defaultSettings: {}
    };
  }, []);

  const filteredAgentsByCategory = useMemo(() => {
    const categories = {
      core: ['manager', 'secretary'],
      analysis: ['financial', 'legal', 'analytics'],
      operations: ['notifications', 'workflow', 'monitor'],
      compliance: ['compliance', 'risk', 'audit'],
      system: ['integration', 'scheduler', 'backup']
    };

    return Object.entries(categories).map(([category, types]) => ({
      category,
      agents: agentsList.filter(agent => types.includes(agent.type))
    }));
  }, [agentsList]);

  if (isLoadingAgents) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="ml-3 text-muted-foreground">Loading agent configuration...</p>
      </div>
    );
  }

  if (!enterpriseId && isClerkLoaded) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Configuration Error</AlertTitle>
        <AlertDescription>
          Enterprise information is missing for your user account.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Agent Configuration</h1>
            <p className="text-muted-foreground">
              Configure and manage AI agents for your enterprise
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {agentsList.filter(a => a.isEnabled).length}/{agentsList.length} Active
          </Badge>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agent Management</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* System Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Total Agents</p>
                    <p className="text-2xl font-bold">{agentsList.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Active Agents</p>
                    <p className="text-2xl font-bold">
                      {agentsList.filter(a => a.isEnabled && a.status === 'active').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Avg Performance</p>
                    <p className="text-2xl font-bold">
                      {Math.round(agentsList.reduce((acc, agent) => 
                        acc + getAgentPerformanceScore(agent), 0) / (agentsList.length || 1))}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium">Error Count</p>
                    <p className="text-2xl font-bold">
                      {agentsList.reduce((acc, agent) => acc + agent.errorCount, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent Categories */}
          {filteredAgentsByCategory.map(({ category, agents }) => (
            <Card key={category} className="border-border dark:border-border/50 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="capitalize text-lg">{category} Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map((agent) => {
                    const typeInfo = getAgentTypeInfo(agent.type);
                    const performanceScore = getAgentPerformanceScore(agent);
                    const Icon = typeInfo.icon;

                    return (
                      <Card key={agent._id} className="border hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-5 w-5", typeInfo.color)} />
                              <div>
                                <h4 className="font-medium text-sm">{agent.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {AGENT_TYPE_LABELS[agent.type]}
                                </p>
                              </div>
                            </div>
                            <Badge className={STATUS_COLORS[agent.status]} variant="outline">
                              {agent.status}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>Performance</span>
                              <span className={cn(
                                "font-medium",
                                performanceScore >= 90 ? "text-green-600" :
                                performanceScore >= 75 ? "text-yellow-600" : "text-red-600"
                              )}>
                                {performanceScore}%
                              </span>
                            </div>
                            <Progress value={performanceScore} className="h-1.5" />
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <Switch
                              checked={agent.isEnabled}
                              onCheckedChange={(checked) => handleToggleAgent(agent._id, checked)}
                              disabled={toggleAgent.isLoading}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAgentSelect(agent)}
                              className="h-7 px-2"
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {agentsList.map((agent) => {
              const typeInfo = getAgentTypeInfo(agent.type);
              const performanceScore = getAgentPerformanceScore(agent);
              const Icon = typeInfo.icon;

              return (
                <Card key={agent._id} className="border-border dark:border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={cn("h-6 w-6", typeInfo.color)} />
                        <div>
                          <CardTitle className="text-lg">{agent.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {AGENT_TYPE_LABELS[agent.type]}
                          </p>
                        </div>
                      </div>
                      <Badge className={STATUS_COLORS[agent.status]}>
                        {agent.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {typeInfo.description}
                    </p>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Performance Score</span>
                        <span className={cn(
                          "font-medium",
                          performanceScore >= 90 ? "text-green-600" :
                          performanceScore >= 75 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {performanceScore}%
                        </span>
                      </div>
                      <Progress value={performanceScore} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Runs:</span>
                        <span className="font-medium">{agent.runCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Errors:</span>
                        <span className={cn(
                          "font-medium",
                          agent.errorCount > 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {agent.errorCount}
                        </span>
                      </div>
                    </div>

                    {agent.lastError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {agent.lastError}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={agent.isEnabled}
                          onCheckedChange={(checked) => handleToggleAgent(agent._id, checked)}
                          disabled={toggleAgent.isLoading}
                        />
                        <Label className="text-sm">Enabled</Label>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAgentSelect(agent)}
                          disabled={updateAgentConfig.isLoading}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestartAgent(agent._id)}
                          disabled={restartAgent.isLoading}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center p-8 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>System-wide configuration settings</p>
                <p className="text-sm">Coming soon in future release</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center p-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Real-time monitoring dashboard</p>
                <p className="text-sm">Coming soon in future release</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configure {selectedAgent?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedAgent && (
            <div className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Agent Status</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={configFormData.enabled}
                          onCheckedChange={(checked) => 
                            setConfigFormData(prev => ({ ...prev, enabled: checked }))
                          }
                        />
                        <Label>Enabled</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Priority Level</Label>
                      <Select
                        value={configFormData.priority}
                        onValueChange={(value) => 
                          setConfigFormData(prev => ({ ...prev, priority: value as TaskPriority }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taskPriorityOptions.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority.charAt(0).toUpperCase() + priority.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Run Interval (minutes)</Label>
                      <Input
                        type="number"
                        value={configFormData.runIntervalMinutes}
                        onChange={(e) => 
                          setConfigFormData(prev => ({ 
                            ...prev, 
                            runIntervalMinutes: parseInt(e.target.value) || 0 
                          }))
                        }
                        min={1}
                        max={1440}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Timeout (minutes)</Label>
                      <Input
                        type="number"
                        value={configFormData.timeoutMinutes}
                        onChange={(e) => 
                          setConfigFormData(prev => ({ 
                            ...prev, 
                            timeoutMinutes: parseInt(e.target.value) || 0 
                          }))
                        }
                        min={1}
                        max={120}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Retry Attempts</Label>
                      <Input
                        type="number"
                        value={configFormData.retryAttempts}
                        onChange={(e) => 
                          setConfigFormData(prev => ({ 
                            ...prev, 
                            retryAttempts: parseInt(e.target.value) || 0 
                          }))
                        }
                        min={0}
                        max={10}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Concurrent Tasks</Label>
                      <Input
                        type="number"
                        value={configFormData.maxConcurrentTasks}
                        onChange={(e) => 
                          setConfigFormData(prev => ({ 
                            ...prev, 
                            maxConcurrentTasks: parseInt(e.target.value) || 0 
                          }))
                        }
                        min={1}
                        max={20}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Risk Threshold: {configFormData.riskThreshold}%</Label>
                      <Input
                        type="range"
                        value={configFormData.riskThreshold}
                        onChange={(e) => 
                          setConfigFormData(prev => ({ ...prev, riskThreshold: parseInt(e.target.value) }))
                        }
                        max={100}
                        step={5}
                        className="mt-2 w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Auto Restart on Failure</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={configFormData.autoRestart}
                          onCheckedChange={(checked) => 
                            setConfigFormData(prev => ({ ...prev, autoRestart: checked }))
                          }
                        />
                        <Label>Enabled</Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Notify on Success</Label>
                      <Switch
                        checked={configFormData.notificationSettings.onSuccess}
                        onCheckedChange={(checked) => 
                          setConfigFormData(prev => ({ 
                            ...prev, 
                            notificationSettings: { 
                              ...prev.notificationSettings, 
                              onSuccess: checked 
                            }
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Notify on Failure</Label>
                      <Switch
                        checked={configFormData.notificationSettings.onFailure}
                        onCheckedChange={(checked) => 
                          setConfigFormData(prev => ({ 
                            ...prev, 
                            notificationSettings: { 
                              ...prev.notificationSettings, 
                              onFailure: checked 
                            }
                          }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Notify on Critical Error</Label>
                      <Switch
                        checked={configFormData.notificationSettings.onCriticalError}
                        onCheckedChange={(checked) => 
                          setConfigFormData(prev => ({ 
                            ...prev, 
                            notificationSettings: { 
                              ...prev.notificationSettings, 
                              onCriticalError: checked 
                            }
                          }))
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfigSubmit}
              disabled={updateAgentConfig.isLoading}
            >
              {updateAgentConfig.isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentConfigurationPanel;