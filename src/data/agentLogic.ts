import { Shipment, AgentAction, CascadeAction, RiskLevel, ComplianceFramework } from '../types'

function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

function calcRiskScore(shipment: Shipment): number {
  let score = 0
  const tempRange = shipment.temperatureMax - shipment.temperatureMin
  const tempDeviation = Math.abs(shipment.temperature - (shipment.temperatureMin + shipment.temperatureMax) / 2)
  const tempPct = tempDeviation / (tempRange / 2)
  score += tempPct * 30

  if (shipment.delayHours > 12) score += 25
  else if (shipment.delayHours > 6) score += 15
  else if (shipment.delayHours > 2) score += 8

  if (shipment.customsStatus === 'hold') score += 20
  else if (shipment.customsStatus === 'pending') score += 8
  else if (shipment.customsStatus === 'escalated') score += 12

  if (shipment.shock > 2) score += 15
  else if (shipment.shock > 1) score += 8

  if (shipment.complianceFlags.length > 0) score += shipment.complianceFlags.length * 5

  return Math.min(100, Math.round(score))
}

function buildCascadeActions(shipment: Shipment, riskScore: number): CascadeAction[] {
  const actions: CascadeAction[] = []
  let priority = 1

  actions.push({
    id: generateId(),
    type: 'compliance_log',
    description: `Auto-generate GDP/FDA audit entry for ${shipment.trackingCode} — event timestamp, sensor readings, and chain-of-custody snapshot`,
    priority: priority++,
    automated: true,
    status: 'done',
  })

  const tempMid = (shipment.temperatureMin + shipment.temperatureMax) / 2
  const tempDev = Math.abs(shipment.temperature - tempMid)
  if (tempDev > (shipment.temperatureMax - shipment.temperatureMin) * 0.3) {
    actions.push({
      id: generateId(),
      type: 'cold_storage',
      description: `Pre-book emergency cold storage at nearest hub (${shipment.currentLocation.city}). Reserve 2 validated chambers at ${shipment.temperatureMin}–${shipment.temperatureMax}°C`,
      priority: priority++,
      automated: false,
      status: 'pending',
    })
  }

  if (shipment.delayHours > 4) {
    actions.push({
      id: generateId(),
      type: 'reroute',
      description: `Evaluate alternative routing via ${shipment.routeWaypoints.length > 2 ? shipment.routeWaypoints[1].city : 'direct route'} — projected time saving: ${Math.round(shipment.delayHours * 0.6)}h`,
      priority: priority++,
      automated: false,
      status: 'pending',
    })
  }

  if (shipment.customsStatus === 'hold' || shipment.customsStatus === 'pending') {
    actions.push({
      id: generateId(),
      type: 'customs_escalation',
      description: `File emergency customs clearance request. Engage priority broker. Estimated clearance acceleration: 60–70%`,
      priority: priority++,
      automated: false,
      status: 'pending',
    })
  }

  if (riskScore >= 60 && shipment.healthcarePartner) {
    actions.push({
      id: generateId(),
      type: 'notify_provider',
      description: `Send automated advisory to ${shipment.healthcarePartner}: estimated arrival delay of ${shipment.delayHours.toFixed(0)}h. Include revised ETA and contingency options`,
      priority: priority++,
      automated: true,
      status: 'executing',
    })
  }

  if (shipment.appointments && shipment.delayHours > 6) {
    actions.push({
      id: generateId(),
      type: 'reschedule_appointments',
      description: `Recommend rescheduling ${shipment.appointments.toLocaleString()} patient appointments linked to ${shipment.trackingCode}. Generate revised appointment slots for approval`,
      priority: priority++,
      automated: false,
      status: 'pending',
    })
  }

  if (riskScore >= 70) {
    actions.push({
      id: generateId(),
      type: 'insurance_claim',
      description: `Initiate pre-emptive insurance claim documentation. Estimated exposure: $${(shipment.value * 0.15).toLocaleString()}. Collect telemetry evidence bundle`,
      priority: priority++,
      automated: true,
      status: 'executing',
    })
  }

  actions.push({
    id: generateId(),
    type: 'inventory_update',
    description: `Update ERP inventory forecast for ${shipment.product}. Adjust inbound quantity timeline. Flag downstream procurement if delay > 12h`,
    priority: priority++,
    automated: true,
    status: 'done',
  })

  actions.push({
    id: generateId(),
    type: 'alert_team',
    description: `Notify operations team via secure channel. Escalation matrix: L1 (Ops Center) → L2 (QA Manager) → L3 (VP Supply Chain) based on risk trajectory`,
    priority: priority++,
    automated: true,
    status: 'done',
  })

  return actions
}

