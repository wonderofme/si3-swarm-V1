# Technical Architecture and Implementation Plan

## Current Architecture

### System Overview
Agent Kaia is an AI-powered matchmaking bot built on the ElizaOS multi-agent framework, serving the SI<3> Web3 community through Telegram and web interfaces.

### Current Stack
- **Runtime**: Node.js 22, TypeScript 5.6.3
- **Framework**: ElizaOS (multi-agent), Express 4.21 (REST API)
- **Database**: MongoDB 6.3.0 (primary), PostgreSQL 8.13.0 (supported)
- **AI/ML**: OpenAI GPT-4o-mini, OpenAI Embeddings
- **Integrations**: Telegram Bot API (Telegraf), SMTP (Nodemailer)
- **Infrastructure**: Docker, Akash Network (decentralized cloud), GitHub Actions CI/CD

### Current Data Flow
```
User (Telegram/Web) 
  → Agent Kaia (ElizaOS Runtime)
    → OpenAI API (LLM Processing)
    → MongoDB (User Profiles, Matches, Onboarding State)
    → Matching Engine (Interest-based Algorithm)
    → Response (Telegram/Web API)
```

### Current Components
1. **Onboarding Plugin**: 15-step multilingual onboarding flow
2. **Matching Plugin**: Weighted compatibility scoring algorithm
3. **Match Tracker**: Records matches, manages follow-ups
4. **Web Chat API**: REST endpoints for web integration
5. **Metrics API**: Analytics and user statistics
6. **Database Adapters**: Unified interface for MongoDB/PostgreSQL

---

## Proposed Hybrid Architecture with 0G Integration

### Architecture Overview
We propose a **hybrid architecture** that maintains high-performance off-chain operations while leveraging 0G's infrastructure for verifiable, decentralized features.

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    User Interfaces                           │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Telegram    │              │  Web Chat    │            │
│  └──────┬────────┘              └──────┬───────┘            │
└─────────┼──────────────────────────────┼───────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Kaia (ElizaOS Runtime)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OpenAI API (GPT-4o-mini) - LLM Processing         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────┬──────────────────────────────────┬──────────────────┘
           │                                │
           │ Fast Operations                │ Verifiable/Decentralized
           ▼                                ▼
┌──────────────────────┐      ┌──────────────────────────────┐
│   MongoDB (Off-Chain)│      │    0G Infrastructure          │
│                      │      │                               │
│ • User Profiles      │      │ • Match Records (On-Chain)    │
│ • Onboarding State   │      │ • Cross-Platform Identity     │
│ • Real-time Matching │      │ • Knowledge Base Storage      │
│ • Email Lookups      │      │ • Reputation System           │
│ • Chat History       │      │ • Onboarding Credentials      │
│ • Follow-ups         │      │ • Agent Coordination         │
└──────────────────────┘      └──────────────────────────────┘
```

### Key Design Principles
1. **Performance First**: Critical path operations (matching, profiles) remain in MongoDB for sub-second response times
2. **Verifiability**: Match records and identity stored on 0G blockchain for transparency and trust
3. **Decentralization**: Knowledge base and credentials on 0G storage for ecosystem-wide access
4. **Gradual Migration**: Incremental integration allows testing and optimization

---

## 0G Integration Plan

### Phase 1: Match Records (On-Chain Verification)
**Timeline**: Weeks 1-2

**Implementation**:
- Create 0G adapter service for blockchain transactions
- Dual-write strategy: MongoDB (fast) + 0G (verifiable)
- Async 0G writes to avoid blocking matching flow

**Code Structure**:
```typescript
// src/adapters/ogAdapter.ts
export class OGAdapter {
  async recordMatch(matchData: MatchRecord): Promise<string> {
    // Write to MongoDB (synchronous, fast)
    await mongoDb.collection('matches').insertOne(matchData);
    
    // Write to 0G blockchain (asynchronous, verifiable)
    await ogChain.transaction({
      type: 'MATCH_CREATED',
      user_id: matchData.user_id,
      matched_user_id: matchData.matched_user_id,
      timestamp: Date.now(),
      score: matchData.score
    });
    
    return matchData.id;
  }
}
```

**Benefits**:
- Verifiable match history (users can independently verify)
- Immutable records (cannot be deleted/altered)
- Transparent matching algorithm auditability

---

### Phase 2: Cross-Platform Identity (0G Storage)
**Timeline**: Weeks 3-4

**Implementation**:
- Store primary user identity on 0G storage (keyed by email)
- Maintain platform-specific mappings in MongoDB
- Resolve primary identity before all operations

**Code Structure**:
```typescript
// src/services/identityService.ts
export class IdentityService {
  async resolvePrimaryIdentity(email: string): Promise<string> {
    // Check 0G storage for existing identity
    const identity = await ogStorage.get(`identity_${email}`);
    
    if (identity) {
      return identity.primary_id;
    }
    
    // Create new identity on 0G
    const primaryId = generateId();
    await ogStorage.store(`identity_${primaryId}`, {
      email,
      created_at: Date.now(),
      platforms: []
    });
    
    return primaryId;
  }
  
