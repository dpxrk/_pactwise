# Pactwise

> **Enterprise Contract & Vendor Management Platform**
> 
> AI-powered contract lifecycle management with intelligent vendor matching, multi-agent analysis, and real-time insights.

[![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-1.25.2-purple)](https://convex.dev/)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-orange)](https://clerk.dev/)
[![Redis](https://img.shields.io/badge/Redis-Cache%20%26%20Rate%20Limiting-red)](https://redis.io/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-green)](https://stripe.com/)

## Overview

Pactwise is a comprehensive enterprise platform that revolutionizes contract and vendor management through AI-powered automation. Built with modern technologies and a multi-agent architecture, it provides intelligent contract analysis, vendor matching, and compliance monitoring at scale.

### Key Features

- **Multi-Agent AI System** - Specialized agents for contract analysis, financial insights, legal compliance, and vendor management
- **Real-time Analytics** - Interactive dashboards with Three.js 3D visualizations and advanced KPI tracking
- **Intelligent Search** - Global search across contracts, vendors, and documents with advanced filtering
- **Vendor Matching** - AI-powered vendor deduplication and intelligent matching algorithms
- **Mobile-First Design** - Responsive interface optimized for all devices
- **Enterprise Security** - Row-level security, audit logging, Redis-based rate limiting, and CSP
- **Real-time Updates** - Live notifications and collaborative features
- **Memory System** - Short-term and long-term contextual AI memory for improved decision making
- **Subscription Management** - Integrated Stripe billing with multiple pricing tiers
- **API Versioning** - RESTful API with versioning support and deprecation management
- **Premium UI** - Modern glass morphism design with interactive animations

## Architecture

### Tech Stack
- **Frontend**: Next.js 15.3.3, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Convex (real-time database & serverless functions)
- **Authentication**: Clerk
- **AI System**: Custom multi-agent architecture with enhanced memory system
- **Visualization**: Three.js, React Three Fiber, GSAP animations
- **Caching & Rate Limiting**: Redis (ioredis)
- **Payments**: Stripe (subscriptions & billing)
- **Monitoring**: Sentry
- **State Management**: Zustand
- **Testing**: Jest, Testing Library, Convex Test

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
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # Stripe
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   
   # Sentry (optional)
   SENTRY_DSN=your-sentry-dsn
   
   # API Configuration
   NEXT_PUBLIC_API_VERSION=v1
   ```

4. **Start Redis** (required for caching and rate limiting)
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Or install locally
   brew install redis  # macOS
   redis-server
   ```

5. **Initialize Convex**
   ```bash
   npx convex dev
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
pactwise/
├── convex/                 # Backend logic & database
│   ├── core/              # Core business logic
│   │   ├── contracts/     # Contract management
│   │   ├── vendors/       # Vendor management
│   │   ├── users/         # User management
│   │   └── enterprises/   # Enterprise management
│   ├── features/          # Feature-specific modules
│   │   ├── collaborative/ # Real-time collaboration
│   │   ├── analytics/     # Analytics & reporting
│   │   ├── search/        # Advanced search
│   │   └── onboarding/    # User onboarding
│   ├── realtime/          # Real-time features
│   │   ├── presence.ts    # User presence tracking
│   │   ├── realtime.ts    # Real-time sync
│   │   ├── events.ts      # Event management
│   │   └── userEvents.ts  # User event tracking
│   ├── schemas/           # Database schemas
│   │   ├── agent_schema.ts
│   │   ├── memory_schema.ts
│   │   └── notification_schema.ts
│   ├── shared/            # Shared utilities & types
│   │   ├── types.ts       # Common types
│   │   ├── notifications.ts
│   │   └── monitoring.ts
│   ├── agents/            # AI agent implementations
│   ├── memory/            # Memory system for AI agents
│   ├── security/          # Security middleware & utilities
│   ├── types/             # TypeScript definitions
│   └── schema.ts          # Main database schema
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

# Testing
npm run test            # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
npm run test:backend    # Run backend tests only
npm run test:frontend   # Run frontend tests only

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript type checking

# Data Management
npm run data:generate   # Generate test data
npm run backup:create   # Create full backup
npm run migration:run   # Run database migrations

# Health Checks
npm run health:check    # Check API health
```

### Backend Architecture

The Convex backend follows a modular architecture for better organization and scalability:

#### Core Modules (`convex/core/`)
- **Contracts** - Contract lifecycle management operations
- **Vendors** - Vendor management and matching logic
- **Users** - User profiles and permissions
- **Enterprises** - Multi-tenant organization management

#### Feature Modules (`convex/features/`)
- **Collaborative** - Real-time document collaboration
- **Analytics** - Performance metrics and insights generation
- **Search** - Advanced search functionality across entities
- **Onboarding** - User onboarding flows and workflows

#### Real-time Features (`convex/realtime/`)
- **Presence** - User presence tracking and status
- **Events** - Event management and broadcasting
- **User Events** - User activity tracking
- **Real-time Sync** - Data synchronization utilities

#### Supporting Systems
- **Agents** - AI agent implementations with specialized domains
- **Memory** - Contextual memory system for AI agents
- **Security** - Row-level security, rate limiting, and audit logging
- **Schemas** - Centralized database schema definitions

### API Usage

The backend maintains clean API paths through re-exports, allowing simple imports:

```typescript
// Core business logic
api.contracts.getContractById
api.vendors.listVendors
api.users.getUserProfile
api.enterprises.getEnterpriseById

// Feature modules  
api.analytics.getContractAnalytics
api.search.searchContracts
api.onboarding.getOnboardingStatus
api.onboardingActions.completeOnboarding
api.collaborativeDocuments.createDocument

// Real-time features
api.presence.updatePresence
api.events.broadcastEvent
api.realtime.subscribeToChanges
api.userEvents.trackUserEvent
```

The organized directory structure (`core/`, `features/`, `realtime/`) is maintained internally while providing a clean API surface.

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

- **Short-term Memory** - Recent interactions and context (15-minute window)
- **Long-term Memory** - Historical patterns and learned behaviors
- **Working Memory** - Active task context and decision tracking
- **Memory Consolidation** - Automatic knowledge synthesis
- **Association Networks** - Connected insights across domains
- **Memory Sharing** - Cross-agent knowledge transfer

## Analytics & Monitoring

### Built-in Analytics
- Contract lifecycle metrics
- Vendor performance scoring
- Financial spend analysis
- User engagement tracking
- System performance monitoring

### Visualization
- **3D Charts** - Interactive Three.js visualizations (bar, area, pie)
- **Real-time Updates** - Live dashboard with WebSocket connections
- **Drill-down** - Multi-level data exploration
- **Export** - PDF, CSV, and Excel export options
- **Custom Dashboards** - Drag-and-drop metric arrangement

## Security

### Security Features
- **Row-level Security** - Multi-tenant data isolation
- **Rate Limiting** - Redis-based sliding window and token bucket algorithms
- **Audit Logging** - Comprehensive activity tracking with retention policies
- **Input Validation** - Zod schema validation on client and server
- **File Security** - Safe file upload with virus scanning
- **Content Security Policy** - Strict CSP with nonce-based scripts
- **API Versioning** - Backward compatibility and deprecation management
- **Session Management** - Secure Redis-based sessions

### Compliance
- SOC 2 Type II ready architecture
- GDPR compliance features
- Data encryption at rest and in transit
- Regular security audits and monitoring

## Subscription Plans

### Available Tiers
| Plan | Price | Features |
|------|-------|----------|
| **Starter** | $49/month | 100 contracts, 5 users, basic analytics |
| **Professional** | $199/month | Unlimited contracts, 25 users, advanced analytics |
| **Enterprise** | Custom | Unlimited everything, custom integrations, SLA |

### Features by Plan
- **Starter**: Core contract management, basic AI analysis
- **Professional**: + Advanced AI agents, custom workflows, API access
- **Enterprise**: + Dedicated support, custom training, white-label options

## UI/UX Features

### Premium Design System
- **Glass Morphism** - Modern translucent UI elements with blur effects
- **Dark Theme** - Professional dark mode with teal/cyan accent colors
- **3D Effects** - Interactive tilt cards and depth perception
- **Smooth Animations** - GSAP-powered transitions and micro-interactions
- **Interactive Backgrounds** - Particle systems with mouse tracking

### Landing Page
- **Hero Section** - Text scramble effects and animated gradients
- **Feature Cards** - 3D hover effects with category filtering
- **Pricing Cards** - Animated selection with Stripe integration
- **Trust Indicators** - Logo carousel and testimonials

### Dashboard Enhancements
- **Customizable Layout** - Drag-and-drop metric cards
- **3D Visualizations** - Three.js charts with real-time updates
- **Quick Actions** - Floating action buttons and command palette
- **Global Search** - Instant search with keyboard shortcuts

## API

### Versioning
The API follows semantic versioning with the current stable version at `v1`:
```
https://your-domain.com/api/v1/contracts
```

### Rate Limits
- **Standard endpoints**: 100 requests per 15 minutes
- **Auth endpoints**: 10 requests per 15 minutes
- **Upload endpoints**: 20 requests per hour
- **Enterprise**: Custom limits available

### Authentication
All API requests require authentication via Bearer token:
```bash
Authorization: Bearer YOUR_API_TOKEN
```

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

### Docker Deployment
```bash
# Build the image
docker build -t pactwise .

# Run with Docker Compose
docker-compose up -d
```

### Environment Configuration
Ensure all environment variables are configured for production:
- Database connections
- Authentication providers
- External API keys
- Monitoring services
- Redis connection
- Stripe webhook endpoints

<!-- ## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details. -->

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


## Recent Updates

### Version 0.1.0 (Latest)
- **Redis Integration** - Advanced caching and rate limiting
- **Stripe Payments** - Complete subscription management
- **Enhanced Security** - CSP, API versioning, improved rate limiting
- **Premium UI** - Glass morphism design with 3D effects
- **AI Memory System** - Short-term and long-term memory for agents
- **Testing Suite** - Comprehensive Jest testing setup
- **Performance** - Optimized queries and caching strategies

### Coming Soon
- Mobile apps (iOS/Android)
- Advanced workflow automation
- Custom AI model training
- Enterprise SSO integration
- Multi-language support

---

**Built with ❤️ by the Pactwise Team**

*Revolutionizing enterprise contract management through AI-powered automation.*