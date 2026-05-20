import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import './AdvancedAnalyticsPage.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD'];

const fetchAdvancedAnalytics = async (clinicId, startDate, endDate) => {
    if (!clinicId || !startDate || !endDate) return null;
    const { data, error } = await supabase.rpc('get_advanced_analytics', {
        p_clinic_id: clinicId,
        p_start_date: startDate,
        p_end_date: endDate,
    });
    if (error) {
        console.error("Error fetching advanced analytics:", error);
        throw new Error(error.message);
    }
    return data[0];
};

const AdvancedAnalyticsPage = () => {
    const { user } = useAuthStore();
    const [dateRange, setDateRange] = useState('last_30_days');
    
    const getDates = () => {
        const endDate = new Date();
        const startDate = new Date();
        switch (dateRange) {
            case 'last_7_days':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case 'last_30_days':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case 'this_month':
                startDate.setDate(1);
                break;
            default:
                startDate.setDate(endDate.getDate() - 30);
        }
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        };
    };

    const { startDate, endDate } = getDates();

    const { data: analytics, isLoading } = useQuery({
        queryKey: ['advancedAnalytics', user?.tenant_id, startDate, endDate],
        queryFn: () => fetchAdvancedAnalytics(user?.tenant_id, startDate, endDate),
        enabled: !!user?.tenant_id,
    });

    const doctorPerformanceData = analytics?.doctor_performance || [];
    const revenueByVisitType = analytics?.revenue_by_visit_type || [];
    const ageGroupData = analytics?.patient_age_groups || [];
    const genderData = analytics?.patient_gender_distribution || [];
    const dailyRevenue = analytics?.daily_revenue || [];

    return (
        <div className="analytics-page">
            <header className="analytics-header">
                <h1>Advanced Analytics</h1>
                <div className="date-range-selector">
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                        <option value="last_7_days">Last 7 Days</option>
                        <option value="last_30_days">Last 30 Days</option>
                        <option value="this_month">This Month</option>
                    </select>
                </div>
            </header>

            {isLoading && <div className="loading-state">Loading analytics...</div>}

            {!isLoading && analytics && (
                <main className="analytics-grid">
                    <div className="analytics-card tall">
                        <h2>Doctor Performance</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={doctorPerformanceData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="doctor_name" width={80} tick={{fontSize: 12}} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="total_patients" fill="#8884d8" name="Patients Seen" />
                                <Bar dataKey="avg_consult_time" fill="#82ca9d" name="Avg. Consult Time (mins)" />
                            </BarChart>
                        </ResponsiveContainer>
                        <table className="performance-table">
                            <thead>
                                <tr>
                                    <th>Doctor</th>
                                    <th>Patients</th>
                                    <th>Avg. Time</th>
                                    <th>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {doctorPerformanceData.map(doc => (
                                    <tr key={doc.doctor_id}>
                                        <td>{doc.doctor_name}</td>
                                        <td>{doc.total_patients}</td>
                                        <td>{doc.avg_consult_time?.toFixed(1)} mins</td>
                                        <td>₹{doc.total_revenue?.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="analytics-card">
                        <h2>Revenue by Visit Type</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={revenueByVisitType} dataKey="total_revenue" nameKey="visit_type" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                    {revenueByVisitType.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="analytics-card">
                        <h2>Daily Revenue Trend</h2>
                         <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dailyRevenue}>
                                <XAxis dataKey="date" tick={{fontSize: 12}} />
                                <YAxis />
                                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                                <Legend />
                                <Line type="monotone" dataKey="total_revenue" stroke="#8884d8" name="Revenue" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="analytics-card">
                        <h2>Patient Age Groups</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={ageGroupData}>
                                <XAxis dataKey="age_group" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#82ca9d" name="Number of Patients" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="analytics-card">
                        <h2>Patient Gender Distribution</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={genderData} dataKey="count" nameKey="gender" cx="50%" cy="50%" outerRadius={80} fill="#ffc658" label>
                                     {genderData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </main>
            )}
        </div>
    );
};

export default AdvancedAnalyticsPage;
