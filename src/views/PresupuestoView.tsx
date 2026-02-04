import React, { useState, useMemo } from 'react';
import { getThemeColors } from '../utils/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Tooltip } from '../components/Tooltip';
import { CategoryType, TransactionStatus, PaymentMethod, BudgetEntry, AppState, InstallmentPurchase } from '../types';
import { categoryConfig } from '../config/constants';
import { generateUUID } from '../utils/helpers';

interface PresupuestoViewProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAIUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isParsing: boolean;
  collapsedCategories: Set<string>;
  setCollapsedCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
  currentTotals: Record<CategoryType, number>;
  formatMoney: (amount: number) => string;
  setEditingEntry: (entry: BudgetEntry) => void;
  categories: Record<CategoryType, string[]>;
  currentMonth: string;
  installmentPurchases: InstallmentPurchase[];
  currentBudgetEntries: BudgetEntry[];
  setViewingInstallment: (installment: InstallmentPurchase | null) => void;
  expandedRows: Set<string>;
  setExpandedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  deleteEntry: (id: string) => void;
  categoryBudgets: Record<CategoryType, number>;
  onUpdateBudget: (category: string, amount: number) => void;
  onReorderEntries: (entries: BudgetEntry[]) => void;
  onConfirmEntry: (entry: BudgetEntry) => void;
  onPayEntry: (entry: BudgetEntry) => void;
  initialViewMode: 'monthly' | 'biweekly';
}