function buildReasoning(shipment: Shipment, riskScore: number): string {
  const parts: string[] = []

  parts.push(`Analyzed telemetry from container ${shipment.containerId} (${shipment.trackingCode}).`)

  const tempMid = (shipment.temperatureMin + shipment.temperatureMax) / 2
  const tempDev = shipment.temperature - tempMid
  if (Math.abs(tempDev) > 1) {
    parts.push(`Temperature reading of ${shipment.temperature}°C shows ${tempDev > 0 ? '+' : ''}${tempDev.toFixed(1)}°C deviation from midpoint. ${tempDev > 0 ? 'Upper' : 'Lower'} threshold proximity: ${Math.round(Math.abs((shipment.temperature - (tempDev > 0 ? shipment.temperatureMax : shipment.temperatureMin)) / (shipment.temperatureMax - shipment.temperatureMin) * 100))}%.`)
  }

  if (shipment.delayHours > 0) {
    parts.push(`Current delay of ${shipment.delayHours}h poses ${shipment.delayHours > 8 ? 'critical' : shipment.delayHours > 4 ? 'significant' : 'moderate'} viability risk for temperature-sensitive payload.`)
  }

  if (shipment.customsStatus !== 'cleared') {
    parts.push(`Customs status "${shipment.customsStatus}" adds uncertainty to arrival window. Documentation review initiated.`)
  }

  if (shipment.complianceFlags.length > 0) {
    parts.push(`Active compliance flags: ${shipment.complianceFlags.join(', ')}. Regulatory review required per GDP Chapter 9 and FDA 21 CFR Part 211.`)
  }

  parts.push(`Composite risk score: ${riskScore}/100. Triggering ${riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : 'MODERATE'} response protocol.`)

  return parts.join(' ')
}

function getComplianceFrameworks(shipment: Shipment): ComplianceFramework[] {
  const frameworks: ComplianceFramework[] = ['GDP']
  if (shipment.origin.country === 'USA' || shipment.destination.country === 'USA') frameworks.push('FDA_21CFR')
  if (shipment.productType === 'vaccine') frameworks.push('WHO_PQT')
  if (shipment.carrier.toLowerCase().includes('cargo') || shipment.flightNumber) frameworks.push('IATA_DGR')
  return [...new Set(frameworks)]
}

export function runAgentAnalysis(shipments: Shipment[]): AgentAction[] {
  const actions: AgentAction[] = []

  for (const shipment of shipments) {
    const riskScore = calcRiskScore(shipment)
    const riskLevel = getRiskLevel(riskScore)

    if (riskScore < 20) continue

    const cascadeActions = buildCascadeActions(shipment, riskScore)
    const reasoning = buildReasoning(shipment, riskScore)
    const frameworks = getComplianceFrameworks(shipment)

    const highImpactCount = cascadeActions.filter(a => !a.automated).length
    const status = highImpactCount > 0 ? 'pending_approval' : 'auto_executed'

    const estimatedImpact = riskScore >= 80
      ? `Prevent ~$${(shipment.value * 0.7).toLocaleString()} product loss + ${shipment.appointments ? `${shipment.appointments.toLocaleString()} patient appointments` : 'operational disruption'}`
      : riskScore >= 60
        ? `Reduce delay by ${Math.round(shipment.delayHours * 0.5)}h, mitigate $${(shipment.value * 0.25).toLocaleString()} exposure`
        : `Proactive risk reduction, minimize potential $${(shipment.value * 0.1).toLocaleString()} exposure`

    actions.push({
      id: generateId(),
      shipmentId: shipment.id,
      shipmentCode: shipment.trackingCode,
      timestamp: new Date().toISOString(),
      reasoning,
      actions: cascadeActions,
      riskLevel,
      riskScore,
      status,
      complianceFrameworks: frameworks,
      estimatedImpact,
      confidence: Math.round(75 + Math.random() * 20),
    })
  }

  return actions.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.riskLevel] - order[b.riskLevel]
  })
}

export function updateShipmentTelemetry(shipment: Shipment): Shipment {
  const tempDrift = (Math.random() - 0.48) * 0.3
  const newTemp = +(shipment.temperature + tempDrift).toFixed(1)
  const newHumidity = +(shipment.humidity + (Math.random() - 0.5) * 0.5).toFixed(1)
  const newShock = +(Math.random() * 0.2).toFixed(2)
  const newProgress = Math.min(100, shipment.progress + Math.random() * 0.3)

  const newReading = {
    timestamp: new Date().toISOString(),
    temperature: newTemp,
    humidity: newHumidity,
    shock: newShock,
    lat: shipment.currentLocation.lat,
    lng: shipment.currentLocation.lng,
    batteryLevel: shipment.telemetryHistory[shipment.telemetryHistory.length - 1]?.batteryLevel ?? 80,
    signalStrength: +(70 + Math.random() * 25).toFixed(0),
  }

  const riskScore = calcRiskScore({ ...shipment, temperature: newTemp })

  return {
    ...shipment,
    temperature: newTemp,
    humidity: newHumidity,
    shock: newShock,
    progress: +newProgress.toFixed(1),
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    telemetryHistory: [...shipment.telemetryHistory.slice(-47), newReading],
  }
}
