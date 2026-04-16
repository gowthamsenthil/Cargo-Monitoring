import React, { useState } from 'react'
import clsx from 'clsx'
import { X, Package, Thermometer, MapPin, Plane, Users, DollarSign, Plus } from 'lucide-react'
import { CreateShipmentPayload } from '../../hooks/useShipments'

interface Props {
  onClose: () => void
  onCreate: (p: CreateShipmentPayload) => Promise<void>
}

const CITIES = [
  { label: 'Amsterdam (AMS)', city: 'Amsterdam', country: 'Netherlands', lat: 52.31, lng: 4.77 },
  { label: 'Frankfurt (FRA)', city: 'Frankfurt', country: 'Germany', lat: 50.04, lng: 8.56 },
  { label: 'Dubai (DXB)', city: 'Dubai', country: 'UAE', lat: 25.25, lng: 55.36 },
  { label: 'Singapore (SIN)', city: 'Singapore', country: 'Singapore', lat: 1.35, lng: 103.99 },
  { label: 'New York (JFK)', city: 'New York', country: 'USA', lat: 40.64, lng: -73.78 },
  { label: 'Chicago (ORD)', city: 'Chicago', country: 'USA', lat: 41.97, lng: -87.91 },
  { label: 'London (LHR)', city: 'London', country: 'UK', lat: 51.48, lng: -0.46 },
  { label: 'Mumbai (BOM)', city: 'Mumbai', country: 'India', lat: 19.09, lng: 72.87 },
  { label: 'São Paulo (GRU)', city: 'São Paulo', country: 'Brazil', lat: -23.43, lng: -46.47 },
  { label: 'Tokyo (NRT)', city: 'Tokyo', country: 'Japan', lat: 35.77, lng: 140.39 },
  { label: 'Nairobi (NBO)', city: 'Nairobi', country: 'Kenya', lat: -1.32, lng: 36.92 },
  { label: 'Sydney (SYD)', city: 'Sydney', country: 'Australia', lat: -33.94, lng: 151.18 },
  { label: 'Cairo (CAI)', city: 'Cairo', country: 'Egypt', lat: 30.12, lng: 31.41 },
  { label: 'Seoul (ICN)', city: 'Seoul', country: 'South Korea', lat: 37.46, lng: 126.44 },
  { label: 'Johannesburg (JNB)', city: 'Johannesburg', country: 'South Africa', lat: -26.14, lng: 28.24 },
]

const PRODUCT_TEMPLATES = [
  { label: 'mRNA Vaccine', product: 'COVID-19 mRNA Vaccine', productType: 'vaccine', tempMin: -80, tempMax: -60, unit: 'vials', partner: 'BioNTech SE' },
  { label: 'Flu Vaccine', product: 'Seasonal Influenza Vaccine', productType: 'vaccine', tempMin: 2, tempMax: 8, unit: 'vials', partner: 'Sanofi Pasteur' },
  { label: 'Insulin', product: 'Recombinant Human Insulin', productType: 'specialty_med', tempMin: 2, tempMax: 8, unit: 'pens', partner: 'Novo Nordisk' },
  { label: 'Blood Products', product: 'Fresh Frozen Plasma', productType: 'blood_product', tempMin: -30, tempMax: -18, unit: 'units', partner: 'Red Cross' },
  { label: 'Monoclonal Ab', product: 'Trastuzumab (Herceptin)', productType: 'specialty_med', tempMin: 2, tempMax: 8, unit: 'vials', partner: 'Roche AG' },
  { label: 'Oncology Drug', product: 'Pembrolizumab (Keytruda)', productType: 'specialty_med', tempMin: 2, tempMax: 8, unit: 'vials', partner: 'Merck KGaA' },
  { label: 'Diagnostic Kit', product: 'PCR Diagnostic Kit', productType: 'diagnostic', tempMin: 4, tempMax: 25, unit: 'kits', partner: '' },
  { label: 'Custom', product: '', productType: 'specialty_med', tempMin: 2, tempMax: 8, unit: 'units', partner: '' },
]

const CARRIERS = [
  'Emirates Cargo', 'Lufthansa Cargo', 'Singapore Airlines Cargo',
  'Air France Cargo', 'ANA Cargo', 'British Airways World Cargo',
  'LATAM Cargo', 'Ethiopian Cargo', 'Qatar Airways Cargo', 'DHL Aviation',
]

