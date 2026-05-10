import React from 'react';
import { useQuery } from '@tanstack/react-query';

const VISIT_TYPE_BADGES = {
  new: { label: 'New', color: 'blue' },
  followup: { label: 'Follow-up', color: 'teal' },
  prescription: { label: 'Prescription', color: 'gray' },
  report_review: { label: 'Report', color: 'purple' },
  procedure: { label: 'Procedure', color: 'amber' },
};

const Badge = ({ visitType }) => {
  const { label, color } = VISIT_TYPE_BADGES[visitType] || { label: 'Unknown', color: 'gray' };
  const baseStyle = 'px-2 py-1 text-xs font-semibold rounded-full';
  const colorStyles = {
    blue: 'bg-blue-100 text-blue-800',
    teal: 'bg-teal-100 text-teal-800',
    gray: 'bg-gray-100 text-gray-800',
    purple: 'bg-purple-100 text-purple-800',
    amber: 'bg-amber-100 text-amber-800',
  };

  return <span className={`${baseStyle} ${colorStyles[color]}`}>{label}</span>;
};


export default function QueuePage() {
  const { data: queue, isLoading } = useQuery({
    queryKey: ['adminQueue'],
    queryFn: () => fetch('/api/queue').then(res => res.json()),
    refetchInterval: 5000, // Poll for updates every 5 seconds
  });

  if (isLoading) {
    return <div>Loading queue...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Live Queue</h1>
      <div className="bg-white shadow rounded-lg">
        <ul className="divide-y divide-gray-200">
          {queue?.map(patient => (
            <li key={patient.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">
                  {patient.name} <span className="text-gray-500 font-normal">({patient.token_number})</span>
                </p>
                <div className="mt-2">
                  <Badge visitType={patient.visit_type} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-semibold">{patient.status}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
