'use client';

import { useState, useMemo } from 'react';
import { obtenerUrlComprobante } from '@/app/admin/actions';

export interface GastoAdminItem {
  id: string;
  user_id: string;
  categoria: string;
  numero_comprobante: string;
  monto: number;
  foto_url: string;
  created_at: string;
  nombre_empleado: string;
  email_empleado: string;
  area_empleado: string;
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

export default function PanelAdmin({ gastos, profiles }: PanelAdminProps) {
  const [selectedArea, setSelectedArea] = useState<string>('Todas');
  const [selectedUser, setSelectedUser] = useState<string>('Todos');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');
  const [selectedRangoFecha, setSelectedRangoFecha] = useState<RangoFecha>('todos');
  const [selectedMesParticular, setSelectedMesParticular] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Estado para el modal de visualización de fotos
  const [modalGasto, setModalGasto] = useState<GastoAdminItem | null>(null);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  // Texto legible del colaborador para el informe PDF
  const getTextoColaborador = () => {
    if (selectedUser === 'Todos') return 'Todos los colaboradores';
    const p = profiles.find((item) => item.id === selectedUser);
    return p ? `${p.nombre} (${p.area})` : 'Colaborador Específico';
  };

  // Filtrado reactivo de gastos (Fecha + Área + Usuario + Categoría)
  const filteredGastos = useMemo(() => {
    const now = new Date();

    return gastos.filter((g) => {
      // 1. Filtro por Área
      const matchArea = selectedArea === 'Todas' || g.area_empleado === selectedArea;

      // 2. Filtro por Usuario
      const matchUser = selectedUser === 'Todos' || g.user_id === selectedUser;

      // 3. Filtro por Categoría
      const matchCat = selectedCategoria === 'Todas' || g.categoria === selectedCategoria;

      // 4. Filtro por Rango Temporal
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

      return matchArea && matchUser && matchCat && matchDate;
    });
  }, [gastos, selectedArea, selectedUser, selectedCategoria, selectedRangoFecha, selectedMesParticular]);

  // Sumatorias dinámicas
  const totalRendido = useMemo(() => {
    return filteredGastos.reduce((sum, g) => sum + g.monto, 0);
  }, [filteredGastos]);

  const cantidadBoletas = filteredGastos.length;

  // Desglose acumulado por cada una de las áreas corporativas según filtros activos (excepto área)
  const desglosePorArea = useMemo(() => {
    const mapa: Record<string, number> = {};
    AREAS.forEach((a) => (mapa[a] = 0));

    const now = new Date();
    const baseGastos = gastos.filter((g) => {
      const matchUser = selectedUser === 'Todos' || g.user_id === selectedUser;
      const matchCat = selectedCategoria === 'Todas' || g.categoria === selectedCategoria;

      let matchDate = true;
      const gDate = new Date(g.created_at);
      if (selectedRangoFecha === '7d') {
        matchDate = gDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (selectedRangoFecha === '15d') {
        matchDate = gDate >= new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      } else if (selectedRangoFecha === '30d') {
        matchDate = gDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (selectedRangoFecha === '1y') {
        matchDate = gDate >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      } else if (selectedRangoFecha === 'mes_particular') {
        matchDate = g.created_at.slice(0, 7) === selectedMesParticular;
      }

      return matchUser && matchCat && matchDate;
    });

    baseGastos.forEach((g) => {
      if (mapa[g.area_empleado] !== undefined) {
        mapa[g.area_empleado] += g.monto;
      }
    });

    return mapa;
  }, [gastos, selectedUser, selectedCategoria, selectedRangoFecha, selectedMesParticular]);

  const resetFilters = () => {
    setSelectedArea('Todas');
    setSelectedUser('Todos');
    setSelectedCategoria('Todas');
    setSelectedRangoFecha('todos');
  };

  const hasActiveFilters =
    selectedArea !== 'Todas' ||
    selectedUser !== 'Todos' ||
    selectedCategoria !== 'Todas' ||
    selectedRangoFecha !== 'todos';

  // Abrir modal y obtener foto en alta resolución
  const handleVerComprobante = async (gasto: GastoAdminItem) => {
    setModalGasto(gasto);
    setModalImageUrl(null);
    setModalError(null);
    setModalLoading(true);

    try {
      const res = await obtenerUrlComprobante(gasto.foto_url);
      if (res.signedUrl) {
        setModalImageUrl(res.signedUrl);
      } else {
        setModalError(res.error || 'No se pudo obtener la imagen del comprobante.');
      }
    } catch {
      setModalError('Error de conexión al cargar la fotografía.');
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalGasto(null);
    setModalImageUrl(null);
    setModalError(null);
    setModalLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Membrete Oficial para Exportación PDF (Solo se ve al imprimir / guardar PDF) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">
              ENACOM - Control Financiero
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
              INFORME CONSOLIDADO DE RENDICIÓN DE GASTOS
            </h1>
            <p className="text-xs text-slate-600">
              Reporte generado para Auditoría y Gerencia
            </p>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p><strong>Fecha de Emisión:</strong> {formatDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Resumen de Filtros Aplicados */}
        <div className="mt-3 p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
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
        </div>
      </div>

      {/* 1. Tarjetas de Sumatorias Dinámicas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3">
        {/* Total Rendido */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm print:p-4 print:border-slate-300">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Rendido
          </span>
          <p className="text-3xl font-black text-slate-900 mt-1 print:text-2xl">
            {formatCLP(totalRendido)}
          </p>
          <span className="text-[11px] font-medium text-slate-500 mt-1 block print:hidden">
            {hasActiveFilters ? 'Suma según filtros activos' : 'Suma total histórica'}
          </span>
        </div>

        {/* Cantidad de Boletas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm print:p-4 print:border-slate-300">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Comprobantes Registrados
          </span>
          <p className="text-3xl font-black text-sky-600 mt-1 print:text-2xl print:text-slate-900">
            {cantidadBoletas}
          </p>
          <span className="text-[11px] font-medium text-slate-500 mt-1 block print:hidden">
            {cantidadBoletas === 1 ? '1 rendición encontrada' : `${cantidadBoletas} rendiciones encontradas`}
          </span>
        </div>

        {/* Promedio por Rendición */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm sm:col-span-2 lg:col-span-1 print:p-4 print:border-slate-300">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Gasto Promedio por Boleta
          </span>
          <p className="text-3xl font-black text-emerald-600 mt-1 print:text-2xl print:text-slate-900">
            {cantidadBoletas > 0 ? formatCLP(Math.round(totalRendido / cantidadBoletas)) : '$0'}
          </p>
          <span className="text-[11px] font-medium text-slate-500 mt-1 block print:hidden">
            Cálculo reactivo en tiempo real
          </span>
        </div>
      </section>

      {/* 2. Desglose Rápido por Área (Oculto en impresión para formato ejecutivo) */}
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

      {/* 3. Barra de Filtros Avanzados (Oculto en impresión) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Filtros Avanzados de Búsqueda
            </h2>
            <p className="text-xs text-slate-400">
              Ajusta los parámetros para cuadratura financiera, auditoría o exportación.
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Filtro Rango Temporal */}
          <div>
            <label
              htmlFor="filtro-fecha"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Período / Rango Temporal
            </label>
            <select
              id="filtro-fecha"
              value={selectedRangoFecha}
              onChange={(e) => setSelectedRangoFecha(e.target.value as RangoFecha)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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

          {/* Filtro Área */}
          <div>
            <label
              htmlFor="filtro-area"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Área de la Empresa
            </label>
            <select
              id="filtro-area"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
            <label
              htmlFor="filtro-usuario"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Colaborador
            </label>
            <select
              id="filtro-usuario"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
            <label
              htmlFor="filtro-categoria"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Categoría
            </label>
            <select
              id="filtro-categoria"
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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

      {/* 4. Tabla y Tarjetas de Rendiciones */}
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

          {/* Botón de Exportar Informe PDF */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={filteredGastos.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-bold shadow-md transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Exportar Informe PDF
            </button>
          </div>
        </div>

        {filteredGastos.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <p className="text-base font-semibold">No se encontraron rendiciones con los filtros actuales.</p>
            <p className="text-xs text-slate-400 mt-1">
              Prueba cambiando el rango de fechas o limpiando los filtros seleccionados.
            </p>
          </div>
        ) : (
          <>
            {/* Tabla para Escritorio y Formato Impreso */}
            <div className="overflow-x-auto print:block">
              <table className="w-full text-left text-sm text-slate-700 print:text-xs print:border print:border-slate-300">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 print:bg-slate-100 print:text-black">
                  <tr>
                    <th scope="col" className="px-5 py-3.5 print:px-3 print:py-2">
                      Fecha / Hora
                    </th>
                    <th scope="col" className="px-5 py-3.5 print:px-3 print:py-2">
                      Colaborador
                    </th>
                    <th scope="col" className="px-5 py-3.5 print:px-3 print:py-2">
                      Área
                    </th>
                    <th scope="col" className="px-5 py-3.5 print:px-3 print:py-2">
                      Categoría
                    </th>
                    <th scope="col" className="px-5 py-3.5 print:px-3 print:py-2">
                      N° Comprobante
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right print:px-3 print:py-2">
                      Monto
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-center print:hidden">
                      Comprobante
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {filteredGastos.map((gasto) => (
                    <tr
                      key={gasto.id}
                      className="hover:bg-slate-50/70 transition-colors print:bg-transparent"
                    >
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap print:px-3 print:py-2 print:text-slate-800">
                        {formatDate(gasto.created_at)}
                      </td>
                      <td className="px-5 py-3.5 print:px-3 print:py-2">
                        <span className="font-bold text-slate-900 block leading-tight">
                          {gasto.nombre_empleado}
                        </span>
                        <span className="text-[11px] text-slate-400 block print:text-slate-600">
                          {gasto.email_empleado}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-600 whitespace-nowrap print:px-3 print:py-2 print:text-slate-800">
                        {gasto.area_empleado}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap print:px-3 print:py-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoriaBadgeClass(
                            gasto.categoria
                          )}`}
                        >
                          {gasto.categoria}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap print:px-3 print:py-2">
                        #{gasto.numero_comprobante}
                      </td>
                      <td className="px-5 py-3.5 font-black text-slate-900 text-right whitespace-nowrap text-base print:text-xs print:px-3 print:py-2">
                        {formatCLP(gasto.monto)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap print:hidden">
                        <button
                          type="button"
                          onClick={() => handleVerComprobante(gasto)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-sky-600 font-bold text-xs shadow-sm transition-colors"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          Ver Foto
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Fila de Totales al final de la tabla */}
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={5} className="px-5 py-3.5 text-left text-xs uppercase tracking-wider print:px-3 print:py-2">
                      Total Consolidado ({filteredGastos.length} comprobantes)
                    </td>
                    <td className="px-5 py-3.5 text-right text-base print:text-xs print:px-3 print:py-2 text-slate-900">
                      {formatCLP(totalRendido)}
                    </td>
                    <td className="print:hidden"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Vista Móvil: Tarjetas apiladas (Solo visible en pantallas pequeñas, oculta en impresión) */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3 print:hidden">
              {filteredGastos.map((gasto) => (
                <div
                  key={gasto.id}
                  className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 space-y-2"
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
                    <button
                      type="button"
                      onClick={() => handleVerComprobante(gasto)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold shadow-sm"
                    >
                      Ver Comprobante
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 5. Modal Visor de Comprobante en Alta Resolución */}
      {modalGasto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 print:hidden"
          onClick={closeModal}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 text-white">
              <div>
                <h3 className="text-sm font-bold">
                  Comprobante #{modalGasto.numero_comprobante}
                </h3>
                <p className="text-xs text-slate-400">
                  {modalGasto.nombre_empleado} • {modalGasto.area_empleado} • {formatCLP(modalGasto.monto)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-white hover:text-red-400 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1 text-xs font-bold transition-colors"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Contenido / Imagen */}
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
                  alt={`Comprobante ${modalGasto.numero_comprobante}`}
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
              )}
            </div>

            {/* Footer con información del gasto */}
            <div className="bg-slate-950 p-3 text-[11px] text-slate-400 flex flex-wrap justify-between items-center gap-2">
              <span>Categoría: <strong className="text-slate-200">{modalGasto.categoria}</strong></span>
              <span>Fecha: <strong className="text-slate-200">{formatDate(modalGasto.created_at)}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
