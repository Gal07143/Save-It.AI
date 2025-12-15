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

export default function App() {
  const [currentSite, setCurrentSite] = useState<number | null>(null)

  return (
    <Layout currentSite={currentSite} onSiteChange={setCurrentSite}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/sites" component={Sites} />
        <Route path="/assets" component={Assets} />
        <Route path="/meters" component={Meters} />
        <Route path="/bills" component={Bills} />
        <Route path="/tenants" component={Tenants} />
        <Route path="/bess" component={BESSSimulator} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/gap-analysis" component={GapAnalysis} />
        <Route path="/notifications" component={Notifications} />
        <Route>404 - Page Not Found</Route>
      </Switch>
    </Layout>
  )
}
