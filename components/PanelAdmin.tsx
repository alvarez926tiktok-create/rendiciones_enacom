'use client';

import { useState, useMemo, useActionState, useEffect, useRef } from 'react';
import { obtenerUrlComprobante } from '@/app/admin/actions';
import { asignarFondo, reembolsarGasto, type FondoActionState } from '@/app/admin/fondos-actions';

export interface GastoAdminItem {
  id: string;
  user_id: string;
  categoria: string;
  numero_comprobante: string;
  monto: number;
  foto_url: string;
  tipo_rendicion: 'anticipo' | 'reembolso';
  fondo_id: string | null;
  estado: 'aplicado_a_fondo' | 'por_pagar' | 'cerrado';
  comprobante_pago_url: string | null;
  created_at: string;
  nombre_empleado: string;
  email_empleado: string;
  area_empleado: string;
}

export interface FondoAdminItem {
  id: string;
  user_id: string;
  admin_id: string | null;
  motivo: string;
  monto_asignado: number;
  estado: 'activo' | 'por_devolver' | 'cerrado';
  comprobante_devolucion_url: string | null;
  monto_devuelto: number;
  created_at: string;
  nombre_empleado?: string;
  email_empleado?: string;
  area_empleado?: string;
}

export interface ProfileItem {
  id: string;
  nombre: string;
  email: string;
  area: string;
  rol: string;
}

interface PanelAdminProps {
  gastos: GastoAdminItem[];
  profiles: ProfileItem[];
  fondos?: FondoAdminItem[];
}

const AREAS = [
  'Ingeniería Eléctrica',
  'Informática',
  'Administrativo',
  'Contabilidad',
  'Ventas',
  'Logística',
  'Gerencia',
] as const;

const CATEGORIAS = [
  'Bencina',
  'Transporte',
  'Comida',
  'Materiales',
  'Viáticos',
  'Otro',
] as const;

type RangoFecha = 'todos' | '7d' | '15d' | '30d' | 'mes_particular' | '1y';

