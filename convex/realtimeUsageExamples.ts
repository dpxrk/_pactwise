/**
 * Real-time System Usage Examples
 * 
 * This file demonstrates how to use the real-time subscription system
 * in your frontend React components
 */

// FRONTEND USAGE EXAMPLES (React + Convex)

/*

// 1. SUBSCRIBE TO CONTRACT CHANGES
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function ContractsList() {
  // This will automatically update when contracts change
  const contracts = useQuery(api.realtime.subscribeToContracts, {
    filters: { status: "active" },
    limit: 20
  });

  return (
    <div>
      {contracts?.map(contract => (
        <div key={contract._id}>
          {contract.title} - {contract.status}
          {contract.vendor && ` (${contract.vendor.name})`}
        </div>
      ))}
    </div>
  );
}

// 2. SUBSCRIBE TO NOTIFICATIONS WITH REAL-TIME UPDATES
function NotificationCenter() {
  const notifications = useQuery(api.realtime.subscribeToNotifications, {
    limit: 10,
    unreadOnly: true
  });
  
  const notificationCount = useQuery(api.realtime.subscribeToNotificationCount);

  return (
    <div>
      <span>Unread: {notificationCount?.unread || 0}</span>
      {notifications?.map(notification => (
        <div key={notification._id}>
          {notification.title}
        </div>
      ))}
    </div>
  );
}

// 3. REAL-TIME DASHBOARD STATS
function Dashboard() {
  const stats = useQuery(api.realtime.subscribeToDashboardStats);

  return (
    <div>
      <h1>Dashboard</h1>
      <div>Total Contracts: {stats?.contracts.total}</div>
      <div>Active Contracts: {stats?.contracts.active}</div>
      <div>Pending Analysis: {stats?.contracts.pending}</div>
      <div>Total Vendors: {stats?.vendors.total}</div>
    </div>
  );
}

// 4. SHOW WHO'S ONLINE
function OnlineUsers() {
  const onlineUsers = useQuery(api.presence.subscribeToOnlineUsers);

  return (
    <div>
      <h3>Online Now ({onlineUsers?.length || 0})</h3>
      {onlineUsers?.map(user => (
        <div key={user.userId}>
          {user.name} - {user.activity?.type}
        </div>
      ))}
    </div>
  );
}

// 5. CONTRACT COLLABORATION - SHOW WHO'S VIEWING
function ContractViewer({ contractId }: { contractId: string }) {
  const viewers = useQuery(api.presence.subscribeToContractViewers, {
    contractId
  });

  return (
    <div>
      {viewers && viewers.length > 0 && (
        <div>
          Currently viewing: {viewers.map(v => v.name).join(", ")}
        </div>
      )}
    </div>
  );
}

// 6. REAL-TIME EVENTS FEED
function ActivityFeed() {
  const events = useQuery(api.events.subscribeToEvents, {
    limit: 20
  });

  return (
    <div>
      <h3>Recent Activity</h3>
      {events?.map(event => (
        <div key={event._id}>
          {event.user?.name} {event.eventType} {event.resourceType}
          <small>{new Date(event.timestamp).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}

// 7. TYPING INDICATORS
import { useMutation } from "convex/react";

function ContractEditor({ contractId }: { contractId: string }) {
  const updateTyping = useMutation(api.events.updateTypingIndicator);
  const typingUsers = useQuery(api.events.subscribeToTypingIndicators, {
    resourceId: contractId,
    resourceType: "contracts"
  });

  const handleTyping = () => {
    updateTyping({
      resourceId: contractId,
      resourceType: "contracts",
      field: "notes",
      isTyping: true
    });
  };

  const handleStopTyping = () => {
    updateTyping({
      resourceId: contractId,
      resourceType: "contracts",
      field: "notes",
      isTyping: false
    });
  };

  return (
    <div>
      <textarea 
        onFocus={handleTyping}
        onBlur={handleStopTyping}
        placeholder="Contract notes..."
      />
      {typingUsers && typingUsers.length > 0 && (
        <div>
          {typingUsers.map(user => user.name).join(", ")} is typing...
        </div>
      )}
    </div>
  );
}

// 8. PRESENCE MANAGEMENT
import { useEffect } from "react";

function usePresence() {
  const updatePresence = useMutation(api.presence.updatePresence);
  const setOffline = useMutation(api.presence.setOffline);

  useEffect(() => {
    // Update presence every 30 seconds
    const interval = setInterval(() => {
      updatePresence({
        activity: {
          type: "dashboard",
        }
      });
    }, 30000);

    // Set offline when page unloads
    const handleBeforeUnload = () => {
      setOffline();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOffline();
    };
  }, [updatePresence, setOffline]);
}

// 9. ANALYSIS PROGRESS TRACKING
function AnalysisTracker({ contractId }: { contractId?: string }) {
  const analysisEvents = useQuery(api.events.subscribeToAnalysisEvents, {
    contractId
  });

  return (
    <div>
      {analysisEvents?.map(event => (
        <div key={event._id}>
          Analysis completed for contract {event.contractId}
          <div>{JSON.stringify(event.data)}</div>
        </div>
      ))}
    </div>
  );
}

// 10. COMPREHENSIVE CONTRACT DETAIL PAGE
function ContractDetailPage({ contractId }: { contractId: string }) {
  const updatePresence = useMutation(api.presence.updatePresence);
  
  // Subscribe to contract details
  const contract = useQuery(api.realtime.subscribeToContract, { contractId });
  
  // Show who else is viewing
  const viewers = useQuery(api.presence.subscribeToContractViewers, { contractId });
  
  // Show typing indicators
  const typingUsers = useQuery(api.events.subscribeToTypingIndicators, {
    resourceId: contractId,
    resourceType: "contracts"
  });

  useEffect(() => {
    // Update presence to show we're viewing this contract
    updatePresence({
      activity: {
        type: "viewing_contract",
        resourceId: contractId,
        resourceTitle: contract?.title
      }
    });
  }, [contractId, contract?.title, updatePresence]);

  return (
    <div>
      <h1>{contract?.title}</h1>
      
      {viewers && viewers.length > 0 && (
        <div>Currently viewing: {viewers.map(v => v.name).join(", ")}</div>
      )}
      
      {typingUsers && typingUsers.length > 0 && (
        <div>{typingUsers.map(u => u.name).join(", ")} is typing...</div>
      )}
      
      {contract && (
        <div>
          <p>Status: {contract.status}</p>
          <p>Vendor: {contract.vendor?.name}</p>
          <p>Type: {contract.contractType}</p>
        </div>
      )}
    </div>
  );
}

*/