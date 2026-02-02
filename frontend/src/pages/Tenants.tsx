import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import {
  Plus, FileText, Mail, Users, ClipboardList, Receipt, CreditCard, DollarSign,
  FileBarChart, Search, Filter, Edit2, Trash2, X, AlertTriangle, Building2, Phone
} from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'

interface TenantsProps {
  currentSite?: number | null
}

interface TenantFormData {
  site_id: number
  name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  billing_address: string
  tax_id: string
}

export default function Tenants({ currentSite }: TenantsProps) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const [showInvoiceForm, setShowInvoiceForm] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [siteFilter, setSiteFilter] = useState<number | 'all'>(currentSite || 'all')
  const [formData, setFormData] = useState<TenantFormData>({
    site_id: currentSite || 1,
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    billing_address: '',
    tax_id: ''
  })
  const [editFormData, setEditFormData] = useState<TenantFormData>({
    site_id: 1,
    name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    billing_address: '',
    tax_id: ''
  })
  const [invoiceData, setInvoiceData] = useState({ start: '', end: '' })

  const { data: tenants, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: () => api.tenants.list() })
  const { data: invoices } = useQuery({ queryKey: ['invoices'], queryFn: () => api.invoices.list() })
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { data: contracts } = useQuery({ queryKey: ['contracts'], queryFn: () => fetch('/api/v1/lease-contracts').then(r => r.json()).catch(() => []) })

  // Filter tenants by search and site
  const filteredTenants = useMemo(() => {
    if (!tenants) return []
    return tenants.filter(tenant => {
      const matchesSite = siteFilter === 'all' || tenant.site_id === siteFilter
      const matchesSearch = !searchQuery ||
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.contact_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSite && matchesSearch
    })
  }, [tenants, siteFilter, searchQuery])

  // Calculate stats per tenant
  const tenantsWithStats = useMemo(() => {
    return filteredTenants.map(tenant => {
      const site = sites?.find(s => s.id === tenant.site_id)
      const tenantContracts = Array.isArray(contracts) ? contracts.filter((c: any) => c.tenant_id === tenant.id) : []
      const tenantInvoices = invoices?.filter(i => i.tenant_id === tenant.id) || []
      const totalBilled = tenantInvoices.reduce((sum, inv) => sum + inv.total_amount, 0)
      const unpaidInvoices = tenantInvoices.filter(i => i.status !== 'paid').length

      return {
        ...tenant,
        site_name: site?.name || 'Unknown Site',
        contracts_count: tenantContracts.length,
        active_contracts: tenantContracts.filter((c: any) => c.is_active).length,
        invoices_count: tenantInvoices.length,
        total_billed: totalBilled,
        unpaid_invoices: unpaidInvoices
      }
    })
  }, [filteredTenants, sites, contracts, invoices])

  const createMutation = useMutation({
    mutationFn: api.tenants.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowForm(false)
      setFormData({ site_id: currentSite || 1, name: '', contact_name: '', contact_email: '', contact_phone: '', billing_address: '', tax_id: '' })
      success('Tenant Created', 'Tenant has been added successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to create tenant')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TenantFormData> }) => api.tenants.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowEditModal(false)
      setSelectedTenant(null)
      success('Tenant Updated', 'Tenant has been updated successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to update tenant')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: api.tenants.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      setShowDeleteConfirm(false)
      setSelectedTenant(null)
      success('Tenant Deleted', 'Tenant has been deleted successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to delete tenant')
    }
  })

  const generateInvoiceMutation = useMutation({
    mutationFn: ({ tenantId, start, end }: { tenantId: number; start: string; end: string }) =>
      api.tenants.generateInvoice(tenantId, start, end),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowInvoiceForm(null)
      success('Invoice Generated', 'Invoice has been generated successfully')
    },
  })

  const handleEdit = (tenant: any) => {
    setSelectedTenant(tenant)
    setEditFormData({
      site_id: tenant.site_id,
      name: tenant.name || '',
      contact_name: tenant.contact_name || '',
      contact_email: tenant.contact_email || '',
      contact_phone: tenant.contact_phone || '',
      billing_address: tenant.billing_address || '',
      tax_id: tenant.tax_id || ''
    })
    setShowEditModal(true)
  }

  const handleDelete = (tenant: any) => {
    setSelectedTenant(tenant)
    setShowDeleteConfirm(true)
  }

  const tabs: Tab[] = [
    { id: 'tenants', label: 'Tenant List', icon: Users, badge: filteredTenants?.length },
    { id: 'leases', label: 'Lease Contracts', icon: ClipboardList, badge: Array.isArray(contracts) ? contracts.length : undefined },
    { id: 'invoices', label: 'Invoices', icon: Receipt, badge: invoices?.length },
    { id: 'payments', label: 'Payment Tracking', icon: CreditCard },
    { id: 'charges', label: 'Charges', icon: DollarSign },
    { id: 'statements', label: 'Statements', icon: FileBarChart },
  ]

  const renderTenantList = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#f1f5f9',
                fontSize: '0.875rem',
                minWidth: '200px'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Filter size={16} color="#64748b" />
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                color: '#f1f5f9',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Sites</option>
              {sites?.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          Add Tenant
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>New Tenant</h3>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Site *</label>
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
                <label className="form-label">Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
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
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tax ID</label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label">Billing Address</label>
              <textarea
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
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
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Tenants</h2>
          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {filteredTenants.length} tenant{filteredTenants.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isLoading ? (
          <p style={{ padding: '1rem' }}>Loading...</p>
        ) : tenantsWithStats && tenantsWithStats.length > 0 ? (
          <div>
            {tenantsWithStats.map((tenant) => (
              <div key={tenant.id} style={{
                padding: '1rem',
                borderBottom: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>{tenant.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    <Building2 size={14} />
                    {tenant.site_name}
                  </div>
                  {tenant.contact_email && (
                    <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Mail size={12} />
                      {tenant.contact_email}
                    </div>
                  )}
                  {tenant.contact_phone && (
                    <div style={{ fontSize: '0.875rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Phone size={12} />
                      {tenant.contact_phone}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: tenant.active_contracts > 0 ? '#10b981' : '#64748b' }}>
                      {tenant.active_contracts}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Contracts</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3b82f6' }}>
                      {tenant.invoices_count}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Invoices</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                      ${tenant.total_billed.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Billed</div>
                  </div>
                  {tenant.unpaid_invoices > 0 && (
                    <div style={{ textAlign: 'center', minWidth: '70px' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b' }}>
                        {tenant.unpaid_invoices}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Unpaid</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                    onClick={() => setShowInvoiceForm(showInvoiceForm === tenant.id ? null : tenant.id)}
                    title="Generate Invoice"
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                    onClick={() => handleEdit(tenant)}
                    title="Edit Tenant"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', color: '#ef4444', borderColor: '#ef4444' }}
                    onClick={() => handleDelete(tenant)}
                    title="Delete Tenant"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
            {searchQuery || siteFilter !== 'all' ? 'No tenants match your filters' : 'No tenants found'}
          </p>
        )}

        {showInvoiceForm && (
          <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.5)', marginTop: '1rem', borderRadius: '0.5rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Generate Invoice for {tenantsWithStats.find(t => t.id === showInvoiceForm)?.name}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={() => generateInvoiceMutation.mutate({
                  tenantId: showInvoiceForm,
                  start: invoiceData.start,
                  end: invoiceData.end,
                })}
                disabled={!invoiceData.start || !invoiceData.end || generateInvoiceMutation.isPending}
              >
                {generateInvoiceMutation.isPending ? 'Generating...' : 'Generate'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowInvoiceForm(null)}>
                Cancel
              </button>
            </div>
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
      {Array.isArray(contracts) && contracts.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Contract Name</th>
              <th>Tenant</th>
              <th>Start Date</th>
              <th>Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract: any) => {
              const tenant = tenants?.find(t => t.id === contract.tenant_id)
              return (
                <tr key={contract.id}>
                  <td>{contract.name}</td>
                  <td>{tenant?.name || 'Unknown'}</td>
                  <td>{new Date(contract.start_date).toLocaleDateString()}</td>
                  <td>${contract.rate_per_kwh?.toFixed(3)}/kWh</td>
                  <td>
                    <span className={`badge badge-${contract.is_active ? 'success' : 'warning'}`}>
                      {contract.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <ClipboardList size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ marginBottom: '0.5rem', color: '#334155' }}>No Lease Contracts</h3>
          <p>Create lease contracts to define billing rates and terms for your tenants.</p>
        </div>
      )}
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
              <th>Tenant</th>
              <th>Period</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const tenant = tenants?.find(t => t.id === invoice.tenant_id)
              return (
                <tr key={invoice.id}>
                  <td><code>{invoice.invoice_number}</code></td>
                  <td>{tenant?.name || 'Unknown'}</td>
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
              )
            })}
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

      {/* Edit Modal */}
      {showEditModal && selectedTenant && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Tenant</h2>
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Site</label>
                  <select
                    value={editFormData.site_id}
                    onChange={(e) => setEditFormData({ ...editFormData, site_id: Number(e.target.value) })}
                  >
                    {sites?.map(site => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Tenant Name *</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contact Name</label>
                  <input
                    type="text"
                    value={editFormData.contact_name}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    value={editFormData.contact_email}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    value={editFormData.contact_phone}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Tax ID</label>
                  <input
                    type="text"
                    value={editFormData.tax_id}
                    onChange={(e) => setEditFormData({ ...editFormData, tax_id: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>Billing Address</label>
                <textarea
                  value={editFormData.billing_address}
                  onChange={(e) => setEditFormData({ ...editFormData, billing_address: e.target.value })}
                  rows={2}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={() => updateMutation.mutate({ id: selectedTenant.id, data: editFormData })}
                disabled={updateMutation.isPending}
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedTenant && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Tenant</h2>
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ textAlign: 'center' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
              <p style={{ marginBottom: '0.5rem' }}>Are you sure you want to delete this tenant?</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '1rem' }}>{selectedTenant.name}</p>
              {selectedTenant.active_contracts > 0 && (
                <p style={{ color: '#f59e0b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Warning: This tenant has {selectedTenant.active_contracts} active contract(s).
                </p>
              )}
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => deleteMutation.mutate(selectedTenant.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #1e293b;
          border-radius: 0.75rem;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #334155;
        }

        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .form-group {
          margin-bottom: 0.75rem;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #0f172a;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          color: #f8fafc;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #10b981;
        }
      `}</style>
    </div>
  )
}
