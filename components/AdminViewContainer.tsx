'use client';

import { useState } from 'react';
import PanelAdmin, { type GastoAdminItem, type ProfileItem, type FondoAdminItem } from '@/components/PanelAdmin';
import GestionUsuarios from '@/components/GestionUsuarios';

interface AdminViewContainerProps {
  gastos: GastoAdminItem[];
  profiles: ProfileItem[];
  fondos: FondoAdminItem[];
}

export default function AdminViewContainer({ gastos, profiles, fondos }: AdminViewContainerProps) {
  const [activeTab, setActiveTab] = useState<'rendiciones' | 'personal'>('rendiciones');

  return (
    <div className="space-y-6">
      {/* Selector de Pestañas Principal */}
      <div className="flex border-b border-slate-200 print:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('rendiciones')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'rendiciones'
              ? 'border-sky-600 text-sky-700 bg-white/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Control de Rendiciones y Fondos
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700">
            {gastos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`py-3 px-5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'personal'
              ? 'border-sky-600 text-sky-700 bg-white/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Gestión de Personal
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700">
            {profiles.length}
          </span>
        </button>
      </div>

      {/* Vista Activa */}
      {activeTab === 'rendiciones' ? (
        <PanelAdmin gastos={gastos} profiles={profiles} fondos={fondos} />
      ) : (
        <GestionUsuarios profiles={profiles} />
      )}
    </div>
  );
}
