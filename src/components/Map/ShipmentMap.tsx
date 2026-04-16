import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Shipment } from '../../types'

interface Props {
  shipments: Shipment[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const riskDotColor: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

const PRE_FLIGHT_PHASES = new Set(['road_to_airport', 'customs_origin'])

function createShipmentIcon(riskLevel: string, isSelected: boolean) {
  const color = riskDotColor[riskLevel] || '#3b82f6'
  const size = isSelected ? 16 : 12
  const ring = isSelected ? `<circle cx="20" cy="20" r="16" fill="none" stroke="${color}" stroke-width="2" opacity="0.4"/>` : ''
  return L.divIcon({
    className: '',
    html: `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      ${ring}
      <circle cx="20" cy="20" r="${size / 2 + 2}" fill="${color}" opacity="0.25"/>
      <circle cx="20" cy="20" r="${size / 2}" fill="${color}"/>
      ${isSelected ? `<circle cx="20" cy="20" r="${size / 2 + 5}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6"/>` : ''}
    </svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

function createEndpointIcon(label: string, color = '#475569', borderColor = '#64748b') {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2C8.477 2 4 6.477 4 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.523-4.477-10-10-10z"
        fill="${color}" stroke="${borderColor}" stroke-width="1.5"/>
      <circle cx="14" cy="12" r="4" fill="white" opacity="0.9"/>
      <text x="14" y="16" text-anchor="middle" font-size="6" font-weight="700" fill="${color}" font-family="sans-serif">${label}</text>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  })
}

function createHubIcon(iata: string) {
  return L.divIcon({
    className: '',
    html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" fill="#1e293b" stroke="#7c3aed" stroke-width="1.5"/>
      <circle cx="16" cy="16" r="6" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="3 2"/>
      <text x="16" y="20" text-anchor="middle" font-size="6" font-weight="700" fill="#a78bfa" font-family="monospace">${iata}</text>
    </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

function AutoFitBounds({ shipments }: { shipments: Shipment[] }) {
  const map = useMap()
  useEffect(() => {
    if (shipments.length === 0) return
    const bounds = L.latLngBounds(shipments.map(s => [s.currentLocation.lat, s.currentLocation.lng]))
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 5 })
  }, [])
  return null
}

const ROUTE_COLORS: Record<string, string> = {
  critical: '#ef444480',
  high: '#f9731680',
  medium: '#eab30880',
  low: '#22c55e80',
}

export default function ShipmentMap({ shipments, selectedId, onSelect }: Props) {
  return (
    <MapContainer
      center={[20, 20]}
      zoom={2}
      style={{ width: '100%', height: '100%', borderRadius: '12px' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution=""
      />
      <AutoFitBounds shipments={shipments} />

      {shipments.map(s => {
        const isSelected = s.id === selectedId
        const phase = s.currentPhase ?? 'flight_direct'

        // Hide flight route during pre-flight phases (road + origin customs)
        const showRoute = !PRE_FLIGHT_PHASES.has(phase)

        // Find transit hub: intermediate waypoint with a non-empty city name
        const transitHub = s.routeWaypoints?.find(
          w => w.city && w.city !== s.origin.city && w.city !== s.destination.city
        ) ?? null

        const routeCoords: [number, number][] = (s.routeWaypoints ?? []).map(w => [w.lat, w.lng])

        return (
          <React.Fragment key={s.id}>
            {/* Flight route — hidden during pre-flight phases */}
            {showRoute && (
              <Polyline
                positions={routeCoords}
                pathOptions={{
                  color: ROUTE_COLORS[s.riskLevel],
                  weight: isSelected ? 3 : 1.5,
                  dashArray: s.status === 'delayed' || s.status === 'customs_hold' ? '6 4' : undefined,
                }}
              />
            )}

            {/* Origin pin */}
            <Marker position={[s.origin.lat, s.origin.lng]} icon={createEndpointIcon('A', '#334155', '#64748b')}>
              <Popup>
                <div className="text-xs font-medium">{s.origin.city}, {s.origin.country}</div>
                <div className="text-xs text-slate-400">Origin</div>
              </Popup>
            </Marker>

            {/* Destination pin */}
            <Marker position={[s.destination.lat, s.destination.lng]} icon={createEndpointIcon('B', '#1d4ed8', '#3b82f6')}>
              <Popup>
                <div className="text-xs font-medium">{s.destination.city}, {s.destination.country}</div>
                <div className="text-xs text-slate-400">Destination</div>
              </Popup>
            </Marker>

            {/* Transit hub marker (long-haul only) */}
            {transitHub && (
              <Marker position={[transitHub.lat, transitHub.lng]} icon={createHubIcon(transitHub.city.slice(0, 3).toUpperCase())}>
                <Popup>
                  <div className="text-xs font-medium">Transit Hub</div>
                  <div className="text-xs text-slate-400">{transitHub.city}, {transitHub.country}</div>
                </Popup>
              </Marker>
            )}

            {/* Shipment current location */}
            <Marker
              position={[s.currentLocation.lat, s.currentLocation.lng]}
              icon={createShipmentIcon(s.riskLevel, isSelected)}
              eventHandlers={{ click: () => onSelect(s.id) }}
            >
              <Popup>
                <div className="bg-slate-900 text-white rounded-lg p-3 min-w-[200px] text-xs">
                  <p className="font-bold text-sm mb-1">{s.trackingCode}</p>
                  <p className="text-slate-300 mb-1">{s.product}</p>
                  {s.currentPhaseName && (
                    <p className="text-purple-300 mb-2 text-[11px]">📍 {s.currentPhaseName}</p>
                  )}
                  <div className="space-y-1">
                    <p>🌡 {s.temperature}°C (range: {s.temperatureMin}–{s.temperatureMax}°C)</p>
                    <p>⚠️ Risk: <span style={{ color: riskDotColor[s.riskLevel] }}>{s.riskLevel.toUpperCase()} ({s.riskScore})</span></p>
                    {s.delayHours > 0 && <p>⏱ Delay: +{s.delayHours}h</p>}
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        )
      })}
    </MapContainer>
  )
}
