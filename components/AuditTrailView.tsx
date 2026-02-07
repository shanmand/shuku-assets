
import React from 'react';
import { AuditLog, Asset } from '../types';
import { format } from 'date-fns';
import { History, User } from 'lucide-react';

interface AuditTrailViewProps {
  logs: AuditLog[];
  assets: Asset[];
}

const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs, assets }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <History size={18} className="text-blue-600" />
          System Audit Trail
        </h3>
        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Compliance Ready</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.slice().reverse().map(log => {
              const asset = assets.find(a => a.id === log.assetId);
              return (
                <tr key={log.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                    {/* Use native Date constructor instead of parseISO */}
                    {format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <User size={12} />
                    </div>
                    <span className="font-medium text-slate-700">{log.userId}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-blue-600">{asset?.name || 'Deleted Asset'}</span>
                    <span className="block text-[10px] text-slate-400">{asset?.assetNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                      log.action === 'DISPOSE' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {log.changes.map((change, i) => (
                        <div key={i} className="text-xs text-slate-600">
                          <span className="font-bold text-slate-400">{change.field}:</span>{' '}
                          <span className="text-red-500 line-through">{String(change.oldValue)}</span>
                          {' → '}
                          <span className="text-emerald-600 font-bold">{String(change.newValue)}</span>
                        </div>
                      ))}
                      {log.changes.length === 0 && <span className="text-slate-400 italic">No field changes recorded</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditTrailView;
