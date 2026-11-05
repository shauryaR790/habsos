import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { formatINR, formatWhen, maskMobile, registerPath, type CustomerSummary, type Order } from '../../../shared/domain';
import { useTitle } from '../../lib/useTitle';
import { api } from '../../lib/api';
import { Button as FieldButton } from '../../components/Button';
import { Input as Field } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { usePos } from './PosContext';
import type { BackendChromeContext } from './odoo/OdooBackendLayout';

type CustomerFilter = 'all' | 'loyalty';

export function CustomersPage() {
  useTitle('Customers');
  const pos = usePos();
  const navigate = useNavigate();
  const { search, setSearch, setPagerLabel } = useOutletContext<BackendChromeContext>();
  const [shown, setShown] = useState<string | null>(null);
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [add, setAdd] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ customer: CustomerSummary; orders: Order[] } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CustomerSummary | null>(null);

  const customers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return pos.customers
      .filter((customer) => {
        if (filter === 'loyalty' && customer.orderCount < 2) return false;
        if (!needle) return true;
        return customer.name.toLowerCase().includes(needle) || customer.mobile.endsWith(needle) || customer.mobile.includes(needle);
      })
      .sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''));
  }, [filter, pos.customers, search]);

  useEffect(() => {
    const n = customers.length;
    setPagerLabel(n ? `1-${n} / ${n}` : '0-0 / 0');
  }, [customers.length, setPagerLabel]);

  async function saveCustomer() {
    setBusy(true);
    try {
      await pos.createCustomer({ name, mobile });
      setName('');
      setMobile('');
      setAdd(false);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await pos.removeCustomer(removeTarget.id);
      if (history?.customer.id === removeTarget.id) setHistory(null);
      if (shown === removeTarget.id) setShown(null);
      setRemoveTarget(null);
    } finally {
      setBusy(false);
    }
  }

  async function openHistory(customer: CustomerSummary) {
    const local = pos.orders.filter((order) => (
      (customer.mobile && order.customerMobile.replace(/\D/g, '').endsWith(customer.mobile.slice(-10)))
      || order.customerName === customer.name
    )).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setHistory({ customer, orders: local });
    if (pos.conn === 'OFFLINE') return;
    try {
      const result = await api<{ orders: Order[] }>(`/api/customers/${customer.id}/orders`);
      setHistory({ customer, orders: result.orders });
    } catch {
      /* keep local */
    }
  }

  const emptyCopy = search.trim() || filter === 'loyalty'
    ? 'Nobody matches that filter.'
    : 'No customers yet';

  return (
    <section className="o-cust">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#dee2e6] bg-white px-4 py-3">
        <Input
          value={search}
          placeholder="Search name or mobile"
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 w-[240px] max-w-full bg-white"
        />
        <Select value={filter} onValueChange={(value) => setFilter(value as CustomerFilter)}>
          <SelectTrigger className="w-[180px] bg-white" aria-label="Filter customers">
            <SelectValue placeholder="Filter customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="loyalty">Loyalty</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setAdd(true)}>Add customer</Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {pos.customers.length} on file · {pos.customers.filter((row) => row.orderCount >= 2).length} loyalty
        </span>
      </div>

      {customers.length === 0 ? (
        <p className="o-cust__empty">{emptyCopy}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky top-0 whitespace-nowrap bg-[#f8f9fa]">Name</TableHead>
                <TableHead className="sticky top-0 whitespace-nowrap bg-[#f8f9fa]">Mobile</TableHead>
                <TableHead className="sticky top-0 whitespace-nowrap bg-[#f8f9fa]">Visits</TableHead>
                <TableHead className="sticky top-0 whitespace-nowrap bg-[#f8f9fa]">Spent</TableHead>
                <TableHead className="sticky top-0 whitespace-nowrap bg-[#f8f9fa]">Last</TableHead>
                <TableHead className="sticky top-0 whitespace-nowrap bg-[#f8f9fa] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const open = shown === customer.id;
                return (
                  <TableRow key={customer.id} className={cn(open && 'bg-muted/50')}>
                    <TableCell className="whitespace-nowrap font-medium text-[#212529]">
                      {customer.name}
                      {customer.orderCount >= 2 ? (
                        <span className="ml-2 inline-flex rounded-full bg-[#f1f3f5] px-2 py-0.5 text-xs font-medium text-[#495057]">
                          Loyalty
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-[#212529]">
                      {open ? customer.mobile : maskMobile(customer.mobile)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{customer.orderCount}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatINR(customer.spent)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {customer.lastOrderAt ? formatWhen(customer.lastOrderAt) : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShown((current) => (current === customer.id ? null : customer.id))}
                        >
                          {open ? 'Hide' : 'Show'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => void openHistory(customer)}>
                          Bills
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => navigate(registerPath({
                            mode: 'pickup',
                            customerName: customer.name,
                            customerMobile: customer.mobile,
                          }))}
                        >
                          Order
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setRemoveTarget(customer)}>
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {removeTarget ? (
        <Modal open title="Remove customer" onClose={() => setRemoveTarget(null)}>
          <p>Remove <strong>{removeTarget.name}</strong> from the customer list? Past bills stay in reports; only the profile is deleted.</p>
          <div className="run-acts">
            <FieldButton variant="ghost" onClick={() => setRemoveTarget(null)}>Cancel</FieldButton>
            <FieldButton disabled={busy} onClick={() => void confirmRemove()}>Remove</FieldButton>
          </div>
        </Modal>
      ) : null}

      {add ? (
        <Modal open title="Add customer" onClose={() => setAdd(false)}>
          <div className="tv-form">
            <Field label="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <Field label="Mobile" inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} />
            <FieldButton disabled={busy || !name.trim() || !mobile.trim()} onClick={() => void saveCustomer()}>Save</FieldButton>
          </div>
        </Modal>
      ) : null}

      {history ? (
        <Modal open title={`${history.customer.name} · Bills`} onClose={() => setHistory(null)}>
          <p className="o-bills__meta">
            {history.customer.orderCount} visits · {formatINR(history.customer.spent)} · {shown === history.customer.id ? history.customer.mobile : maskMobile(history.customer.mobile)}
          </p>
          {history.orders.length === 0 ? (
            <p className="o-bills__empty">No bills yet</p>
          ) : (
            <div className="o-bills">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="bg-[#f8f9fa]">Bill</TableHead>
                    <TableHead className="bg-[#f8f9fa]">When</TableHead>
                    <TableHead className="bg-[#f8f9fa]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/pos/orders/${order.id}`)}
                    >
                      <TableCell className="whitespace-nowrap">#{order.orderNumber || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatWhen(order.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatINR(order.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Modal>
      ) : null}
    </section>
  );
}