export default function CreateShipmentModal({ onClose, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tpl, setTpl] = useState(PRODUCT_TEMPLATES[0])
  const [product, setProduct] = useState(PRODUCT_TEMPLATES[0].product)
  const [productType, setProductType] = useState(PRODUCT_TEMPLATES[0].productType)
  const [tempMin, setTempMin] = useState(PRODUCT_TEMPLATES[0].tempMin)
  const [tempMax, setTempMax] = useState(PRODUCT_TEMPLATES[0].tempMax)
  const [unit, setUnit] = useState(PRODUCT_TEMPLATES[0].unit)
  const [partner, setPartner] = useState(PRODUCT_TEMPLATES[0].partner)

  const [originIdx, setOriginIdx] = useState(0)
  const [destIdx, setDestIdx] = useState(4)
  const [carrier, setCarrier] = useState(CARRIERS[0])
  const [flightNumber, setFlightNumber] = useState('')
  const [quantity, setQuantity] = useState(5000)
  const [value, setValue] = useState(250000)
  const [appointments, setAppointments] = useState<number | ''>('')
  const [humidity, setHumidity] = useState(45)

  function applyTemplate(idx: number) {
    const t = PRODUCT_TEMPLATES[idx]
    setTpl(t)
    setProduct(t.product)
    setProductType(t.productType)
    setTempMin(t.tempMin)
    setTempMax(t.tempMax)
    setUnit(t.unit)
    setPartner(t.partner)
  }

  async function handleSubmit() {
    if (!product.trim()) { setError('Product name is required'); return }
    if (originIdx === destIdx) { setError('Origin and destination must differ'); return }
    setLoading(true)
    setError(null)
    try {
      await onCreate({
        product,
        productType,
        origin: CITIES[originIdx],
        destination: CITIES[destIdx],
        carrier,
        flightNumber: flightNumber || undefined,
        temperatureMin: tempMin,
        temperatureMax: tempMax,
        humidity,
        quantity,
        unit,
        value,
        healthcarePartner: partner || undefined,
        appointments: appointments !== '' ? Number(appointments) : undefined,
      })
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Failed to create shipment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Package size={18} className="text-brand-400" />
              New Shipment
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Step {step} of 2 · LangGraph agent will analyse on creation</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {step === 1 && (
            <>
              {/* Product template */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Product Template</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRODUCT_TEMPLATES.map((t, i) => (
                    <button
                      key={t.label}
                      onClick={() => applyTemplate(i)}
                      className={clsx(
                        'text-xs py-2 px-2 rounded-lg border transition-colors text-center',
                        tpl.label === t.label
                          ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                          : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product name & type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Product Name *</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                    value={product}
                    onChange={e => setProduct(e.target.value)}
                    placeholder="e.g. Trastuzumab 440mg"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Product Type</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                    value={productType}
                    onChange={e => setProductType(e.target.value)}
                  >
                    <option value="vaccine">Vaccine</option>
                    <option value="specialty_med">Specialty Medicine</option>
                    <option value="blood_product">Blood Product</option>
                    <option value="diagnostic">Diagnostic</option>
                  </select>
                </div>
              </div>

              {/* Temperature */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block flex items-center gap-1.5">
                  <Thermometer size={11} /> Temperature Range (°C) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Minimum</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                      value={tempMin} onChange={e => setTempMin(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Maximum</label>
                    <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                      value={tempMax} onChange={e => setTempMax(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Quantity + Value */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Quantity</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                    value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Unit</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                    value={unit} onChange={e => setUnit(e.target.value)} placeholder="vials / units / kits" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block flex items-center gap-1">
                    <DollarSign size={10} /> Cargo Value (USD)
                  </label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                    value={value} onChange={e => setValue(Number(e.target.value))} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Route */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block flex items-center gap-1.5">
                  <MapPin size={11} /> Route *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Origin</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                      value={originIdx} onChange={e => setOriginIdx(Number(e.target.value))}>
                      {CITIES.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Destination</label>
                    <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                      value={destIdx} onChange={e => setDestIdx(Number(e.target.value))}>
                      {CITIES.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                {originIdx === destIdx && (
                  <p className="text-xs text-red-400 mt-1">Origin and destination must be different</p>
                )}
              </div>

              {/* Carrier */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block flex items-center gap-1.5">
                    <Plane size={11} /> Carrier
                  </label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                    value={carrier} onChange={e => setCarrier(e.target.value)}>
                    {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Flight Number (optional)</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                    value={flightNumber} onChange={e => setFlightNumber(e.target.value)} placeholder="e.g. EK9202" />
                </div>
              </div>

              {/* Healthcare partner */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block flex items-center gap-1.5">
                    <Users size={11} /> Healthcare Partner (optional)
                  </label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                    value={partner} onChange={e => setPartner(e.target.value)} placeholder="Hospital / Clinic name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Linked Appointments</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                    value={appointments} onChange={e => setAppointments(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0" min={0} />
                </div>
              </div>

              {/* Summary box */}
              <div className="glass border border-white/8 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="text-slate-500">Product:</span><span className="text-white">{product}</span></div>
                  <div className="flex gap-2"><span className="text-slate-500">Temp:</span><span className="text-white">{tempMin}°C → {tempMax}°C</span></div>
                  <div className="flex gap-2"><span className="text-slate-500">Route:</span><span className="text-white">{CITIES[originIdx].city} → {CITIES[destIdx].city}</span></div>
                  <div className="flex gap-2"><span className="text-slate-500">Carrier:</span><span className="text-white">{carrier}</span></div>
                  <div className="flex gap-2"><span className="text-slate-500">Quantity:</span><span className="text-white">{quantity.toLocaleString()} {unit}</span></div>
                  <div className="flex gap-2"><span className="text-slate-500">Value:</span><span className="text-white">${value.toLocaleString()}</span></div>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <div className={clsx('w-2 h-2 rounded-full', step >= 1 ? 'bg-brand-500' : 'bg-white/20')} />
            <div className={clsx('w-2 h-2 rounded-full', step >= 2 ? 'bg-brand-500' : 'bg-white/20')} />
          </div>
          <div className="flex gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-sm border border-white/10 text-slate-300 hover:bg-white/5 transition-colors">
                Back
              </button>
            )}
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!product.trim()}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 transition-colors"
              >
                Next: Route →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || originIdx === destIdx}
                className="px-5 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                ) : (
                  <><Plus size={14} /> Create Shipment</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
