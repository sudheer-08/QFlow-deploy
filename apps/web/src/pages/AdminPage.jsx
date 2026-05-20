import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, Clock, DollarSign, Activity, LogOut } from 'lucide-react';
import './AdminPage.css';

const fetchDashboardMetrics = async (clinicId) => {
    if (!clinicId) return null;
    const { data, error } = await supabase.rpc('get_clinic_dashboard_metrics', { p_clinic_id: clinicId });
    if (error) throw new Error(error.message);
    return data[0];
};

const fetchDoctorStatus = async (clinicId) => {
    if (!clinicId) return [];
    const { data, error } = await supabase
        .from('doctor_live_status')
        .select('*')
        .eq('tenant_id', clinicId);
    if (error) throw new Error(error.message);
    return data;
}

const fetchHourlyData = async (clinicId) => {
    if (!clinicId) return [];
    const { data, error } = await supabase.rpc('get_hourly_patient_flow', { p_clinic_id: clinicId });
    if (error) throw new Error(error.message);
    return data;
}

const fetchWaitTimeData = async (clinicId) => {
    if (!clinicId) return [];
    const { data, error } = await supabase.rpc('get_hourly_wait_time', { p_clinic_id: clinicId });
    if (error) throw new Error(error.message);
    return data;
}


const AdminPage = () => {
    const { user, logout } = useAuthStore();
    const queryClient = useQueryClient();

    const { data: metrics, isLoading: metricsLoading } = useQuery({
        queryKey: ['adminDashboardMetrics', user?.tenant_id],
        queryFn: () => fetchDashboardMetrics(user?.tenant_id),
        refetchInterval: 30000,
    });

    const { data: doctorStatus, isLoading: doctorsLoading } = useQuery({
        queryKey: ['adminDoctorStatus', user?.tenant_id],
        queryFn: () => fetchDoctorStatus(user?.tenant_id),
        refetchInterval: 60000,
    });

    const { data: hourlyData, isLoading: hourlyLoading } = useQuery({
        queryKey: ['adminHourlyData', user?.tenant_id],
        queryFn: () => fetchHourlyData(user?.tenant_id),
        refetchInterval: 5 * 60 * 1000, // 5 minutes
    });

    const { data: waitTimeData, isLoading: waitTimeLoading } = useQuery({
        queryKey: ['adminWaitTimeData', user?.tenant_id],
        queryFn: () => fetchWaitTimeData(user?.tenant_id),
        refetchInterval: 5 * 60 * 1000, // 5 minutes
    });

    useEffect(() => {
        if (!user?.tenant_id) return;

        const channel = supabase.channel(`admin-dashboard:${user.tenant_id}`);

        channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries' }, () => {
                queryClient.invalidateQueries({queryKey: ['adminDashboardMetrics', user?.tenant_id]});
                queryClient.invalidateQueries({queryKey: ['adminHourlyData', user?.tenant_id]});
                queryClient.invalidateQueries({queryKey: ['adminWaitTimeData', user?.tenant_id]});
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `role=eq.doctor` }, () => {
                queryClient.invalidateQueries({queryKey: ['adminDoctorStatus', user?.tenant_id]});
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.tenant_id, queryClient]);


    const StatCard = ({ icon, label, value, isLoading }) => (
        <div className="admin-stat-card">
            <div className="admin-stat-icon">{icon}</div>
            <div className="admin-stat-info">
                <div className="admin-stat-label">{label}</div>
                <div className="admin-stat-value">{isLoading ? '...' : value}</div>
            </div>
        </div>
    );

    return (
        <div className="admin-page">
            <header className="admin-header">
                <h1>{user?.clinicName || 'Admin Dashboard'}</h1>
                <button onClick={logout} className="admin-logout-btn">
                    <LogOut size={16} /> Logout
                </button>
            </header>

            <main className="admin-main-content">
                <section className="admin-stats-grid">
                    <StatCard icon={<Users />} label="Total Patients Today" value={metrics?.total_patients_today || 0} isLoading={metricsLoading} />
                    <StatCard icon={<Clock />} label="Avg. Wait Time (mins)" value={metrics?.avg_wait_time_mins?.toFixed(1) || 0} isLoading={metricsLoading} />
                    <StatCard icon={<DollarSign />} label="Estimated Revenue" value={`₹${metrics?.total_revenue?.toLocaleString() || 0}`} isLoading={metricsLoading} />
                    <StatCard icon={<Activity />} label="Avg. Consult Time (mins)" value={metrics?.avg_consult_time_mins?.toFixed(1) || 0} isLoading={metricsLoading} />
                </section>

                <section className="admin-grid-cols-2">
                    <div className="admin-card">
                        <h2 className="admin-card-title">Doctor Status</h2>
                        <div className="doctor-status-list">
                            {doctorsLoading && <p>Loading doctors...</p>}
                            {doctorStatus?.map(doc => (
                                <div key={doc.doctor_id} className="doctor-status-item">
                                    <span className={`status-dot ${doc.is_online ? 'online' : 'offline'}`}></span>
                                    <span className="doctor-name">{doc.doctor_name}</span>
                                    <span className="doctor-queue-count">{doc.live_queue_count} waiting</span>
                                    <span className="doctor-consulting-with">
                                        {doc.is_online ? (doc.currently_with ? `with ${doc.currently_with}` : 'Idle') : 'Offline'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="admin-card">
                        <h2 className="admin-card-title">Patient Flow by Hour</h2>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={hourlyData}>
                                <XAxis dataKey="hour" stroke="#888888" fontSize={12} />
                                <YAxis stroke="#888888" fontSize={12} />
                                <Tooltip wrapperClassName="chart-tooltip" />
                                <Legend />
                                <Bar dataKey="patients" fill="#3498db" name="Patients" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
                 <section className="admin-card">
                        <h2 className="admin-card-title">Average Wait Time Fluctuation</h2>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={waitTimeData}>
                                <XAxis dataKey="hour" stroke="#888888" fontSize={12} />
                                <YAxis stroke="#888888" fontSize={12} />
                                <Tooltip wrapperClassName="chart-tooltip" />
                                <Legend />
                                <Line type="monotone" dataKey="avg_wait" stroke="#e67e22" name="Avg Wait (mins)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </section>
            </main>
        </div>
    );
};

export default AdminPage;