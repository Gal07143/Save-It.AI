import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Plus, FileText, Mail, Users, ClipboardList, Receipt, CreditCard, DollarSign, FileBarChart } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'

interface TenantsProps {
  currentSite?: number | null
}

export default function Tenants({ currentSite: _currentSite }: TenantsProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState<number | null>(null)
  const [formData, setFormData] = useState({ site_id: 1, name: '', contact_email: '' })
  const [invoiceData, setInvoiceData] = useState({ start: '', end: '' })

  const { data: tenants, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: () => api.tenants.list() })
  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: () => api.invoices.list() })
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })

  const createMutation = useMutation({
    mutationFn: api.tenants.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowForm(false)
      setFormData({ site_id: 1, name: '', contact_email: '' })
    },
  })

  const generateInvoiceMutation = useMutation({
    mutationFn: ({ tenantId, start, end }: { tenantId: number; start: string; end: string }) =>
      api.tenants.generateInvoice(tenantId, start, end),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowInvoiceForm(null)
    },
  })

  const tabs: Tab[] = [
    { id: 'tenants', label: 'Tenant List', icon: Users, badge: tenants?.length },
    { id: 'leases', label: 'Lease Contracts', icon: ClipboardList },
    { id: 'invoices', label: 'Invoices', icon: Receipt, badge: invoices?.length },
    { id: 'payments', label: 'Payment Tracking', icon: CreditCard },
    { id: 'charges', label: 'Charges', icon: DollarSign },
    { id: 'statements', label: 'Statements', icon: FileBarChart },
  ]

  const renderTenantList = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          Add Tenant
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>New Tenant</h3>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }}>
            <div className="grid grid-3" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Site</label>
                <select
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: Number(e.target.value) })}
                >
                  {sites?.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tenant Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Email</label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
              </button>
              <button type="button" className="btn btn-outline" style={{ marginLeft: '0.5rem' }} onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Tenants</h2>
        </div>
        {isLoading ? (
          <p>Loading...</p>
        ) : tenants && tenants.length > 0 ? (
          <div>
            {tenants.map((tenant) => (
              <div key={tenant.id} style={{ 
                padding: '1rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{tenant.name}</div>
                  {tenant.contact_email && (
                    <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Mail size={12} />
                      {tenant.contact_email}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-outline"
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                  onClick={() => setShowInvoiceForm(showInvoiceForm === tenant.id ? null : tenant.id)}
                >
                  <FileText size={14} />
                  Generate Invoice
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No tenants found</p>
        )}

        {showInvoiceForm && (
          <div style={{ padding: '1rem', background: '#f8fafc', marginTop: '1rem', borderRadius: '0.5rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Generate Invoice</h4>
            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Billing Start</label>
                <input
                  type="date"
                  value={invoiceData.start}
                  onChange={(e) => setInvoiceData({ ...invoiceData, start: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Billing End</label>
                <input
                  type="date"
                  value={invoiceData.end}
                  onChange={(e) => setInvoiceData({ ...invoiceData, end: e.target.value })}
                />
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
              onClick={() => generateInvoiceMutation.mutate({
                tenantId: showInvoiceForm,
                start: invoiceData.start,
                end: invoiceData.end,
              })}
              disabled={!invoiceData.start || !invoiceData.end || generateInvoiceMutation.isPending}
            >
              {generateInvoiceMutation.isPending ? 'Generating...' : 'Generate'}
            </button>
          </div>
        )}
      </div>
    </>
  )

  const renderLeaseContracts = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Lease Contracts</h2>
      </div>
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <ClipboardList size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3 style={{ marginBottom: '0.5rem', color: '#334155' }}>Lease Contract Management</h3>
        <p>Manage contract terms, start/end dates, renewal options, and lease agreements for all tenants.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>Coming soon: Upload lease documents, set renewal reminders, and track contract history.</p>
      </div>
    </div>
  )

  const renderInvoices = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Invoices</h2>
      </div>
      {invoices && invoices.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Period</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td><code>{invoice.invoice_number}</code></td>
                <td style={{ fontSize: '0.875rem' }}>
                  {new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}
                </td>
                <td>${invoice.total_amount.toLocaleString()}</td>
                <td>
                  <span className={`badge badge-${invoice.status === 'paid' ? 'success' : invoice.status === 'sent' ? 'info' : 'warning'}`}>
                    {invoice.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No invoices generated yet</p>
      )}
    </div>
  )

  const renderPaymentTracking = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Payment Tracking</h2>
      </div>
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <CreditCard size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3 style={{ marginBottom: '0.5rem', color: '#334155' }}>Payment Status & History</h3>
        <p>Track payment status, view payment history, and manage outstanding balances for all tenants.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>Coming soon: Payment reminders, automatic reconciliation, and payment gateway integration.</p>
      </div>
    </div>
  )

  const renderCharges = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Charges</h2>
      </div>
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <DollarSign size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3 style={{ marginBottom: '0.5rem', color: '#334155' }}>Configurable Charge Types</h3>
        <p>Define and manage different charge types including utilities, common area maintenance, and custom fees.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>Coming soon: Rate schedules, tiered pricing, and automatic charge calculations.</p>
      </div>
    </div>
  )

  const renderStatements = () => (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Account Statements</h2>
      </div>
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <FileBarChart size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h3 style={{ marginBottom: '0.5rem', color: '#334155' }}>Account Statements</h3>
        <p>Generate and view account statements showing all transactions, charges, and payments for each tenant.</p>
        <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>Coming soon: Export to PDF, email statements, and customizable statement periods.</p>
      </div>
    </div>
  )

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'tenants':
        return renderTenantList()
      case 'leases':
        return renderLeaseContracts()
      case 'invoices':
        return renderInvoices()
      case 'payments':
        return renderPaymentTracking()
      case 'charges':
        return renderCharges()
      case 'statements':
        return renderStatements()
      default:
        return renderTenantList()
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Tenant Billing Center</h1>
        <p style={{ color: '#64748b' }}>Manage tenants, leases, invoices, and payments</p>
      </div>

      <TabPanel tabs={tabs} variant="default">
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