  async linkPlatform(primaryId: string, platform: string, platformId: string) {
    // Store link in MongoDB (fast lookups)
    await mongoDb.collection('user_mappings').insertOne({
      primary_id: primaryId,
      platform,
      platform_id: platformId
    });
    
    // Update 0G storage (decentralized)
    await ogStorage.update(`identity_${primaryId}`, {
      $push: { platforms: { platform, platform_id: platformId } }
    });
  }
}
```

**Benefits**:
- Single identity across Telegram, Web, future platforms
- No re-onboarding required
- Ecosystem-wide identity verification

---

### Phase 3: Knowledge Base (0G Storage)
**Timeline**: Weeks 5-6

**Implementation**:
- Migrate SI<3> knowledge base to 0G decentralized storage
- Enable cross-agent knowledge sharing
- Version control for knowledge updates

**Code Structure**:
```typescript
// src/services/knowledgeService.ts
export class KnowledgeService {
  async storeKnowledge(topic: string, content: string) {
    await ogStorage.store(`knowledge_${topic}`, {
      content,
      version: 1,
      updated_at: Date.now()
    });
  }
  
  async queryKnowledge(query: string): Promise<string[]> {
    // Query 0G storage for relevant knowledge
    const results = await ogStorage.search({
      collection: 'knowledge',
      query,
      limit: 5
    });
    
    return results.map(r => r.content);
  }
}
```

**Benefits**:
- Decentralized knowledge access
- Other agents can query SI<3> knowledge
- Community-contributed knowledge base

---

### Phase 4: Reputation & Credentials (On-Chain)
**Timeline**: Weeks 7-8

**Implementation**:
- On-chain reputation scores (match success rate, community contributions)
- Verifiable onboarding completion credentials
- Badge/achievement system

**Code Structure**:
```typescript
// src/services/reputationService.ts
export class ReputationService {
  async issueOnboardingCredential(userId: string, profile: UserProfile) {
    await ogChain.transaction({
      type: 'CREDENTIAL_ISSUED',
      credential_type: 'SI3_ONBOARDING_COMPLETE',
      user_id: userId,
      issued_at: Date.now(),
      profile_hash: hashProfile(profile)
    });
  }
  
  async updateReputation(userId: string, metrics: ReputationMetrics) {
    await ogChain.transaction({
      type: 'REPUTATION_UPDATE',
      user_id: userId,
      successful_matches: metrics.successful_matches,
      trust_score: calculateTrustScore(metrics)
    });
  }
}
```

**Benefits**:
- Verifiable credentials (users can prove SI<3> membership)
- Transparent reputation system
- Cross-platform recognition

---

### Phase 5: Agent-to-Agent Coordination
**Timeline**: Weeks 9-12

**Implementation**:
- Query other AI agents on 0G network
- Coordinate introductions across platforms
- Multi-agent workflows

**Code Structure**:
```typescript
// src/services/agentCoordination.ts
export class AgentCoordination {
  async findOtherAgents(criteria: AgentCriteria) {
    const agents = await ogNetwork.queryAgents({
      type: 'matchmaking',
      capabilities: ['user_matching', 'profile_verification']
    });
    
    return agents;
  }
  
