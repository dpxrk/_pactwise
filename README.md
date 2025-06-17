# Pactwise

> **Enterprise Contract & Vendor Management Platform**
> 
> AI-powered contract lifecycle management with intelligent vendor matching, multi-agent analysis, and real-time insights.

[![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-1.19.4-purple)](https://convex.dev/)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-orange)](https://clerk.dev/)

## Overview

Pactwise is a comprehensive enterprise platform that revolutionizes contract and vendor management through AI-powered automation. Built with modern technologies and a multi-agent architecture, it provides intelligent contract analysis, vendor matching, and compliance monitoring at scale.

### Key Features

- **Multi-Agent AI System** - Specialized agents for contract analysis, financial insights, legal compliance, and vendor management
- **Real-time Analytics** - Interactive dashboards with Three.js visualizations and advanced KPI tracking
- **Intelligent Search** - Global search across contracts, vendors, and documents with advanced filtering
- **Vendor Matching** - AI-powered vendor deduplication and intelligent matching algorithms
- **Mobile-First Design** - Responsive interface optimized for all devices
- **Enterprise Security** - Row-level security, audit logging, and rate limiting
- **Real-time Updates** - Live notifications and collaborative features
- **Memory System** - Contextual AI memory for improved decision making

## Architecture

### Tech Stack
- **Frontend**: Next.js 15.3.3, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Convex (real-time database & serverless functions)
- **Authentication**: Clerk
- **AI System**: Custom multi-agent architecture with memory
- **Visualization**: Three.js, React Three Fiber
- **Monitoring**: Sentry
- **State Management**: Zustand

### Multi-Agent System
```
ManagerAgent (orchestrator)
├── SecretaryAgent (document processing)
├── FinancialAgent (spend analysis)
├── LegalAgent (compliance checks)
├── AnalyticsAgent (insights generation)
├── NotificationAgent (alert management)
└── VendorAgent (vendor matching & management)
```

Each agent operates independently with:
- Specialized domain knowledge
- Memory integration for context preservation
- Event-driven communication
- Fault tolerance and error recovery
- Performance monitoring and metrics

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Convex account
- Clerk account (for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/pactwise.git
   cd pactwise
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following variables:
   ```env
   # Convex
   CONVEX_DEPLOYMENT=your-deployment-name
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   
   # Sentry (optional)
   SENTRY_DSN=your-sentry-dsn
   ```

4. **Initialize Convex**
   ```bash
   npx convex dev
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
pactwise/
├── convex/                 # Backend logic & database schema
│   ├── agents/            # AI agent implementations
│   ├── memory/            # Memory system for AI agents
│   ├── security/          # Security middleware & utilities
│   ├── types/             # TypeScript definitions
│   └── schema.ts          # Database schema
├── src/
│   ├── app/               # Next.js app router
│   │   ├── _components/   # Shared components
│   │   ├── dashboard/     # Main application pages
│   │   └── onboarding/    # User onboarding flow
│   ├── components/        # UI component library
│   │   ├── ui/           # shadcn/ui components
│   │   └── compound/     # Complex reusable components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   ├── stores/           # Zustand state management
│   └── types/            # TypeScript type definitions
└── public/               # Static assets
```

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server with Turbopack
npx convex dev          # Start Convex backend

# Building
npm run build           # Build for production
npm run start           # Start production server

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking
```

### Database Schema

The application uses Convex with the following main entities:

- **Enterprises** - Multi-tenant organization management
- **Users** - User profiles and permissions
- **Contracts** - Contract lifecycle management
- **Vendors** - Vendor information and relationships
- **Analytics** - Performance metrics and insights
- **Agents** - AI agent states and memory
- **Notifications** - Real-time alert system

### Code Standards

- **TypeScript Strict Mode** - Full type safety with no `any` types
- **ESLint Configuration** - Enforced code style and best practices
- **Component Structure** - Consistent patterns for hooks, state, and rendering
- **Error Boundaries** - Comprehensive error handling at all levels
- **Performance** - Optimized queries, caching, and bundle splitting

## AI Agent System

### Agent Responsibilities

| Agent | Purpose | Key Functions |
|-------|---------|---------------|
| **ManagerAgent** | Orchestration & coordination | Task delegation, workflow management |
| **SecretaryAgent** | Document processing | OCR, text extraction, classification |
| **FinancialAgent** | Financial analysis | Spend tracking, budget analysis, forecasting |
| **LegalAgent** | Compliance monitoring | Risk assessment, clause analysis |
| **AnalyticsAgent** | Insights generation | Trend analysis, reporting, KPIs |
| **NotificationAgent** | Alert management | Smart notifications, escalations |
| **VendorAgent** | Vendor operations | Matching, deduplication, scoring |

### Memory System

- **Short-term Memory** - Recent interactions and context
- **Long-term Memory** - Historical patterns and learned behaviors
- **Memory Consolidation** - Automatic knowledge synthesis
- **Association Networks** - Connected insights across domains

## Analytics & Monitoring

### Built-in Analytics
- Contract lifecycle metrics
- Vendor performance scoring
- Financial spend analysis
- User engagement tracking
- System performance monitoring

### Visualization
- Interactive Three.js charts
- Real-time dashboard updates
- Drill-down capabilities
- Export functionality

## Security

### Security Features
- **Row-level Security** - Multi-tenant data isolation
- **Rate Limiting** - API protection and abuse prevention
- **Audit Logging** - Comprehensive activity tracking
- **Input Validation** - Client and server-side validation
- **File Security** - Safe file upload and processing

### Compliance
- SOC 2 Type II ready architecture
- GDPR compliance features
- Data encryption at rest and in transit
- Regular security audits and monitoring

## Deployment

### Convex Deployment
```bash
npx convex deploy
```

### Vercel Deployment
```bash
# Connect your repository to Vercel
# Configure environment variables
# Deploy automatically on push to main
```

### Environment Configuration
Ensure all environment variables are configured for production:
- Database connections
- Authentication providers
- External API keys
- Monitoring services

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Code Review Process
- All changes require peer review
- Automated tests must pass
- Code must follow established patterns
- Documentation updates required for new features

<!-- ## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. -->

<!-- ## Support

- **Documentation**: [docs.pactwise.com](https://docs.pactwise.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/pactwise/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/pactwise/discussions)
- **Email**: support@pactwise.com -->


---

**Built with ❤️ by the Pactwise Team**

*Revolutionizing enterprise contract management through AI-powered automation.*