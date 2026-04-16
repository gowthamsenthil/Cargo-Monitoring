import { useState, useEffect, useCallback, useRef } from 'react'
import { Shipment, Alert, AgentAction, ComplianceLog, KpiMetrics, DecisionRecord } from '../types'

type Tab = 'dashboard' | 'tracking' | 'agent' | 'workflow' | 'alerts' | 'compliance' | 'analytics'

const EMPTY_KPIS: KpiMetrics = {
  totalShipments: 0,
  activeShipments: 0,
  atRiskShipments: 0,
  criticalAlerts: 0,
  onTimeRate: 100,
  temperatureCompliance: 100,
  avgRiskScore: 0,
  potentialLoss: 0,
  agentActionsToday: 0,
  automatedResolutions: 0,
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export interface CreateShipmentPayload {
  product: string
  productType: string
  origin: { city: string; country: string; lat: number; lng: number }
  destination: { city: string; country: string; lat: number; lng: number }
  carrier: string
  flightNumber?: string
  temperatureMin: number
  temperatureMax: number
  humidity?: number
  shock?: number
  quantity: number
  unit: string
  value: number
  healthcarePartner?: string
  appointments?: number
}

export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [agentActions, setAgentActions] = useState<AgentAction[]>([])
  const [complianceLogs, setComplianceLogs] = useState<ComplianceLog[]>([])
  const [kpis, setKpis] = useState<KpiMetrics>(EMPTY_KPIS)
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [agentThinking, setAgentThinking] = useState(false)
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [decisionHistory, setDecisionHistory] = useState<DecisionRecord[]>([])
  const prevAnalyzedRef = useRef<Set<string>>(new Set())

  const pollAll = useCallback(async () => {
    try {
      const [ships, acts, alts, logs, kpiData, decisions] = await Promise.all([
        apiFetch<Shipment[]>('/api/shipments'),
        apiFetch<AgentAction[]>('/api/agent-actions'),
        apiFetch<Alert[]>('/api/alerts'),
        apiFetch<ComplianceLog[]>('/api/compliance-logs'),
        apiFetch<KpiMetrics>('/api/kpis'),
        apiFetch<DecisionRecord[]>('/api/decision-history'),
      ])

      setShipments(ships)
      setAgentActions(acts)
      setAlerts(alts)
      setComplianceLogs(logs)
      setKpis(kpiData)
      setDecisionHistory(decisions)
      setBackendError(null)

      const unanalyzed = ships.filter((s: any) => !s.agentAnalyzed).map(s => s.id)
      const wasUnanalyzed = unanalyzed.filter(id => !prevAnalyzedRef.current.has(id))

      if (unanalyzed.length > 0) {
        setAgentThinking(true)
      } else {
        setAgentThinking(false)
        prevAnalyzedRef.current = new Set(ships.map(s => s.id))
      }

      if (wasUnanalyzed.length > 0 && unanalyzed.length === 0) {
        prevAnalyzedRef.current = new Set(ships.map(s => s.id))
      }

      if (ships.length > 0 && !selectedShipmentId) {
        setSelectedShipmentId(ships[0].id)
      }
    } catch (err: any) {
      setBackendError(err.message ?? 'Backend unreachable')
    }
  }, [selectedShipmentId])

  useEffect(() => {
    pollAll()
    const delay = simulationSpeed === 5 ? 2000 : simulationSpeed === 2 ? 3500 : 5000
    const id = setInterval(pollAll, delay)
    return () => clearInterval(id)
  }, [pollAll, simulationSpeed])

  const createShipment = useCallback(async (payload: CreateShipmentPayload) => {
    const s = await apiFetch<Shipment>('/api/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setShipments(prev => [...prev, s])
    setSelectedShipmentId(s.id)
    setAgentThinking(true)
    await pollAll()
  }, [pollAll])

  const deleteShipment = useCallback(async (id: string) => {
    await apiFetch(`/api/shipments/${id}`, { method: 'DELETE' })
    setShipments(prev => prev.filter(s => s.id !== id))
    setSelectedShipmentId(prev => prev === id ? null : prev)
    await pollAll()
  }, [pollAll])

  const approveAction = useCallback(async (actionId: string) => {
    await apiFetch(`/api/agent-actions/${actionId}/approve`, { method: 'POST' })
    await pollAll()
  }, [pollAll])

  const rejectAction = useCallback(async (actionId: string, humanInstruction?: string) => {
    await apiFetch(`/api/agent-actions/${actionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ human_instruction: humanInstruction ?? null }),
    })
    await pollAll()
  }, [pollAll])

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    await apiFetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' })
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a))
  }, [])

  const triggerScenario = useCallback(async (shipmentId: string, type: string) => {
    await apiFetch(`/api/shipments/${shipmentId}/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
    setAgentThinking(true)
    await pollAll()
  }, [pollAll])

  const resolveEmergency = useCallback(async (shipmentId: string) => {
    await apiFetch(`/api/shipments/${shipmentId}/resolve-emergency`, { method: 'POST' })
    setAgentThinking(true)
    await pollAll()
  }, [pollAll])

  const selectedShipment = shipments.find(s => s.id === selectedShipmentId) ?? null

  return {
    shipments,
    alerts,
    agentActions,
    complianceLogs,
    kpis,
    selectedShipment,
    selectedShipmentId,
    setSelectedShipmentId,
    activeTab,
    setActiveTab,
    agentThinking,
    simulationSpeed,
    setSimulationSpeed,
    acknowledgeAlert,
    approveAction,
    rejectAction,
    createShipment,
    deleteShipment,
    triggerScenario,
    resolveEmergency,
    backendError,
    decisionHistory,
  }
}
