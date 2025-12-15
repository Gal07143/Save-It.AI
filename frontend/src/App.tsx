import { useState } from 'react'
import { Route, Switch, Redirect } from 'wouter'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
import Gateways from './pages/Gateways'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import DataQuality from './pages/DataQuality'
import VirtualMeters from './pages/VirtualMeters'
import Maintenance from './pages/Maintenance'
import AIAgents from './pages/AIAgents'
import Forecasting from './pages/Forecasting'
import Admin from './pages/Admin'
import Login from './pages/Login'
import DataIngestion from './pages/DataIngestion'
import DigitalTwinBuilder from './pages/DigitalTwinBuilder'
import MVAudit from './pages/MVAudit'
import SupplierComparison from './pages/SupplierComparison'
import SiteDashboard from './pages/SiteDashboard'
import PVSystems from './pages/PVSystems'
import StorageUnits from './pages/StorageUnits'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />
  }

  return <>{children}</>
}

function AppRoutes() {
  const [currentSite, setCurrentSite] = useState<number | null>(null)
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <Switch>
      <Route path="/login">
        {() => isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>
      
      <Route path="/">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/sites">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Sites />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/site-dashboard/:id">
        {(params) => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <SiteDashboard siteId={params.id ? parseInt(params.id) : null} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/site-dashboard">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <SiteDashboard siteId={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/assets">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Assets currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/twin-builder">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <DigitalTwinBuilder currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/meters">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Meters currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/data-ingestion">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <DataIngestion />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/bills">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Bills currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/tariffs">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Tariffs currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/tenants">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Tenants currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/bess">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <BESSSimulator />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/integrations">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Integrations currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/gap-analysis">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <GapAnalysis currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/gateways">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Gateways />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/reports">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Reports currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/notifications">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Notifications currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/settings">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Settings />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/mv-audit">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <MVAudit currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/supplier-comparison">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <SupplierComparison currentSite={currentSite} />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/data-quality">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <DataQuality />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/virtual-meters">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <VirtualMeters />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/maintenance">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Maintenance />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/ai-agents">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <AIAgents />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/forecasting">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Forecasting />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/admin">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <Admin />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/pv-systems">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <PVSystems />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route path="/storage-units">
        {() => (
          <ProtectedRoute>
            <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
              <StorageUnits />
            </Layout>
          </ProtectedRoute>
        )}
      </Route>
      
      <Route>404 - Page Not Found</Route>
    </Switch>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
