
flowchart TD
    %% Define styles
    classDef coreTable fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef agentTable fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef storageTable fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px

    %% Core Business Entities
    subgraph CoreBusiness["Core Business Layer"]
        Enterprises["Enterprises<br/>name, domain"]:::coreTable
        Users["Users<br/>clerkId, email<br/>enterpriseId, role"]:::coreTable
        Vendors["Vendors<br/>enterpriseId, name<br/>category"]:::coreTable
        Contracts["Contracts<br/>enterpriseId, vendorId<br/>title, status, storageId<br/>analysisStatus, extractedFields"]:::coreTable
        Invitations["Invitations<br/>enterpriseId, email<br/>role, token"]:::coreTable
    end

    %% Agent System
    subgraph AgentSystem["Agent System Layer"]
        AgentSys["AgentSystem<br/>isRunning, status<br/>config, metrics"]:::agentTable
        Agents["Agents<br/>name, type, status<br/>config, metrics, createdAt"]:::agentTable
        AgentTasks["AgentTasks<br/>assignedAgentId, createdByAgentId<br/>taskType, status, contractId<br/>vendorId, data, result"]:::agentTable
        AgentInsights["AgentInsights<br/>agentId, type, title<br/>contractId, vendorId<br/>data, actionRequired"]:::agentTable
        AgentLogs["AgentLogs<br/>agentId, level, message<br/>taskId, timestamp, category"]:::agentTable
    end

    %% Storage Layer
    subgraph StorageLayer["Storage Layer"]
        Storage["Cloud Storage<br/>Contract Files<br/>via storageId"]:::storageTable
    end

    %% Agent Types
    subgraph AgentTypes["Agent Types"]
        ManagerAgent["Manager Agent<br/>type: manager"]:::agentTable
        SecretaryAgent["Secretary Agent<br/>type: secretary"]:::agentTable
        FinancialAgent["Financial Agent<br/>type: financial"]:::agentTable
        LegalAgent["Legal Agent<br/>type: legal"]:::agentTable
        NotificationsAgent["Notifications Agent<br/>type: notifications"]:::agentTable
    end

    %% Core Business Relationships
    Users --> Enterprises
    Vendors --> Enterprises
    Contracts --> Enterprises
    Contracts --> Vendors
    Invitations --> Enterprises
    Contracts --> Storage

    %% Agent System Relationships
    Agents --> AgentSys
    AgentTasks --> Agents
    AgentInsights --> Agents
    AgentLogs --> Agents
    AgentLogs -.-> AgentTasks

    %% Cross-Layer Relationships
    AgentTasks -.-> Contracts
    AgentTasks -.-> Vendors
    AgentInsights -.-> Contracts
    AgentInsights -.-> Vendors

    %% Agent Workflow Examples
    ManagerAgent -.-> AgentSys
    SecretaryAgent -.-> AgentTasks
    FinancialAgent -.-> AgentInsights
    LegalAgent -.-> AgentInsights
    NotificationsAgent -.-> Users