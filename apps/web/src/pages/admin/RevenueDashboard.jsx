import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, XCircle, CreditCard, Smartphone, Banknote, Download } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const METHOD_ICONS = {
  cash: { icon: Banknote,     label: 'Cash',  color: 'text-green-600 bg-green-50 border-green-200' },
  upi:  { icon: Smartphone,   label: 'UPI',   color: 'text-blue-600 bg-blue-50 border-blue-200' },
  card: { icon: CreditCard,   label: 'Card',  color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

export default function RevenueDashboard() {
  const toast = useToast();
  const [revenue, setRevenue] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [rangeData, setRangeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feeModal, setFeeModal] = useState(null);
  const [feeForm, setFeeForm] = useState({ fee: '', method: 'cash' });
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    fetchToday();
    fetchQueue();
  }, []);

  const fetchToday = async () => {
    setLoading(true);
    try {
      const res = await api.get('/revenue/today');
      setRevenue(res.data);
    } catch {
      toast.error('Failed to load revenue');
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await api.get('/queue/live');
      setQueue(res.data || []);
    } catch {}
  };

  const fetchRange = async () => {
    if (!range.from || !range.to) return toast.error('Select date range');
    try {
      const res = await api.get(`/revenue/range?from=${range.from}&to=${range.to}`);
      setRangeData(res.data.revenue || []);
    } catch {
      toast.error('Failed to load range data');
    }
  };

  const collectFee = async () => {
    if (!feeForm.fee) return toast.error('Enter fee amount');
    try {
      await api.patch(`/revenue/queue/${feeModal}/collect-fee`, {
        fee: parseInt(feeForm.fee),
        method: feeForm.method
      });
      toast.success('Fee collected successfully');
      setFeeModal(null);
      setFeeForm({ fee: '', method: 'cash' });
      fetchToday();
      fetchQueue();
    } catch {
      toast.error('Failed to collect fee');
    }
  };

  const downloadReport = async () => {
    try {
      const res = await api.get('/revenue/end-of-day');
      const report = res.data;
      const text = `
DAILY REVENUE REPORT
====================
Clinic: ${report.clinic}
Date: ${report.date}
Generated: ${new Date(report.generated_at).toLocaleString('en-IN')}

SUMMARY
-------
Total Patients:     ${report.total_patients}
Completed:          ${report.completed}
Revenue Collected:  ₹${report.revenue_collected}
Pending Fee:        ${report.pending_fee} patients

PAYMENT BREAKDOWN
-----------------
Cash:   ₹${report.cash}
UPI:    ₹${report.upi}
Card:   ₹${report.card}
Total:  ₹${report.revenue_collected}
      `.trim();

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue_${report.date}.txt`;
      a.click();
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to generate report');
    }
  };

  const pendingFeeQueue = queue.filter(q => q.status === 'done' && !q.fee_collected);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Revenue Dashboard</h1>
            <p className="text-gray-500 text-sm">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
          </div>
          <button onClick={downloadReport}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">
            <Download className="w-4 h-4" /> Download Report
          </button>
        </div>

        {/* Today's Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-2xl h-28 border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Revenue', value: `₹${revenue?.total || 0}`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
              { label: 'Patients Billed', value: revenue?.count || 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
              { label: 'Avg Fee', value: `₹${revenue?.avg || 0}`, icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
              { label: 'No-Shows', value: revenue?.noShows || 0, icon: XCircle, color: 'text-red-600 bg-red-50' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Payment Method Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Payment Breakdown</h2>
            <div className="space-y-3">
              {Object.entries(METHOD_ICONS).map(([key, val]) => {
                const amount = revenue?.[key] || 0;
                const total = revenue?.total || 1;
                const pct = Math.round((amount / total) * 100);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${val.color}`}>
                          {val.label}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">₹{amount}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Doctor Wise Revenue */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4">Doctor-wise Revenue</h2>
            {revenue?.byDoctor?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No data yet today</p>
            ) : (
              <div className="space-y-3">
                {(revenue?.byDoctor || []).map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.count} patients</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">₹{doc.total}</p>
                      <p className="text-xs text-gray-400">
                        avg ₹{doc.count > 0 ? Math.round(doc.total / doc.count) : 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Fee Collection */}
        {pendingFeeQueue.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold text-orange-800 mb-3">
              ⚠️ Fee Pending — {pendingFeeQueue.length} patients
            </h2>
            <div className="space-y-2">
              {pendingFeeQueue.map(entry => (
                <div key={entry.id}
                  className="bg-white rounded-xl p-3 flex items-center justify-between border border-orange-100">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{entry.users?.name}</p>
                    <p className="text-xs text-gray-500">Token: {entry.token_number}</p>
                  </div>
                  <button
                    onClick={() => setFeeModal(entry.id)}
                    className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-600">
                    Collect Fee
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date Range Report */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Revenue by Date Range</h2>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date"
                value={range.from}
                onChange={e => setRange(p => ({ ...p, from: e.target.value }))}
                className="border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date"
                value={range.to}
                onChange={e => setRange(p => ({ ...p, to: e.target.value }))}
                className="border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex items-end">
              <button onClick={fetchRange}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">
                Generate
              </button>
            </div>
          </div>

          {rangeData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Patients</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Revenue</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Avg Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeData.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 text-gray-800">
                        {new Date(row.date).toLocaleDateString('en-IN', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })}
                      </td>
                      <td className="py-2 text-right text-gray-600">{row.count}</td>
                      <td className="py-2 text-right font-semibold text-green-600">₹{row.total}</td>
                      <td className="py-2 text-right text-gray-500">
                        ₹{row.count > 0 ? Math.round(row.total / row.count) : 0}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50">
                    <td className="py-2 font-bold text-gray-800">Total</td>
                    <td className="py-2 text-right font-bold text-gray-800">
                      {rangeData.reduce((s, r) => s + r.count, 0)}
                    </td>
                    <td className="py-2 text-right font-bold text-green-700">
                      ₹{rangeData.reduce((s, r) => s + r.total, 0)}
                    </td>
                    <td className="py-2 text-right text-gray-500">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Collect Fee Modal */}
      {feeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Collect Consultation Fee</h2>

            <label className="block text-sm text-gray-600 mb-1">Amount (₹) *</label>
            <input
              type="number"
              value={feeForm.fee}
              onChange={e => setFeeForm(p => ({ ...p, fee: e.target.value }))}
              placeholder="e.g. 300"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm mb-4 focus:outline-none focus:border-blue-400"
            />

            <label className="block text-sm text-gray-600 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {Object.entries(METHOD_ICONS).map(([key, val]) => (
                <button key={key}
                  onClick={() => setFeeForm(p => ({ ...p, method: key }))}
                  className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                    feeForm.method === key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {val.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setFeeModal(null); setFeeForm({ fee: '', method: 'cash' }); }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm">
                Cancel
              </button>
              <button
                onClick={collectFee}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-700">
                ✓ Collect ₹{feeForm.fee || 0}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}