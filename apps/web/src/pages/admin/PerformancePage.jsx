import { useState, useEffect } from 'react';
import { Star, Clock, Users, TrendingUp, Award, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm

const getHeatColor = (value, max) => {
  if (max === 0 || value === 0) return 'bg-gray-100';
  const pct = value / max;
  if (pct > 0.8) return 'bg-red-500';
  if (pct > 0.6) return 'bg-orange-400';
  if (pct > 0.4) return 'bg-amber-300';
  if (pct > 0.2) return 'bg-green-300';
  return 'bg-green-100';
};

const formatHour = (h) => {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
};

const RatingStars = ({ rating }) => {
  if (!rating) return <span className="text-gray-400 text-xs">No ratings</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={`text-sm ${s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}>
          ★
        </span>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating}</span>
    </div>
  );
};

export default function PerformancePage() {
  const toast = useToast();
  const [scorecards, setScorecards] = useState([]);
  const [heatmap, setHeatmap] = useState({});
  const [heatmapMax, setHeatmapMax] = useState(0);
  const [retention, setRetention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [perfRes, heatRes, retRes] = await Promise.all([
        api.get(`/performance/doctors?from=${dateRange.from}&to=${dateRange.to}`),
        api.get('/performance/peak-hours?days=30'),
        api.get('/performance/retention')
      ]);
      setScorecards(perfRes.data.scorecards || []);
      setHeatmap(heatRes.data.heatmap || {});
      setHeatmapMax(heatRes.data.max || 0);
      setRetention(retRes.data);
    } catch {
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Performance Analytics</h1>
            <p className="text-gray-500 text-sm">Doctor scorecards, peak hours and patient retention</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="date" value={dateRange.from}
              onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
              className="border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-blue-400" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={dateRange.to}
              onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
              className="border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:border-blue-400" />
            <button onClick={fetchAll}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">
              <RefreshCw className="w-4 h-4" /> Apply
            </button>
          </div>
        </div>

        {/* Retention Stats */}
        {retention && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Patients', value: retention.totalPatients, icon: Users, color: 'text-blue-600 bg-blue-50' },
              { label: 'New Patients', value: retention.newPatients, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
              { label: 'Returning Patients', value: retention.returningPatients, icon: Award, color: 'text-purple-600 bg-purple-50' },
              { label: 'Retention Rate', value: `${retention.retentionRate}%`, icon: Star, color: 'text-amber-600 bg-amber-50' },
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

        {/* Doctor Scorecards */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Doctor Scorecards</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : scorecards.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data available for selected period</p>
          ) : (
            <div className="space-y-4">
              {scorecards
                .sort((a, b) => b.totalSeen - a.totalSeen)
                .map((doc, i) => (
                  <div key={doc.id}
                    className="border border-gray-100 rounded-2xl p-5 hover:border-blue-200 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                          i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : 'bg-blue-400'
                        }`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{doc.name}</p>
                          <RatingStars rating={doc.avgRating} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{doc.totalSeen}</p>
                        <p className="text-xs text-gray-400">patients seen</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { label: 'Today', value: doc.todayCount, color: 'bg-blue-50 text-blue-700' },
                        { label: 'Avg Wait', value: `${doc.avgWaitMins}m`, color: 'bg-amber-50 text-amber-700' },
                        { label: 'No-shows', value: doc.noShows, color: 'bg-red-50 text-red-700' },
                        { label: 'No-show %', value: `${doc.noShowRate}%`, color: 'bg-orange-50 text-orange-700' },
                        { label: 'Revenue', value: `₹${doc.totalRevenue}`, color: 'bg-green-50 text-green-700' },
                      ].map((stat, j) => (
                        <div key={j} className={`${stat.color} rounded-xl p-3 text-center`}>
                          <p className="font-bold text-sm">{stat.value}</p>
                          <p className="text-xs opacity-70 mt-0.5">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Performance bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Performance score</span>
                        <span>{Math.min(100, Math.round(
                          (doc.totalSeen * 2) +
                          (doc.avgRating ? doc.avgRating * 10 : 0) -
                          (doc.noShowRate * 0.5)
                        ))} / 100</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.round(
                            (doc.totalSeen * 2) +
                            (doc.avgRating ? doc.avgRating * 10 : 0) -
                            (doc.noShowRate * 0.5)
                          ))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Peak Hour Heatmap */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-800 mb-1">Peak Hour Heatmap</h2>
          <p className="text-gray-400 text-xs mb-4">Last 30 days — darker = more patients</p>

          {loading ? (
            <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="w-12 text-left text-gray-400 font-normal pb-2">Day</th>
                    {HOURS.map(h => (
                      <th key={h} className="text-gray-400 font-normal pb-2 text-center w-10">
                        {formatHour(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, dayIdx) => (
                    <tr key={day}>
                      <td className="text-gray-500 font-medium py-1 pr-2">{day}</td>
                      {HOURS.map(hour => {
                        const count = heatmap[dayIdx]?.[hour] || 0;
                        return (
                          <td key={hour} className="py-0.5 px-0.5">
                            <div
                              title={`${day} ${formatHour(hour)}: ${count} patients`}
                              className={`w-8 h-8 rounded-md ${getHeatColor(count, heatmapMax)} flex items-center justify-center cursor-default transition-colors`}>
                              {count > 0 && (
                                <span className="text-white text-xs font-bold"
                                  style={{ fontSize: '9px' }}>
                                  {count}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend */}
              <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                <span>Low</span>
                <div className="flex gap-1">
                  {['bg-green-100', 'bg-green-300', 'bg-amber-300', 'bg-orange-400', 'bg-red-500'].map(c => (
                    <div key={c} className={`w-5 h-5 rounded ${c}`} />
                  ))}
                </div>
                <span>High</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}