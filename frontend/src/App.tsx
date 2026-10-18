import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardProvider } from './context/DashboardContext'
import { AppShell } from './components/layout/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { JobsPage } from './pages/JobsPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { ActivityPage } from './pages/ActivityPage'
import { SimulatorPage } from './pages/SimulatorPage'
import { PolicyPage } from './pages/PolicyPage'
import { LiveAgentDemoPage } from './pages/LiveAgentDemoPage'
import { LandingPage } from './pages/LandingPage'

export default function App() {
  return (
    <DashboardProvider>
      <BrowserRouter>
        <Routes>
          {/* Opening the site lands on the landing page; the owner console starts at /dashboard. */}
          <Route index element={<Navigate to="/landing" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<OverviewPage />} />
            <Route path="live-demo" element={<LiveAgentDemoPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="jobs/:jobId" element={<JobDetailPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="simulator" element={<SimulatorPage />} />
            <Route path="policy/:policyId" element={<PolicyPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </BrowserRouter>
    </DashboardProvider>
  )
}
