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

export default function PanelAdmin({ gastos, profiles }: PanelAdminProps) {
  const [selectedArea, setSelectedArea] = useState<string>('Todas');
  const [selectedUser, setSelectedUser] = useState<string>('Todos');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');

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

  // Filtrado de gastos
  const filteredGastos = useMemo(() => {
    return gastos.filter((g) => {
      const matchArea = selectedArea === 'Todas' || g.area_empleado === selectedArea;
      const matchUser = selectedUser === 'Todos' || g.user_id === selectedUser;
      const matchCat = selectedCategoria === 'Todas' || g.categoria === selectedCategoria;
      return matchArea && matchUser && matchCat;
    });
  }, [gastos, selectedArea, selectedUser, selectedCategoria]);

  // Sumatorias dinámicas
  const totalRendido = useMemo(() => {
    return filteredGastos.reduce((sum, g) => sum + g.monto, 0);
  }, [filteredGastos]);

  const cantidadBoletas = filteredGastos.length;

  // Desglose acumulado por cada una de las áreas corporativas
  const desglosePorArea = useMemo(() => {
    const mapa: Record<string, number> = {};
    AREAS.forEach((a) => (mapa[a] = 0));
    // Se calcula sobre el subconjunto filtrado por usuario/categoría para consistencia
    const baseGastos = gastos.filter((g) => {
      const matchUser = selectedUser === 'Todos' || g.user_id === selectedUser;
      const matchCat = selectedCategoria === 'Todas' || g.categoria === selectedCategoria;
      return matchUser && matchCat;
    });
    baseGastos.forEach((g) => {
      if (mapa[g.area_empleado] !== undefined) {
        mapa[g.area_empleado] += g.monto;
      }
    });
    return mapa;
  }, [gastos, selectedUser, selectedCategoria]);

  const resetFilters = () => {
    setSelectedArea('Todas');
    setSelectedUser('Todos');
    setSelectedCategoria('Todas');
  };

  const hasActiveFilters =
    selectedArea !== 'Todas' || selectedUser !== 'Todos' || selectedCategoria !== 'Todas';

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
      {/* 1. Tarjetas de Sumatorias Dinámicas */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Rendido */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Rendido
          </span>
          <p className="text-3xl font-black text-slate-900 mt-1">
            {formatCLP(totalRendido)}
          </p>
          <span className="text-[11px] font-medium text-slate-500 mt-1 block">
            {hasActiveFilters ? 'Suma según filtros activos' : 'Suma total histórica'}
          </span>
        </div>

        {/* Cantidad de Boletas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Comprobantes Registrados
          </span>
          <p className="text-3xl font-black text-sky-600 mt-1">
            {cantidadBoletas}
          </p>
          <span className="text-[11px] font-medium text-slate-500 mt-1 block">
            {cantidadBoletas === 1 ? '1 rendición encontrada' : `${cantidadBoletas} rendiciones encontradas`}
          </span>
        </div>

        {/* Promedio por Rendición */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Gasto Promedio por Boleta
          </span>
          <p className="text-3xl font-black text-emerald-600 mt-1">
            {cantidadBoletas > 0 ? formatCLP(Math.round(totalRendido / cantidadBoletas)) : '$0'}
          </p>
          <span className="text-[11px] font-medium text-slate-500 mt-1 block">
            Cálculo instantáneo
          </span>
        </div>
      </section>

      {/* 2. Desglose Rápido por Área (Pills compactas sin gráficos pesados) */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
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

      {/* 3. Barra de Filtros Simples */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-sm font-bold text-slate-900">
            Filtros de Búsqueda
          </h2>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-bold text-sky-600 hover:text-sky-800 self-start sm:self-auto"
            >
              ✕ Limpiar todos los filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Filtro Área */}
          <div>
            <label
              htmlFor="filtro-area"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Área
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
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">
            Registro Consolidado de Rendiciones
          </h2>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {filteredGastos.length} registros
          </span>
        </div>

        {filteredGastos.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <p className="text-base font-semibold">No se encontraron rendiciones.</p>
            <p className="text-xs text-slate-400 mt-1">
              Prueba cambiando o limpiando los filtros seleccionados.
            </p>
          </div>
        ) : (
          <>
            {/* Vista de Escritorio: Tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">
                      Fecha / Hora
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Colaborador
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Área
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Categoría
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      N° Comprobante
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right">
                      Monto
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-center">
                      Comprobante
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGastos.map((gasto) => (
                    <tr
                      key={gasto.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(gasto.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 block leading-tight">
                          {gasto.nombre_empleado}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          {gasto.email_empleado}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {gasto.area_empleado}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getCategoriaBadgeClass(
                            gasto.categoria
                          )}`}
                        >
                          {gasto.categoria}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                        #{gasto.numero_comprobante}
                      </td>
                      <td className="px-5 py-3.5 font-black text-slate-900 text-right whitespace-nowrap text-base">
                        {formatCLP(gasto.monto)}
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
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
              </table>
            </div>

            {/* Vista Móvil: Tarjetas apiladas */}
            <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
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