export default function PanelAdmin({ gastos, profiles, fondos = [] }: PanelAdminProps) {
  // Filtros reactivos
  const [selectedArea, setSelectedArea] = useState<string>('Todas');
  const [selectedUser, setSelectedUser] = useState<string>('Todos');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');
  const [selectedEstado, setSelectedEstado] = useState<string>('Todos');
  const [selectedRangoFecha, setSelectedRangoFecha] = useState<RangoFecha>('todos');
  const [selectedMesParticular, setSelectedMesParticular] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Visibilidad de la sección de Fondos
  const [mostrarFondos, setMostrarFondos] = useState<boolean>(false);

  // Modales
  const [modalAsignarOpen, setModalAsignarOpen] = useState<boolean>(false);
  const [gastoToReembolsar, setGastoToReembolsar] = useState<GastoAdminItem | null>(null);

  // Modal Visor de Comprobantes / Fotos
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Acciones de servidor
  const [asignarState, asignarAction, isAsignando] = useActionState<FondoActionState | null, FormData>(
    asignarFondo,
    null
  );
  const [reembolsarState, reembolsarAction, isReembolsando] = useActionState<FondoActionState | null, FormData>(
    reembolsarGasto,
    null
  );

  const asignarFormRef = useRef<HTMLFormElement>(null);
  const reembolsarFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (asignarState?.success) {
      setModalAsignarOpen(false);
      asignarFormRef.current?.reset();
    }
  }, [asignarState?.success]);

  useEffect(() => {
    if (reembolsarState?.success) {
      setGastoToReembolsar(null);
      reembolsarFormRef.current?.reset();
    }
  }, [reembolsarState?.success]);

  // Formateadores
  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getCategoriaBadgeClass = (categoria: string) => {
    switch (categoria) {
      case 'Bencina':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Transporte':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Comida':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Materiales':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Viáticos':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Texto legible del período para el informe PDF
  const getTextoPeriodo = () => {
    switch (selectedRangoFecha) {
      case '7d':
        return 'Últimos 7 días';
      case '15d':
        return 'Últimos 15 días';
      case '30d':
        return 'Último mes (30 días)';
      case 'mes_particular':
        return `Mes específico: ${selectedMesParticular}`;
      case '1y':
        return 'Último año (365 días)';
      default:
        return 'Histórico Completo';
    }
  };

  const getTextoColaborador = () => {
    if (selectedUser === 'Todos') return 'Todos los colaboradores';
    const p = profiles.find((item) => item.id === selectedUser);
    return p ? `${p.nombre} (${p.area})` : 'Colaborador Específico';
  };

  // Filtrado reactivo de gastos (Fecha + Área + Usuario + Categoría + Estado)
  const filteredGastos = useMemo(() => {
    const now = new Date();

    return gastos.filter((g) => {
      // 1. Filtro por Área
      const matchArea = selectedArea === 'Todas' || g.area_empleado === selectedArea;

      // 2. Filtro por Usuario
      const matchUser = selectedUser === 'Todos' || g.user_id === selectedUser;

      // 3. Filtro por Categoría
      const matchCat = selectedCategoria === 'Todas' || g.categoria === selectedCategoria;

      // 4. Filtro por Estado
      let matchEstado = true;
      if (selectedEstado === 'Por Pagar') matchEstado = g.estado === 'por_pagar';
      else if (selectedEstado === 'Aplicado a Fondo') matchEstado = g.estado === 'aplicado_a_fondo';
      else if (selectedEstado === 'Cerrado') matchEstado = g.estado === 'cerrado';

      // 5. Filtro por Rango Temporal
      let matchDate = true;
      const gDate = new Date(g.created_at);

      if (selectedRangoFecha === '7d') {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchDate = gDate >= d;
      } else if (selectedRangoFecha === '15d') {
        const d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
        matchDate = gDate >= d;
      } else if (selectedRangoFecha === '30d') {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchDate = gDate >= d;
      } else if (selectedRangoFecha === '1y') {
        const d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        matchDate = gDate >= d;
      } else if (selectedRangoFecha === 'mes_particular') {
        matchDate = g.created_at.slice(0, 7) === selectedMesParticular;
      }

      return matchArea && matchUser && matchCat && matchEstado && matchDate;
    });
  }, [gastos, selectedArea, selectedUser, selectedCategoria, selectedEstado, selectedRangoFecha, selectedMesParticular]);

  // CÁLCULOS DEL BALANCE CONTABLE (Reactivas a filtros)
  // 1. Total Por Pagar a Empleados (Reembolsos pendientes)
  const totalPorPagar = useMemo(() => {
    return filteredGastos
      .filter((g) => g.tipo_rendicion === 'reembolso' && g.estado === 'por_pagar')
      .reduce((sum, g) => sum + g.monto, 0);
  }, [filteredGastos]);

  // 2. Total Fondos Activos / Por Devolver (Saldos pendientes en manos de empleados)
  const totalFondosActivos = useMemo(() => {
    return fondos
      .filter((f) => {
        if (f.estado === 'cerrado') return false;
        if (selectedUser !== 'Todos' && f.user_id !== selectedUser) return false;
        if (selectedArea !== 'Todas' && f.area_empleado !== selectedArea) return false;
        return true;
      })
      .reduce((sum, f) => {
        const rendido = gastos
          .filter((g) => g.fondo_id === f.id && g.tipo_rendicion === 'anticipo')
          .reduce((s, g) => s + g.monto, 0);
        const saldo = Math.max(0, f.monto_asignado - rendido - (f.monto_devuelto || 0));
        return sum + saldo;
      }, 0);
  }, [fondos, gastos, selectedUser, selectedArea]);

  // 3. Total Saldado / Cerrado (Histórico conciliado en base a filtros)
  const totalSaldado = useMemo(() => {
    return filteredGastos
      .filter((g) => g.estado === 'cerrado' || g.estado === 'aplicado_a_fondo')
      .reduce((sum, g) => sum + g.monto, 0);
  }, [filteredGastos]);

  // Totales generales filtrados
  const totalRendido = useMemo(() => {
    return filteredGastos.reduce((sum, g) => sum + g.monto, 0);
  }, [filteredGastos]);

  const cantidadBoletas = filteredGastos.length;

  // Desglose acumulado por área
  const desglosePorArea = useMemo(() => {
    const mapa: Record<string, number> = {};
    AREAS.forEach((a) => (mapa[a] = 0));

    const now = new Date();
    const baseGastos = gastos.filter((g) => {
      const matchUser = selectedUser === 'Todos' || g.user_id === selectedUser;
      const matchCat = selectedCategoria === 'Todas' || g.categoria === selectedCategoria;
      let matchEstado = true;
      if (selectedEstado === 'Por Pagar') matchEstado = g.estado === 'por_pagar';
      else if (selectedEstado === 'Aplicado a Fondo') matchEstado = g.estado === 'aplicado_a_fondo';
      else if (selectedEstado === 'Cerrado') matchEstado = g.estado === 'cerrado';

      let matchDate = true;
      const gDate = new Date(g.created_at);
      if (selectedRangoFecha === '7d') matchDate = gDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (selectedRangoFecha === '15d') matchDate = gDate >= new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      else if (selectedRangoFecha === '30d') matchDate = gDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (selectedRangoFecha === '1y') matchDate = gDate >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      else if (selectedRangoFecha === 'mes_particular') matchDate = g.created_at.slice(0, 7) === selectedMesParticular;

      return matchUser && matchCat && matchEstado && matchDate;
    });

    baseGastos.forEach((g) => {
      if (mapa[g.area_empleado] !== undefined) {
        mapa[g.area_empleado] += g.monto;
      }
    });

    return mapa;
  }, [gastos, selectedUser, selectedCategoria, selectedEstado, selectedRangoFecha, selectedMesParticular]);

  const resetFilters = () => {
    setSelectedArea('Todas');
    setSelectedUser('Todos');
    setSelectedCategoria('Todas');
    setSelectedEstado('Todos');
    setSelectedRangoFecha('todos');
  };

  const hasActiveFilters =
    selectedArea !== 'Todas' ||
    selectedUser !== 'Todos' ||
    selectedCategoria !== 'Todas' ||
    selectedEstado !== 'Todos' ||
    selectedRangoFecha !== 'todos';

  // Abrir modal y obtener foto en alta resolución
  const handleVerFoto = async (fotoUrl: string, title: string) => {
    setModalTitle(title);
    setModalImageUrl(null);
    setModalError(null);
    setModalLoading(true);

    try {
      const res = await obtenerUrlComprobante(fotoUrl);
      if (res.signedUrl) {
        setModalImageUrl(res.signedUrl);
      } else {
        setModalError(res.error || 'No se pudo obtener la imagen del archivo.');
      }
    } catch {
      setModalError('Error de conexión al cargar la fotografía.');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalTitle('');
    setModalImageUrl(null);
    setModalError(null);
    setModalLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Membrete Oficial para Exportación PDF (Solo se ve al imprimir) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">
              ENACOM - Control Financiero
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
              INFORME CONSOLIDADO DE RENDICIÓN DE GASTOS Y FONDOS
            </h1>
            <p className="text-xs text-slate-600">
              Reporte generado para Auditoría, Contabilidad y Gerencia
            </p>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p><strong>Fecha de Emisión:</strong> {formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Resumen de Filtros Aplicados en PDF */}
        <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Área</span>
            <span className="font-black text-slate-900">{selectedArea}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Período</span>
            <span className="font-black text-slate-900">{getTextoPeriodo()}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Colaborador</span>
            <span className="font-black text-slate-900">{getTextoColaborador()}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Categoría</span>
            <span className="font-black text-slate-900">{selectedCategoria}</span>
          </div>
          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Estado</span>
            <span className="font-black text-slate-900">{selectedEstado}</span>
          </div>
        </div>
      </div>

      {/* Alertas de Éxito / Error */}
      {(asignarState?.message || reembolsarState?.message) && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-bold flex items-center justify-between shadow-sm">
          <span>✓ {asignarState?.message || reembolsarState?.message}</span>
        </div>
      )}
      {(asignarState?.error || reembolsarState?.error) && (
        <div className="p-4 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm font-bold shadow-sm">
          ✕ {asignarState?.error || reembolsarState?.error}
        </div>
      )}

      {/* 1. TARJETAS DE BALANCE CONTABLE (Reactivas a filtros) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tarjeta 1: Total Por Pagar a Empleados */}
        <div className="bg-white rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Total Por Pagar a Empleados
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <p className="text-3xl font-black text-amber-950 mt-1.5">
            {formatCLP(totalPorPagar)}
          </p>
          <span className="text-[11px] font-medium text-amber-700 mt-1 block">
            Gastos propios por reembolsar (deuda empresa)
          </span>
        </div>

        {/* Tarjeta 2: Total Fondos Activos / Por Devolver */}
        <div className="bg-white rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Fondos Activos / Por Devolver
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
          </div>
          <p className="text-3xl font-black text-sky-950 mt-1.5">
            {formatCLP(totalFondosActivos)}
          </p>
          <span className="text-[11px] font-medium text-sky-700 mt-1 block">
            Saldos pendientes en manos de colaboradores
          </span>
        </div>

        {/* Tarjeta 3: Total Saldado / Cerrado */}
        <div className="bg-white rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Total Saldado / Conciliado
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-3xl font-black text-emerald-950 mt-1.5">
            {formatCLP(totalSaldado)}
          </p>
          <span className="text-[11px] font-medium text-emerald-700 mt-1 block">
            Histórico cerrado y aplicado a fondos
          </span>
        </div>
      </section>

      {/* 2. Barra de Acciones Principales y Botón Asignar Fondo */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalAsignarOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Asignar Fondo / Viático
          </button>

          <button
            type="button"
            onClick={() => setMostrarFondos(!mostrarFondos)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors shadow-sm ${
              mostrarFondos
                ? 'bg-sky-50 border-sky-300 text-sky-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {mostrarFondos ? 'Ocultar Fondos Asignados' : `Ver Fondos Asignados (${fondos.length})`}
          </button>
        </div>

        {/* Botón de Exportar Informe PDF */}
        <button
          type="button"
          onClick={() => window.print()}
          disabled={filteredGastos.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Exportar Informe PDF
        </button>
      </div>

      {/* 3. SECCIÓN EXPANDIBLE: Listado de Fondos Asignados */}
      {mostrarFondos && (
        <section className="bg-white rounded-2xl border border-sky-200 p-5 shadow-sm space-y-4 print:hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900">
                Fondos y Viáticos Asignados a Colaboradores
              </h2>
              <p className="text-xs text-slate-500">
                Monitorea el dinero entregado por adelantado, lo rendido y devoluciones.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-900">
              {fondos.length} {fondos.length === 1 ? 'fondo' : 'fondos'}
            </span>
          </div>

          {fondos.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              Aún no has registrado asignaciones de viáticos o fondos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Colaborador</th>
                    <th className="px-3 py-2.5">Motivo</th>
                    <th className="px-3 py-2.5 text-right">Asignado</th>
                    <th className="px-3 py-2.5 text-right">Rendido</th>
                    <th className="px-3 py-2.5 text-right">Saldo Restante</th>
                    <th className="px-3 py-2.5 text-right">Devuelto</th>
                    <th className="px-3 py-2.5 text-center">Estado</th>
                    <th className="px-3 py-2.5 text-center">Comprobante Devolución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fondos.map((f) => {
                    const rendido = gastos
                      .filter((g) => g.fondo_id === f.id && g.tipo_rendicion === 'anticipo')
                      .reduce((s, g) => s + g.monto, 0);
                    const saldo = Math.max(0, f.monto_asignado - rendido - (f.monto_devuelto || 0));

                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                          {formatDate(f.created_at)}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                          {f.nombre_empleado}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 font-medium">
                          {f.motivo}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-900">
                          {formatCLP(f.monto_asignado)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-sky-700">
                          {formatCLP(rendido)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-amber-700">
                          {formatCLP(saldo)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                          {formatCLP(f.monto_devuelto || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              f.estado === 'cerrado'
                                ? 'bg-slate-100 text-slate-800'
                                : saldo > 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}
                          >
                            {f.estado}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {f.comprobante_devolucion_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleVerFoto(f.comprobante_devolucion_url!, `Devolución - ${f.nombre_empleado}`)
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 shadow-sm"
                            >
                              Ver Transferencia
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 4. Desglose Rápido por Área */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm print:hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Acumulado por Área de la Empresa
          </h2>
          <span className="text-[11px] text-slate-400">Clic en un área para filtrar</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {AREAS.map((area) => {
            const isSelected = selectedArea === area;
            const montoArea = desglosePorArea[area] || 0;

            return (
              <button
                key={area}
                type="button"
                onClick={() => setSelectedArea(isSelected ? 'Todas' : area)}
                className={`p-2.5 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/20'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70'
                }`}
              >
                <span className="block text-[11px] font-bold text-slate-700 truncate">
                  {area}
                </span>
                <span className="block text-xs font-black text-slate-900 mt-1">
                  {formatCLP(montoArea)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Barra de Filtros Avanzados (con nuevo filtro por Estado) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Filtros Avanzados de Búsqueda
            </h2>
            <p className="text-xs text-slate-400">
              Cruza datos por estado contable, área, colaborador, categoría y fechas.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold text-sky-600 hover:text-sky-800 self-start sm:self-auto bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors"
            >
              ✕ Limpiar todos los filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Filtro Rango Temporal */}
          <div>
            <label htmlFor="filtro-fecha" className="block text-xs font-bold text-slate-700 mb-1">
              Período / Rango Temporal
            </label>
            <select
              id="filtro-fecha"
              value={selectedRangoFecha}
              onChange={(e) => setSelectedRangoFecha(e.target.value as RangoFecha)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none"
            >
              <option value="todos">Todos los registros</option>
              <option value="7d">Últimos 7 días</option>
              <option value="15d">Últimos 15 días</option>
              <option value="30d">Último mes (30 días)</option>
              <option value="mes_particular">Mes en particular...</option>
              <option value="1y">Último año (365 días)</option>
            </select>

            {selectedRangoFecha === 'mes_particular' && (
              <div className="mt-2">
                <input
                  type="month"
                  value={selectedMesParticular}
                  onChange={(e) => setSelectedMesParticular(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 font-bold focus:border-sky-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Filtro Estado */}
          <div>
            <label htmlFor="filtro-estado" className="block text-xs font-bold text-slate-700 mb-1">
              Estado Contable
            </label>
            <select
              id="filtro-estado"
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none"
            >
              <option value="Todos">Todos los estados</option>
              <option value="Por Pagar">Por Pagar (Reembolsos)</option>
              <option value="Aplicado a Fondo">Aplicado a Fondo</option>
              <option value="Cerrado">Cerrado / Conciliado</option>
            </select>
          </div>

          {/* Filtro Área */}
          <div>
            <label htmlFor="filtro-area" className="block text-xs font-bold text-slate-700 mb-1">
              Área de la Empresa
            </label>
            <select
              id="filtro-area"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none"
            >
              <option value="Todas">Todas las áreas</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Usuario */}
          <div>
            <label htmlFor="filtro-usuario" className="block text-xs font-bold text-slate-700 mb-1">
              Colaborador
            </label>
            <select
              id="filtro-usuario"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none"
            >
              <option value="Todos">Todos los colaboradores</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.area})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Categoría */}
          <div>
            <label htmlFor="filtro-categoria" className="block text-xs font-bold text-slate-700 mb-1">
              Categoría
            </label>
            <select
              id="filtro-categoria"
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none"
            >
              <option value="Todas">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 6. TABLA Y TARJETAS DE RENDICIONES CON ACCIÓN DE NIVELACIÓN */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm print:border-none print:shadow-none">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Registro Consolidado de Rendiciones
            </h2>
            <p className="text-xs text-slate-500">
              Mostrando {filteredGastos.length} comprobantes coincidentes
            </p>
          </div>
        </div>

        {filteredGastos.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <p className="text-base font-semibold">No se encontraron rendiciones con los filtros actuales.</p>
            <p className="text-xs text-slate-400 mt-1">
              Prueba cambiando el estado contable, el período o limpiando los filtros.
            </p>
          </div>
        ) : (
          <>
            {/* Tabla para Escritorio y Formato Impreso */}
            <div className="overflow-x-auto print:block">
              <table className="w-full text-left text-sm text-slate-700 print:text-xs print:border print:border-slate-300">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 print:bg-slate-100 print:text-black">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 print:px-2 print:py-2">
                      Fecha / Hora
                    </th>
                    <th scope="col" className="px-4 py-3.5 print:px-2 print:py-2">
                      Colaborador
                    </th>
                    <th scope="col" className="px-4 py-3.5 print:px-2 print:py-2">
                      Área
                    </th>
                    <th scope="col" className="px-4 py-3.5 print:px-2 print:py-2">
                      Modalidad
                    </th>
                    <th scope="col" className="px-4 py-3.5 print:px-2 print:py-2">
                      Categoría
                    </th>
                    <th scope="col" className="px-4 py-3.5 print:px-2 print:py-2">
                      N° Comprobante
                    </th>
                    <th scope="col" className="px-4 py-3.5 print:px-2 print:py-2">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right print:px-2 print:py-2">
                      Monto
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center print:hidden">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {filteredGastos.map((gasto) => (
                    <tr
                      key={gasto.id}
                      className="hover:bg-slate-50/70 transition-colors print:bg-transparent"
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap print:px-2 print:py-1.5 print:text-slate-800">
                        {formatDate(gasto.created_at)}
                      </td>
                      <td className="px-4 py-3 print:px-2 print:py-1.5">
                        <span className="font-bold text-slate-900 block leading-tight">
                          {gasto.nombre_empleado}
                        </span>
                        <span className="text-[11px] text-slate-400 block print:text-slate-600">
                          {gasto.email_empleado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap print:px-2 print:py-1.5 print:text-slate-800">
                        {gasto.area_empleado}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap print:px-2 print:py-1.5">
                        {gasto.tipo_rendicion === 'anticipo' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 print:border-none">
                            Anticipo
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200 print:border-none">
                            Reembolso
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap print:px-2 print:py-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getCategoriaBadgeClass(
                            gasto.categoria
                          )} print:border-none`}
                        >
                          {gasto.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap print:px-2 print:py-1.5">
                        #{gasto.numero_comprobante}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap print:px-2 print:py-1.5">
                        {gasto.estado === 'por_pagar' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                            Por Pagar
                          </span>
                        )}
                        {gasto.estado === 'aplicado_a_fondo' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                            Aplicado a Fondo
                          </span>
                        )}
                        {gasto.estado === 'cerrado' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">
                            Cerrado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900 text-right whitespace-nowrap text-sm print:text-xs print:px-2 print:py-1.5">
                        {formatCLP(gasto.monto)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ver Boleta */}
                          <button
                            type="button"
                            onClick={() =>
                              handleVerFoto(gasto.foto_url, `Boleta #${gasto.numero_comprobante} - ${gasto.nombre_empleado}`)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-colors"
                          >
                            Boleta
                          </button>

                          {/* Ver Comprobante de Pago Subido por Admin */}
                          {gasto.comprobante_pago_url && (
                            <button
                              type="button"
                              onClick={() =>
                                handleVerFoto(gasto.comprobante_pago_url!, `Comprobante de Reembolso #${gasto.numero_comprobante}`)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs shadow-sm transition-colors"
                            >
                              Ver Pago
                            </button>
                          )}

                          {/* Botón Pagar / Reembolsar (Nivelación) */}
                          {gasto.tipo_rendicion === 'reembolso' && gasto.estado === 'por_pagar' && (
                            <button
                              type="button"
                              onClick={() => setGastoToReembolsar(gasto)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition-colors"
                            >
                              Pagar / Reembolsar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Fila de Totales */}
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-left text-xs uppercase tracking-wider print:px-2 print:py-1.5">
                      Total Consolidado ({filteredGastos.length} comprobantes)
                    </td>
                    <td className="px-4 py-3 text-right text-base print:text-xs print:px-2 print:py-1.5 text-slate-900">
                      {formatCLP(totalRendido)}
                    </td>
                    <td className="print:hidden"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Vista Móvil: Tarjetas apiladas */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3 print:hidden">
              {filteredGastos.map((gasto) => (
                <div
                  key={gasto.id}
                  className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getCategoriaBadgeClass(
                        gasto.categoria
                      )}`}
                    >
                      {gasto.categoria}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-600">
                      Doc: #{gasto.numero_comprobante}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {gasto.tipo_rendicion === 'anticipo' ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Anticipo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                        Reembolso
                      </span>
                    )}

                    {gasto.estado === 'por_pagar' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                        Por Pagar
                      </span>
                    )}
                    {gasto.estado === 'aplicado_a_fondo' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                        Aplicado a Fondo
                      </span>
                    )}
                    {gasto.estado === 'cerrado' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">
                        Cerrado
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-baseline">
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-tight">
                        {gasto.nombre_empleado}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {gasto.area_empleado}
                      </p>
                    </div>
                    <p className="text-lg font-black text-slate-900">
                      {formatCLP(gasto.monto)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-400">
                    <span>{formatDate(gasto.created_at)}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleVerFoto(gasto.foto_url, `Boleta #${gasto.numero_comprobante} - ${gasto.nombre_empleado}`)
                        }
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold shadow-sm"
                      >
                        Boleta
                      </button>

                      {gasto.tipo_rendicion === 'reembolso' && gasto.estado === 'por_pagar' && (
                        <button
                          type="button"
                          onClick={() => setGastoToReembolsar(gasto)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-black shadow-sm"
                        >
                          Pagar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 7. MODAL ASIGNAR FONDO / VIÁTICO */}
      {modalAsignarOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalAsignarOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Asignar Fondo / Viático
                </h3>
                <p className="text-xs text-slate-500">
                  Entrega dinero previo (caja chica / viático de terreno) a un colaborador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAsignarOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {asignarState?.error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs font-bold">
                {asignarState.error}
              </div>
            )}

            <form ref={asignarFormRef} action={asignarAction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Colaborador *
                </label>
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Selecciona un colaborador...
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.area} - {p.rol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de Asignación *
                </label>
                <input
                  name="motivo"
                  type="text"
                  required
                  placeholder="Ej: Viático Terreno Copiapó"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto Asignado ($ CLP) *
                </label>
                <input
                  name="monto"
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="Ej: 150000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-black focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAsignarOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAsignando}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                >
                  {isAsignando ? 'Asignando...' : 'Guardar y Asignar Fondo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL PAGAR / REEMBOLSAR (NIVELACIÓN Y CIERRE) */}
      {gastoToReembolsar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setGastoToReembolsar(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Reembolsar Gasto Propio
                </h3>
                <p className="text-xs text-slate-500">
                  Registra la transferencia bancaria y cierra la rendición.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGastoToReembolsar(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {reembolsarState?.error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs font-bold">
                {reembolsarState.error}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <div className="flex justify-between">
                <span>Colaborador:</span>
                <strong className="text-slate-900">{gastoToReembolsar.nombre_empleado}</strong>
              </div>
              <div className="flex justify-between">
                <span>Comprobante:</span>
                <strong className="text-slate-900">#{gastoToReembolsar.numero_comprobante} ({gastoToReembolsar.categoria})</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-800">Monto a Transferir:</span>
                <strong className="font-black text-emerald-700">{formatCLP(gastoToReembolsar.monto)}</strong>
              </div>
            </div>

            <form ref={reembolsarFormRef} action={reembolsarAction} className="space-y-3.5">
              <input type="hidden" name="gastoId" value={gastoToReembolsar.id} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Comprobante de Transferencia Bancaria *
                </label>
                <input
                  type="file"
                  name="comprobantePago"
                  accept="image/*"
                  required
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Sube la captura de la transferencia realizada desde la cuenta de la empresa.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGastoToReembolsar(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isReembolsando}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  {isReembolsando ? 'Procesando...' : 'Confirmar Pago y Cerrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL VISOR DE FOTOGRAFÍAS */}
      {modalTitle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 print:hidden"
          onClick={closeModal}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 text-white">
              <h3 className="text-sm font-bold truncate pr-4">{modalTitle}</h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-white hover:text-red-400 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1 text-xs font-bold transition-colors"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="flex items-center justify-center bg-black p-2 min-h-[300px] max-h-[75vh]">
              {modalLoading && (
                <div className="text-slate-400 text-xs font-medium animate-pulse">
                  Cargando imagen en alta resolución...
                </div>
              )}

              {modalError && (
                <div className="text-red-400 text-xs font-semibold p-4 text-center">
                  {modalError}
                </div>
              )}

              {modalImageUrl && (
                <img
                  src={modalImageUrl}
                  alt={modalTitle}
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
