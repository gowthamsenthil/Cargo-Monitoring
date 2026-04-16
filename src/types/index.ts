export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type ShipmentStatus = 'in_transit' | 'delayed' | 'customs_hold' | 'delivered' | 'at_risk' | 'diverted'
export type AlertType = 'temperature' | 'humidity' | 'shock' | 'delay' | 'customs' | 'geofence' | 'equipment'
export type ActionStatus = 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'auto_executed'
export type ComplianceFramework = 'GDP' | 'FDA_21CFR' | 'WHO_PQT' | 'IATA_DGR'

export interface GeoPoint {
  lat: number
  lng: number
  country: string
  city: string
}

export interface TelemetryReading {
  timestamp: string
  temperature: number
  humidity: number
  shock: number
  lat: number
  lng: number
  batteryLevel: number
  signalStrength: number
}

export interface Shipment {
  id: string
  trackingCode: string
  product: string
  productType: 'vaccine' | 'specialty_med' | 'blood_product' | 'diagnostic'
  origin: GeoPoint
  destination: GeoPoint
  currentLocation: GeoPoint
  carrier: string
  flightNumber?: string
  status: ShipmentStatus
  riskLevel: RiskLevel
  riskScore: number
  temperature: number
  temperatureMin: number
  temperatureMax: number
  humidity: number
  shock: number
  estimatedDelivery: string
  actualDelivery?: string
  delayHours: number
  customsStatus: 'cleared' | 'pending' | 'hold' | 'escalated'
  containerId: string
  quantity: number
  unit: string
  value: number
  insuranceClaim?: boolean
  complianceFlags: string[]
  telemetryHistory: TelemetryReading[]
  routeWaypoints: GeoPoint[]
  healthcarePartner: string
  appointments?: number
  progress: number
  emergencyActive?: boolean
  emergencyType?: string
  emergencyAirport?: { iata: string; name: string; city: string; country: string; lat: number; lng: number }
  emergencyResolved?: boolean
  reroutingFrom?: { iata: string; name: string; city: string; country: string; lat: number; lng: number }
  transitPhases?: TransitPhase[]
  currentPhase?: string
  currentPhaseName?: string
  lastCheckInAt?: string
  lastCheckInPhase?: string
  lastCheckInName?: string
  lastCheckInDesc?: string
  // Stability budget / ACARS protocol
  stabilityBudgetMinutes?: number
  stabilityExceedanceMinutes?: number
  quarantined?: boolean
  quarantineReason?: string
  acarsDispatched?: boolean
  stabilityAuditDone?: boolean
  stabilityAuditRuling?: string
  stabilityAuditDetail?: string
}

export interface Alert {
  id: string
  shipmentId: string
  shipmentCode: string
  type: AlertType
  severity: RiskLevel
  title: string
  message: string
  timestamp: string
  acknowledged: boolean
  resolvedAt?: string
  escalated: boolean
}

export interface RouteCandidate {
  route_id: string
  carrier: string
  flight_pattern: string
  flight_no?: string
  via_hub?: string | null
  transit_hours: number
  cost_usd: number
  pharma_certified: boolean
  cold_storage_cost_per_hr?: number
  earliest_departure: string
  delay_risk?: string
  status?: string
  notes?: string
}

export interface RouteEvaluation {
  route_id: string
  cost_score: number
  time_score: number
  compliance_score: number
  overall_score: number
  risk_flags: string[]
  recommendation: 'select' | 'consider' | 'avoid'
}

export interface AgentAction {
  id: string
  shipmentId: string
  shipmentCode: string
  timestamp: string
  reasoning: string
  actions: CascadeAction[]
  riskLevel: RiskLevel
  riskScore: number
  status: ActionStatus
  approvedBy?: string
  complianceFrameworks: ComplianceFramework[]
  estimatedImpact: string
  confidence: number
  pendingApprovalAt?: string
  humanInstruction?: string
  // LangGraph node outputs
  telemetryAnalysis?: string
  complianceIssues?: string[]
  graphPath?: 'normal' | 'emergency' | 'rerouting'
  routeResearch?: {
    candidates: RouteCandidate[]
    evaluations: RouteEvaluation[]
  }
  alertType?: string
}

export interface TransitPhase {
  id: string
  name: string
  startProgress: number
  endProgress: number
  durationHours: number
  description: string
}

export interface DecisionRecord {
  id: string
  shipmentId: string
  trackingCode: string
  timestamp: string
  actionId: string
  decision: 'approved' | 'rejected' | 'auto_executed'
  humanInstruction?: string
  agentResponse: string
  riskLevel: string
}

export interface CascadeAction {
  id: string
  type: 'reroute' | 'notify_provider' | 'reschedule_appointments' | 'cold_storage' | 'customs_escalation' | 'insurance_claim' | 'carrier_switch' | 'inventory_update' | 'compliance_log' | 'alert_team' | 'emergency_landing' | 'alternative_route' | 'delay_communication'
  description: string
  priority: number
  automated: boolean
  status: 'pending' | 'executing' | 'done' | 'skipped'
}

export interface ComplianceLog {
  id: string
  timestamp: string
  shipmentId: string
  shipmentCode: string
  framework: ComplianceFramework
  event: string
  details: string
  operator: string
  status: 'compliant' | 'violation' | 'warning' | 'remediated'
  auditHash: string
}

export interface KpiMetrics {
  totalShipments: number
  activeShipments: number
  atRiskShipments: number
  criticalAlerts: number
  onTimeRate: number
  temperatureCompliance: number
  avgRiskScore: number
  potentialLoss: number
  agentActionsToday: number
  automatedResolutions: number
}