export const PresupuestoView: React.FC<PresupuestoViewProps> = ({
  fileInputRef,
  handleAIUpload,
  isParsing,
  collapsedCategories,
  setCollapsedCategories,
  currentTotals,
  formatMoney,
  setEditingEntry,
  categories,
  currentMonth,
  installmentPurchases,
  currentBudgetEntries,
  setViewingInstallment,
  expandedRows,
  setExpandedRows,
  deleteEntry,
  categoryBudgets,
  onUpdateBudget,
  onReorderEntries,
  onConfirmEntry,
  onPayEntry,
  initialViewMode
}) => {
  const themeColors = getThemeColors();
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'monthly' | 'biweekly'>(initialViewMode);

  React.useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  const [draggedItem, setDraggedItem] = useState<BudgetEntry | null>(null);

  const sortEntries = (a: BudgetEntry, b: BudgetEntry) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    const isCreditA = a.paymentMethod === PaymentMethod.CREDIT || a.installmentRef || a.subEntries;
    const isCreditB = b.paymentMethod === PaymentMethod.CREDIT || b.installmentRef || b.subEntries;
    if (isCreditA && !isCreditB) return -1;
    if (!isCreditA && isCreditB) return 1;
    return 0;
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, item: BudgetEntry) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag ghost image semi-transparent
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetItem: BudgetEntry) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    if (draggedItem.category !== targetItem.category) return;

    const categoryEntries = currentBudgetEntries
      .filter(entry => entry.category === draggedItem.category)
      .sort(sortEntries);

    const currentIndex = categoryEntries.findIndex(e => e.id === draggedItem.id);
    const targetIndex = categoryEntries.findIndex(e => e.id === targetItem.id);

    if (currentIndex === -1 || targetIndex === -1) return;

    const newEntries = [...categoryEntries];
    newEntries.splice(currentIndex, 1);
    newEntries.splice(targetIndex, 0, draggedItem);

    const updates = newEntries.map((entry, index) => ({
      ...entry,
      order: index
    }));

    onReorderEntries(updates);
  };

  const totalConsumption = useMemo(() => {
    return Object.values(CategoryType)
      .filter(cat => cat !== CategoryType.INCOME)
      .filter(cat => filterCategory === 'ALL' || cat === filterCategory)
      .reduce((acc, cat) => acc + (currentTotals[cat] || 0), 0);
  }, [currentTotals, filterCategory]);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 gap-4">

        {/* View Mode Indicator */}
        <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-2 pr-4 border border-white/5">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${initialViewMode === 'biweekly' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
            <i className={`fas ${initialViewMode === 'biweekly' ? 'fa-calendar-week' : 'fa-calendar-alt'} text-xl`}></i>
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo de Vista</div>
            <div className={`text-sm font-bold ${initialViewMode === 'biweekly' ? 'text-purple-400' : 'text-blue-400'}`}>
              {initialViewMode === 'biweekly' ? 'Quincenal' : 'Mensual'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">Filtrar por:</span>
          <select
            className={`${themeColors.input} flex-1 sm:flex-none w-full sm:w-auto rounded-xl px-4 py-2.5 text-white text-xs font-bold outline-none uppercase tracking-wide cursor-pointer hover:bg-white/5 transition-colors [&>option]:bg-slate-900 [&>option]:text-white`}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="ALL">Todas las Categorías</option>
            {Object.values(CategoryType).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {Object.values(CategoryType)
        .filter(cat => filterCategory === 'ALL' || cat === filterCategory)
        .map(cat => {
          const config = categoryConfig[cat];
          return (
            <div key={cat} className="space-y-4">
              <Card className="relative overflow-hidden group border-none" variant="glass" noPadding>
                {/* Header de Categoría con Gradiente Específico */}
                <div className={`absolute inset-0 bg-gradient-to-r ${config.bg} opacity-50 group-hover:opacity-70 transition-opacity duration-500`}></div>
                <div className="relative z-10">
                  <div
                    className="flex justify-between items-center p-6 pb-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                    onClick={() => setCollapsedCategories(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(cat)) newSet.delete(cat);
                      else newSet.add(cat);
                      return newSet;
                    })}
                  >
                    <div className="flex items-center gap-4">
                      <i className={`fas fa-chevron-down text-slate-400 transition-transform duration-300 ${collapsedCategories.has(cat) ? '-rotate-90' : ''}`}></i>
                      <div className={`w-12 h-12 rounded-2xl bg-slate-900/50 backdrop-blur-sm border ${config.border} flex items-center justify-center shadow-lg`}>
                        <i className={`fas ${config.icon} text-xl ${config.color} drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]`}></i>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-white tracking-tight">{cat}</h3>
                          <Tooltip
                            position="right"
                            useIcon
                            content={
                              cat === CategoryType.INCOME ? "Registra aquí todos tus ingresos fijos (Sueldo) y variables (Ventas, Changas)." :
                                cat === CategoryType.FIXED_EXPENSE ? "Gastos obligatorios que se repiten todos los meses (Alquiler, Internet, Seguros)." :
                                  cat === CategoryType.VARIABLE_EXPENSE ? "Gastos del día a día que varían mes a mes (Supermercado, Salidas, Regalos)." :
                                    cat === CategoryType.SAVINGS ? "Dinero reservado para metas futuras, fondo de emergencia o inversiones." :
                                      cat === CategoryType.CREDIT_CARD ? "Registro de consumos con tarjeta de crédito y pago de resúmenes." :
                                        "Sección para administrar tus movimientos."
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total del periodo</span>
                          <div className="h-px w-8 bg-white/10"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="space-y-1 w-32" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Presupuesto</label>
                        <input
                          type="number"
                          className="w-full bg-slate-900 rounded-xl p-2 border border-white/5 focus:border-blue-500 outline-none text-sm font-bold text-right"
                          placeholder="0"
                          value={categoryBudgets?.[cat] || ''}
                          onChange={(e) => onUpdateBudget(cat, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${config.color} drop-shadow-sm`}>
                          {formatMoney(currentTotals[cat] || 0)}
                        </p>

                      </div>
                      <Button size="sm" variant="glass" className={`rounded-xl border ${config.border} hover:bg-white/10`} onClick={(e) => {
                        e.stopPropagation();
                        setEditingEntry({
                          id: generateUUID(), name: '', amount: 0, category: cat, tag: categories[cat]?.[0] || 'General',
                          date: currentMonth + '-01', status: TransactionStatus.PENDING, paymentMethod: PaymentMethod.CASH,
                          viewType: initialViewMode
                        })
                      }}>
                        <i className={`fas fa-plus mr-2 ${config.color}`}></i> Añadir
                      </Button>
                    </div>
                  </div>

                  {/* Tabla de Movimientos */}
                  {!collapsedCategories.has(cat) && (
                    <div className="p-0 animate-in slide-in-from-top-4 duration-300 overflow-x-auto">
                      {(() => {
                        const catEntries = currentBudgetEntries
                          .filter(e => e.category === cat)
                          .filter(e => {
                            if (viewMode === 'biweekly') {
                              // Show if explicitly biweekly, OR if it's a generated/common entry (no viewType or monthly)
                              // This ensures Installments and standard expenses appear in the list
                              return e.viewType === 'biweekly' || !e.viewType || e.viewType === 'monthly';
                            }
                            return !e.viewType || e.viewType === 'monthly';
                          })
                          .sort(sortEntries);

                        if (catEntries.length === 0) {
                          return (
                            <div className="px-8 py-12 text-center text-slate-500 font-bold italic opacity-50 border-t border-white/5">
                              No hay registros este mes
                            </div>
                          );
                        }

                        const sections = [];
                        if (viewMode === 'monthly') {
                          sections.push({ title: null, entries: catEntries, defaultDate: currentMonth + '-01' });
                        } else {
                          const firstQ: BudgetEntry[] = [];
                          const secondQ: BudgetEntry[] = [];

                          catEntries.forEach(entry => {
                            if (entry.subEntries && entry.subEntries.length > 0) {
                              const subQ1 = entry.subEntries.filter(s => {
                                if (!s.date) return false;
                                const d = parseInt(s.date.split('T')[0].split('-')[2]);
                                return d <= 15;
                              });
                              const subQ2 = entry.subEntries.filter(s => {
                                if (!s.date) return false;
                                const d = parseInt(s.date.split('T')[0].split('-')[2]);
                                return d > 15;
                              });

                              if (subQ1.length > 0) {
                                firstQ.push({
                                  ...entry,
                                  id: `${entry.id}-Q1`,
                                  amount: subQ1.reduce((sum, s) => sum + s.amount, 0),
                                  subEntries: subQ1
                                });
                              }
                              if (subQ2.length > 0) {
                                secondQ.push({
                                  ...entry,
                                  id: `${entry.id}-Q2`,
                                  amount: subQ2.reduce((sum, s) => sum + s.amount, 0),
                                  subEntries: subQ2
                                });
                              }
                            } else {
                              if (!entry.date) return;
                              const day = parseInt(entry.date.split('T')[0].split('-')[2]);
                              if (day <= 15) firstQ.push(entry);
                              else secondQ.push(entry);
                            }
                          });

                          sections.push({ title: '1ª Quincena (Días 1-15)', entries: firstQ, defaultDate: currentMonth + '-01' });
                          sections.push({ title: '2ª Quincena (Días 16-Fin de mes)', entries: secondQ, defaultDate: currentMonth + '-16' });
                        }

                        return (
                          <div className="flex flex-col gap-0">
                            {sections.map((section, idx) => {
                              // Mostrar siempre si hay entradas, o si es quincenal mostrar aunque esté vacía para permitir añadir
                              // Pero para mantener consistencia con "No hay registros" si todo está vacío, mejor manejamos eso arriba.
                              // Aquí: si es quincenal y está vacío, queremos mostrar el header para poder añadir?
                              // El código original retornaba null si entries.length === 0 && viewMode === 'biweekly' && idx > 0
                              // Vamos a permitir ver el header siempre en modo quincenal para poder añadir items a esa quincena

                              return (
                                <div key={idx} className={`${viewMode === 'biweekly' && idx > 0 ? 'mt-4' : ''}`}>
                                  {section.title && (
                                    <div className="px-6 py-2 bg-indigo-900/20 border-y border-white/5 backdrop-blur-sm flex justify-between items-center group/section">
                                      <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                                        <i className="fas fa-calendar-week"></i>
                                        {section.title}
                                      </h4>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingEntry({
                                            id: generateUUID(), name: '', amount: 0, category: cat, tag: categories[cat]?.[0] || 'General',
                                            date: section.defaultDate, status: TransactionStatus.PENDING, paymentMethod: PaymentMethod.CASH
                                          });
                                        }}
                                        className="opacity-0 group-hover/section:opacity-100 transition-opacity px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-[9px] font-black text-indigo-300 uppercase tracking-wider border border-indigo-500/30"
                                      >
                                        <i className="fas fa-plus mr-1"></i> Añadir
                                      </button>
                                    </div>
                                  )}
                                  <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/5 border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                      <tr>
                                        <th className="px-4 py-3 pl-6 lg:px-8 lg:py-4 lg:pl-10">Concepto</th>
                                        <th className="hidden lg:table-cell px-8 py-4">Etiqueta</th>
                                        <th className="hidden lg:table-cell px-8 py-4">Método</th>
                                        <th className="hidden lg:table-cell px-8 py-4 text-center">Estado</th>
                                        <th className="px-4 py-3 lg:px-8 lg:py-4 text-right">Monto</th>
                                        <th className="px-4 py-3 lg:px-8 lg:py-4 text-center">Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {section.entries.map(e => {
                                        const isCredit = e.paymentMethod === PaymentMethod.CREDIT || e.installmentRef || e.subEntries;
                                        const isPaid = e.status === TransactionStatus.PAID;
                                        return (
                                          <tr
                                            key={e.id}
                                            draggable={true}
                                            onDragStart={(ev) => handleDragStart(ev, e)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDrop={(ev) => handleDrop(ev, e)}
                                            className={`group/row hover:bg-white/[0.03] transition-colors cursor-pointer ${isPaid ? 'bg-amber-500/10 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] z-10 relative my-1 rounded-lg' : isCredit ? 'bg-indigo-900/10' : ''} ${e.is_provisional ? 'border-2 border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10' : ''}`}
                                            onClick={() => {
                                              if (e.installmentRef) setViewingInstallment(installmentPurchases.find(i => i.id === e.installmentRef) || null);
                                              if (e.subEntries) {
                                                const newExpanded = new Set(expandedRows);
                                                if (newExpanded.has(e.id)) newExpanded.delete(e.id);
                                                else newExpanded.add(e.id);
                                                setExpandedRows(newExpanded);
                                              }
                                            }}>
                                            <td className={`px-4 py-3 pl-6 lg:px-8 lg:py-4 lg:pl-10 ${!isPaid && isCredit ? 'border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}>
                                              <div className="flex items-start gap-3">
                                                <div className="mt-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 opacity-0 group-hover/row:opacity-100 transition-opacity" title="Arrastrar para reordenar">
                                                  <i className="fas fa-grip-vertical"></i>
                                                </div>
                                                <div className="flex flex-col flex-1">
                                                  <div className="flex items-center gap-2">
                                                    {e.subEntries && (
                                                      <i className={`fas fa-chevron-right text-xs text-blue-500 transition-transform duration-300 ${expandedRows.has(e.id) ? 'rotate-90' : ''}`}></i>
                                                    )}
                                                    <span className="font-bold text-white group-hover/row:text-blue-400 transition-colors text-sm">{e.name}</span>
                                                    {isCredit && <i className="fas fa-credit-card text-[10px] text-indigo-400 ml-1" title="Compra con Crédito"></i>}
                                                  </div>
                                                  {!e.subEntries && (
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{(() => {
                                                      if (!e.date) return '';
                                                      const parts = e.date.split('T')[0].split('-');
                                                      return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                    })()}</span>
                                                  )}
                                                  {!!e.is_provisional && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-500 border border-amber-500/30 ml-2 animate-pulse">
                                                      <i className="fas fa-fw fa-clock text-[9px]"></i>
                                                      <span className="text-[9px] font-black uppercase tracking-wider">Proyectado</span>
                                                    </span>
                                                  )}
                                                  {e.subEntries && expandedRows.has(e.id) && (
                                                    <div className="mt-2 pl-4 border-l-2 border-white/10 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                      {e.subEntries.map(sub => (
                                                        <div key={sub.id} className="text-xs text-slate-400 flex justify-between items-center group/sub py-1 hover:bg-white/5 px-2 rounded-lg -ml-2">
                                                          <div className="flex items-center gap-2">
                                                            {sub.installmentRef ? (
                                                              <span className="text-[9px] font-black bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-white/5 tracking-wider uppercase">Cuota {sub.currentInstallment}/{sub.totalInstallments}</span>
                                                            ) : sub.category === CategoryType.INCOME ? (
                                                              <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 tracking-wider uppercase">Ingreso</span>
                                                            ) : (
                                                              <span className="text-[9px] font-black text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded tracking-wider uppercase">Consumo</span>
                                                            )}
                                                            <span className={`group-hover/sub:text-white transition-colors ${sub.category === CategoryType.INCOME ? 'text-emerald-400 font-bold' : ''}`}>
                                                              {sub.name.replace(/\s*\(Cuota \d+\/\d+\)/, '')}
                                                            </span>
                                                          </div>
                                                          <div className="flex items-center gap-3">
                                                            <span className={`font-mono flex items-center gap-2 ${sub.category === CategoryType.INCOME ? 'text-emerald-400 font-bold' : ''}`}>
                                                              {sub.currency && sub.currency !== 'ARS' && sub.originalAmount && (
                                                                <span className="text-[10px] text-slate-400 font-semibold bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                                  {sub.currency} {sub.originalAmount.toFixed(2)}
                                                                </span>
                                                              )}
                                                              <span>{sub.category === CategoryType.INCOME ? '+' : ''}{formatMoney(sub.amount)}</span>
                                                            </span>
                                                            {sub.installmentRef ? (
                                                              <div
                                                                className="opacity-0 group-hover/sub:opacity-100 p-1 text-amber-500 hover:bg-amber-500/10 rounded transition-all cursor-help"
                                                                title="Gestionar desde el módulo Cuotas / Tarjetas"
                                                              >
                                                                <i className="fas fa-circle-question text-[10px]"></i>
                                                              </div>
                                                            ) : (
                                                              <>
                                                                <button
                                                                  onClick={(ev) => { ev.stopPropagation(); setEditingEntry(sub); }}
                                                                  className="opacity-0 group-hover/sub:opacity-100 p-1 text-blue-500 hover:bg-blue-500/10 rounded transition-all"
                                                                  title="Editar consumo individual"
                                                                >
                                                                  <i className="fas fa-pencil text-[10px]"></i>
                                                                </button>
                                                                <button
                                                                  onClick={(ev) => { ev.stopPropagation(); deleteEntry(sub.id); }}
                                                                  className="opacity-0 group-hover/sub:opacity-100 p-1 text-rose-500 hover:bg-rose-500/10 rounded transition-all"
                                                                  title="Eliminar consumo"
                                                                >
                                                                  <i className="fas fa-trash text-[10px]"></i>
                                                                </button>
                                                              </>
                                                            )}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="hidden lg:table-cell px-8 py-4">
                                              {e.installmentRef ? (
                                                <span className="inline-flex items-center px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-wide">
                                                  <i className="fas fa-clock mr-1.5"></i> Cuota {e.currentInstallment}/{e.totalInstallments}
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 bg-white/5 text-slate-300 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wide group-hover/row:border-blue-500/30 transition-colors">
                                                  <i className="fas fa-tag mr-1.5 opacity-50"></i> {e.tag}
                                                </span>
                                              )}
                                            </td>
                                            <td className="hidden lg:table-cell px-8 py-4">
                                              <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                                <i className={`fas ${e.paymentMethod === PaymentMethod.CASH ? 'fa-money-bill' : e.paymentMethod === PaymentMethod.CREDIT ? 'fa-credit-card' : 'fa-building-columns'} opacity-50`}></i>
                                                {e.paymentMethod}
                                              </span>
                                            </td>
                                            <td className="hidden lg:table-cell px-8 py-4 text-center">
                                              {isPaid && (
                                                <span className="inline-flex items-center px-2.5 py-1 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded-lg text-[10px] font-black uppercase tracking-wide shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                                  <i className="fas fa-check mr-1.5"></i> Pago
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 lg:px-8 lg:py-4 text-right">
                                              <span className={`font-black text-sm ${isPaid ? 'text-amber-500/50 line-through decoration-2' : 'text-white'}`}>{formatMoney(e.amount)}</span>
                                              {e.currency && e.currency !== 'ARS' && e.originalAmount && (
                                                <div className="flex flex-col items-end mt-1 animate-in slide-in-from-right-2 duration-300">
                                                  <span className="text-[10px] font-black text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded border border-green-400/20">
                                                    {e.currency} {e.originalAmount.toFixed(2)}
                                                  </span>
                                                  <span className="text-[9px] font-bold text-slate-500 mt-0.5">
                                                    x {e.exchangeRateActual || e.exchangeRateEstimated}
                                                  </span>
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 lg:px-8 lg:py-4 text-center">
                                              {!e.installmentRef && !e.id.startsWith('card-agg-') && (
                                                <div className="flex justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity transform translate-x-2 group-hover/row:translate-x-0 duration-300">
                                                  {!isPaid && (
                                                    <button
                                                      onClick={(ev) => { ev.stopPropagation(); onPayEntry(e); }}
                                                      className="h-8 px-3 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-lg hover:shadow-amber-500/30 flex items-center justify-center gap-2"
                                                      title="Marcar como Pagado"
                                                    >
                                                      <i className="fas fa-check-double text-xs"></i>
                                                      <span className="text-[10px] font-black uppercase tracking-wider hidden xl:inline">Pague</span>
                                                    </button>
                                                  )}
                                                  {!!e.is_provisional && (
                                                    <button onClick={(ev) => { ev.stopPropagation(); onConfirmEntry(e); }} className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-lg hover:shadow-amber-500/30 flex items-center justify-center" title="Confirmar movimiento">
                                                      <i className="fas fa-check text-xs"></i>
                                                    </button>
                                                  )}
                                                  <button onClick={(ev) => { ev.stopPropagation(); setEditingEntry(e); }} className={`w-8 h-8 rounded-xl ${themeColors.iconBg} hover:bg-opacity-100 hover:text-white transition-all shadow-lg flex items-center justify-center`} title="Editar movimiento"><i className="fas fa-pencil text-xs"></i></button>
                                                  <button onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }} className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg hover:shadow-rose-500/30 flex items-center justify-center" title="Eliminar movimiento"><i className="fas fa-trash text-xs"></i></button>
                                                </div>
                                              )}
                                              {(e.installmentRef || e.id.startsWith('card-agg-')) && <i className="fas fa-lock text-indigo-500/30 text-xs" title="Movimiento automático"></i>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          );
        })}

      {/* Footer Total Consumo */}
      <Card variant="glass" className="border border-white/10 mt-8 relative overflow-hidden group">
        <div className={`absolute inset-0 ${themeColors.card} opacity-90`}></div>
        <div className="absolute -right-10 -bottom-10 text-white/5 rotate-12 transform scale-150">
          <i className="fas fa-coins text-9xl"></i>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center p-6 gap-4">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <i className="fas fa-sack-dollar text-2xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-wide">Total Consumo</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                {filterCategory === 'ALL' ? 'Suma de todos los módulos' : `Total en ${filterCategory}`}
              </p>
            </div>
          </div>
          <div className="text-right bg-black/20 px-8 py-4 rounded-2xl border border-white/5 backdrop-blur-sm">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Monto Total</p>
            <p className="text-4xl font-black text-white tracking-tight">{formatMoney(totalConsumption)}</p>
            {(() => {
              const projectedTotalConsumption = Object.values(CategoryType)
                .filter(cat => cat !== CategoryType.INCOME)
                .filter(cat => filterCategory === 'ALL' || cat === filterCategory)
                .reduce((acc, cat) => {
                  const catEntries = currentBudgetEntries.filter(e => e.category === cat);
                  return acc + catEntries.reduce((sum, e) => sum + e.amount, 0);
                }, 0);

              if (projectedTotalConsumption !== totalConsumption) {
                return (
                  <div className="mt-2 pt-2 border-t border-white/5 animate-in slide-in-from-right-2 text-right">
                    <div className="flex items-center justify-end gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Proyectado</span>
                      <Tooltip content="Total de consumo estimado incluyendo todos los movimientos provisorios." position="left" useIcon />
                    </div>
                    <p className="text-xl font-black text-amber-500">{formatMoney(projectedTotalConsumption)}</p>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </Card>
    </div>
  );
};