  async coordinateMatch(userA: string, userB: string, otherAgent: string) {
    await ogNetwork.sendMessage(otherAgent, {
      type: 'MATCH_COORDINATION',
      users: [userA, userB],
      source: 'agent_kaia'
    });
  }
}
```

**Benefits**:
- Ecosystem integration
- Cross-platform matching
- Multi-agent intelligence

---

## Technical Implementation Details

### 0G SDK Integration
```typescript
// Install 0G SDK
npm install @0g-labs/sdk

// Initialize 0G client
import { OGClient } from '@0g-labs/sdk';

const ogClient = new OGClient({
  rpcUrl: process.env.OG_RPC_URL,
  privateKey: process.env.OG_PRIVATE_KEY
});
```

### Database Schema Updates
```typescript
// MongoDB collections (existing + new)
{
  matches: { /* existing */ },
  user_mappings: { /* existing */ },
  og_transactions: { // New: Track 0G transaction status
    match_id: string,
    og_tx_hash: string,
    status: 'pending' | 'confirmed' | 'failed',
    created_at: Date
  }
}
```

### Error Handling & Resilience
- Retry logic for 0G transactions (network failures)
- Fallback to MongoDB-only if 0G unavailable
- Transaction status monitoring
- Async queue for 0G writes (don't block user flow)

### Performance Optimization
- Batch 0G transactions (reduce gas costs)
- Cache 0G reads (reduce latency)
- Async writes (non-blocking)
- MongoDB remains primary for real-time operations

---

## Migration Strategy

### Phase 1-2: Foundation (Weeks 1-4)
- Set up 0G infrastructure
- Implement match records on-chain
- Deploy cross-platform identity

### Phase 3-4: Enhancement (Weeks 5-8)
- Migrate knowledge base
- Implement reputation system
- Issue onboarding credentials

### Phase 5: Ecosystem (Weeks 9-12)
- Agent-to-agent coordination
- Cross-ecosystem integration
- Full feature rollout

### Rollback Plan
- All 0G features are additive (MongoDB remains primary)
- Feature flags for gradual rollout
- Can disable 0G integration without breaking core functionality

---

## Technical Requirements

### Infrastructure
- 0G RPC endpoint access
- 0G storage access
- Private key management (environment variables)
- Transaction monitoring dashboard

### Development
- 0G SDK integration
- TypeScript type definitions
- Unit tests for 0G adapters
- Integration tests for hybrid flow

### Monitoring
- 0G transaction success rate
- Latency metrics (MongoDB vs 0G)
- Error tracking
- Cost monitoring (gas fees)

---

## Success Metrics

### Technical Metrics
- 0G transaction success rate > 95%
- Match record latency < 2s (including 0G write)
- Identity resolution < 500ms
- Knowledge query response < 1s

### Business Metrics
- Cross-platform user adoption
- Verifiable match verification usage
- Agent coordination events
- Ecosystem integration growth

---

## Risk Mitigation

### Technical Risks
- **0G Network Downtime**: Fallback to MongoDB-only mode
- **High Gas Costs**: Batch transactions, optimize writes
- **Latency Issues**: Async writes, caching strategy

### Operational Risks
- **Key Management**: Secure environment variable storage
- **Transaction Monitoring**: Automated alerts for failures
- **Data Consistency**: Dual-write validation

---

## Conclusion

This hybrid architecture leverages 0G's infrastructure for verifiable, decentralized features while maintaining MongoDB for high-performance core operations. The phased approach allows for gradual integration, testing, and optimization, ensuring system reliability throughout the migration.

The implementation demonstrates meaningful 0G usage (match records, identity, knowledge, reputation) while preserving the speed and reliability of our existing infrastructure.

