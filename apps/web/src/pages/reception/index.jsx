import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Users, Clock, ClipboardList, CheckCircle, Calendar, Activity } from 'lucide-react';
import api from '../../services/api';

export default function ReceptionDashboard() {
  const [stats, setStats] = useState({
    pending_bookings: 0,
    in_queue: 0,
    completed_today: 0,
    avg_wait_minutes: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/analytics/summary/today');
      setStats(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  const cards = [
    {
      title: 'Booking Inbox',
      description: 'Review pending appointment requests',
      icon: Inbox,
      color: 'blue',
      link: '/reception/bookings',
      badge: stats.pending_bookings,
      badgeColor: 'bg-red-500'
    },
    {
      title: 'Live Queue',
      description: 'Manage walk-ins and queue order',
      icon: Users,
      color: 'purple',
      link: '/reception',
      badge: stats.in_queue,
      badgeColor: 'bg-blue-500'
    },
    {
      title: 'Waitlist',
      description: 'Manage overflow and cancellations',
      icon: ClipboardList,
      color: 'amber',
      link: '/reception/waitlist',
      badge: null
    },
    {
      title: 'Pre-Visit Intake',
      description: 'View patient intake forms',
      icon: Calendar,
      color: 'teal',
      link: '/reception/intake',
      badge: null
    }
  ];

  const colorMap = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',    border: 'border-blue-200' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', border: 'border-purple-200' },
    amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600',   border: 'border-amber-200' },
    teal:   { bg: 'bg-teal-50',   icon: 'bg-teal-100 text-teal-600',     border: 'border-teal-200' },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Reception Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', year: 'numeric',
              month: 'long', day: 'numeric'
            })}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pending Bookings', value: stats.pending_bookings, icon: Inbox,        color: 'text-red-600 bg-red-50' },
            { label: 'In Queue Now',     value: stats.in_queue,         icon: Users,        color: 'text-blue-600 bg-blue-50' },
            { label: 'Completed Today',  value: stats.completed_today,  icon: CheckCircle,  color: 'text-green-600 bg-green-50' },
            { label: 'Avg Wait (min)',   value: stats.avg_wait_minutes, icon: Clock,        color: 'text-amber-600 bg-amber-50' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {loading ? '—' : s.value}
              </p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card, i) => {
            const c = colorMap[card.color];
            return (
              <Link key={i} to={card.link}
                className={`bg-white rounded-2xl border ${c.border} p-6 shadow-sm hover:shadow-md transition-all group flex items-center gap-5`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${c.icon}`}>
                  <card.icon className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {card.title}
                    </h2>
                    {card.badge > 0 && (
                      <span className={`${card.badgeColor} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{card.description}</p>
                </div>
                <span className="text-gray-300 group-hover:text-blue-400 transition-colors text-xl">→</span>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3 text-sm">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link to="/reception"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-blue-700">
              <Users className="w-4 h-4" /> Register Walk-in
            </Link>
            <Link to="/reception/bookings"
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
              <Inbox className="w-4 h-4" /> View Pending Bookings
            </Link>
            <Link to="/display"
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
              <Activity className="w-4 h-4" /> TV Display Board
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}