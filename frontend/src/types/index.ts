export type JobStatus = 'active' | 'completed' | 'on_hold'
export type Trade = 'plumbing' | 'hvac' | 'electrical'

export type TransactionStatus =
  | 'approved'
  | 'declined'
  | 'pending'
  | 'simulated'

export type ActivityType =
  | 'purchase'
  | 'card_issued'
  | 'policy_check'
  | 'budget_alert'
  | 'sms'
  | 'simulation'

export interface Company {
  id: string
  name: string
  ownerName: string
  tradeFocus: Trade[]
  timezone: string
}

export interface Worker {
  id: string
  name: string
  role: string
  phone: string
  spendingLimitCents: number
}

export interface Job {
  id: string
  code: string
  customerName: string
  address: string
  trade: Trade
  status: JobStatus
  assignedWorkerId: string
  materialBudgetCents: number
  spentCents: number
  committedCents: number
  startedAt: string
  notes?: string
}

export interface VirtualCard {
  id: string
  jobId: string
  lastFour: string
  spendLimitCents: number
  /** Visa MCC codes — mirrors backend `allowed_mccs` */
  allowedMccs: string[]
  issuedAt: string
  expiresAt: string
  status: 'active' | 'frozen' | 'expired' | 'used'
  /** Live Agent Demo cards are single-use */
  singleUse?: boolean
}

export interface PolicyRuleHit {
  ruleId: string
  title: string
  description: string
  passed: boolean
  detail?: string
}

export interface PolicyDecision {
  id: string
  transactionId?: string
  jobId: string
  approved: boolean
  summary: string
  evaluatedAt: string
  rules: PolicyRuleHit[]
  /** Natural-language context from the agent (interpretation), not a policy score */
  aiNarrative: string
}

export interface Transaction {
  id: string
  jobId: string
  workerId: string
  merchant: string
  mcc: string
  amountCents: number
  status: TransactionStatus
  cardLastFour: string
  createdAt: string
  isSimulated: boolean
  policyDecisionId?: string
  declineReason?: string
}

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  description: string
  timestamp: string
  jobId?: string
  transactionId?: string
  meta?: Record<string, string>
}

export interface OverviewMetrics {
  totalMaterialSpendCents: number
  monthlyBudgetCents: number
  activeJobs: number
  pendingApprovals: number
  approvalRatePercent: number
  cardsActive: number
  spendVsLastMonthPercent: number
}

export interface Merchant {
  id: string
  name: string
  mcc: string
}

export interface Receipt {
  id: string
  jobId: string
  transactionId: string | null
  store: string
  totalCents: number | null
  items: string[]
  /** Items not in the job's planned materials, with the reason */
  flags: string[]
}

/** Where the snapshot came from: the deployed backend, or bundled mock data */
export type DataSource = 'live' | 'offline'

export interface DashboardSnapshot {
  source?: DataSource
  receipts?: Receipt[]
  company: Company
  workers: Worker[]
  jobs: Job[]
  merchants: Merchant[]
  cards: VirtualCard[]
  transactions: Transaction[]
  activities: ActivityItem[]
  policyDecisions: PolicyDecision[]
  metrics: OverviewMetrics
}

export interface SimulatePurchaseInput {
  jobId: string
  merchant: string
  mcc: string
  amountCents: number
  workerId?: string
}

export interface SimulatePurchaseResult {
  transaction: Transaction
  policyDecision: PolicyDecision
  activity: ActivityItem
}
