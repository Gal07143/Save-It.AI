import { useState } from 'react'
import { Route, Switch } from 'wouter'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Sites from './pages/Sites'
import Assets from './pages/Assets'
import Meters from './pages/Meters'
import Bills from './pages/Bills'
import Tenants from './pages/Tenants'
import BESSSimulator from './pages/BESSSimulator'
import Integrations from './pages/Integrations'
import GapAnalysis from './pages/GapAnalysis'
import Notifications from './pages/Notifications'
import Tariffs from './pages/Tariffs'
import CarbonESG from './pages/CarbonESG'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import DataQuality from './pages/DataQuality'
import VirtualMeters from './pages/VirtualMeters'
import Maintenance from './pages/Maintenance'
import AIAgents from './pages/AIAgents'
import Forecasting from './pages/Forecasting'
import Admin from './pages/Admin'

export default function App() {
  const [currentSite, setCurrentSite] = useState<number | null>(null)

  return (
    <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
      <Switch>
        <Route path="/">{() => <Dashboard />}</Route>
        <Route path="/sites">{() => <Sites />}</Route>
        <Route path="/assets">{() => <Assets currentSite={currentSite} />}</Route>
        <Route path="/meters">{() => <Meters currentSite={currentSite} />}</Route>
        <Route path="/bills">{() => <Bills currentSite={currentSite} />}</Route>
        <Route path="/tariffs">{() => <Tariffs currentSite={currentSite} />}</Route>
        <Route path="/tenants">{() => <Tenants currentSite={currentSite} />}</Route>
        <Route path="/bess">{() => <BESSSimulator />}</Route>
        <Route path="/integrations">{() => <Integrations currentSite={currentSite} />}</Route>
        <Route path="/gap-analysis">{() => <GapAnalysis currentSite={currentSite} />}</Route>
        <Route path="/carbon">{() => <CarbonESG currentSite={currentSite} />}</Route>
        <Route path="/reports">{() => <Reports currentSite={currentSite} />}</Route>
        <Route path="/notifications">{() => <Notifications currentSite={currentSite} />}</Route>
        <Route path="/settings">{() => <Settings />}</Route>
        <Route path="/data-quality">{() => <DataQuality />}</Route>
        <Route path="/virtual-meters">{() => <VirtualMeters />}</Route>
        <Route path="/maintenance">{() => <Maintenance />}</Route>
        <Route path="/ai-agents">{() => <AIAgents />}</Route>
        <Route path="/forecasting">{() => <Forecasting />}</Route>
        <Route path="/admin">{() => <Admin />}</Route>
        <Route>404 - Page Not Found</Route>
      </Switch>
    </Layout>
  )
}
