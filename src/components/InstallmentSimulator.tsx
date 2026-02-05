
import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Plus, Trash2, Calendar, DollarSign, TrendingUp, Loader2, Pencil } from 'lucide-react';
import { Tooltip as InfoTooltip } from './Tooltip';
import { getThemeColors } from '../utils/theme';
import { api } from '../services/api';

interface InstallmentItem {
    id: string;
    description: string;
    totalAmount: number;
    installments: number;
    installmentAmount: number;
    payerId: string;
    debtorId: string;
    startDate: string; // YYYY-MM
    createdBy?: string;
    participants?: string[];
}

interface MonthlyProjection {
    month: string; // YYYY-MM
    items: {
        id: string;
        description: string;
        amount: number;
        originalAmount?: number;
        currency?: string;
        type: 'pay' | 'receive';
        fromTo: string;
    }[];
    netAmount: number;
}

export const InstallmentSimulator: React.FC<{
    members: any[],
    currentUser: any,
    partyId: string,
    currentMonth?: string,
    nicknames?: Record<string, string>
}> = ({ members, currentUser, partyId, currentMonth, nicknames }) => {
    const themeColors = getThemeColors();
    const [items, setItems] = useState<InstallmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Sync member names (if they change in parent via nicknames)
    const getMemberName = (id: string) => {
        if (!id) return 'Usuario (Eliminado)';
        const m = members.find(m =>
            String(m.id) === String(id) ||
            String(m.memberId) === String(id)
        );

        if (m) {
            const nickname = (nicknames && nicknames[m.memberId]) || m.nickname;
            const name = nickname || m.guest_name || m.username || m.firstName || m.email || `Usuario ${String(id).substring(0, 4)}`;
            return String(name).replace(/0+$/, '');
        }

        return 'Usuario (Eliminado)';
    };

    // Form State
    // Find my member ID
    const myMemberId = React.useMemo(() => {
        const me = members.find(m => m.user_id === currentUser.id);
        return me ? (me.id || me.memberId) : currentUser.id;
    }, [members, currentUser.id]);

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [installments, setInstallments] = useState('1');
    const [payerId, setPayerId] = useState(myMemberId || ((members[0]?.id || members[0]?.memberId) || currentUser.id));
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [currency, setCurrency] = useState('ARS');
    const [exchangeRate, setExchangeRate] = useState('');
    const [estimatedRate, setEstimatedRate] = useState(''); // Visual match for UI

    // Projection
    const [projection, setProjection] = useState<MonthlyProjection[]>([]);

    useEffect(() => {
        loadItems();
    }, [partyId]);

    const loadItems = async () => {
        try {
            setLoading(true);
            if (!api.getInstallmentPlans) return;
            const data = await api.getInstallmentPlans(partyId);
            const mappedItems = (data as any[]).map((d: any) => ({
                id: d.id,
                description: d.description,
                totalAmount: d.total_amount,
                installments: d.installments_count,
                installmentAmount: d.installment_amount,
                payerId: d.payer_id,
                debtorId: d.debtor_id,
                startDate: d.start_date,
                createdBy: d.created_by,
                participants: d.participants,
                currency: d.currency || 'ARS',
                exchangeRate: d.exchange_rate || 1
            }));
            setItems(mappedItems);
        } catch (error) {
            console.error("Error loading installments:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async () => {
        if (!description || !amount || participantIds.length === 0) {
            alert("Por favor completa todos los campos y selecciona al menos un participante");
            return;
        }

        try {
            const total = parseFloat(amount);
            const count = parseInt(installments);
            const rate = parseFloat(exchangeRate) || 1;

            const payload = {
                description,
                totalAmount: total,
                installments: count,
                payerId,
                participantIds,
                startMonth,
                currency,
                exchangeRate: currency === 'USD' ? rate : 1
            };

            if (editingId) {
                await api.updateInstallmentPlan(partyId, editingId, payload);
            } else {
                await api.createInstallmentPlan(partyId, payload);
            }

            // Reset Form and State
            setDescription('');
            setAmount('');
            setInstallments('1');
            setParticipantIds([]);
            setEditingId(null);
            setCurrency('ARS');
            setExchangeRate('');
            setEstimatedRate('');
            loadItems();
        } catch (e) {
            console.error('Error saving installment plan:', e);
            alert("Error al guardar el plan de cuotas");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este plan?')) return;
        try {
            setLoading(true);
            await api.deleteInstallmentPlan(partyId, id);
            await loadItems();
        } catch (error) {
            console.error("Error deleting plan:", error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate projection
    useEffect(() => {
        const projections: Record<string, MonthlyProjection> = {};

        items.forEach(item => {
            const [startYear, startMonth] = item.startDate.split('-').map(Number);
            const participants = (item as any).participants || [item.debtorId];

            // CORRECT CALCULATION LOGIC
            // The item.installmentAmount is in the PLAN's currency (e.g., 20 USD).
            // We need to convert it to ARS for the "netAmount" summation.
            const rate = (item as any).exchangeRate || 1;
            const isUSD = (item as any).currency === 'USD';
            const installmentAmountNative = item.installmentAmount;
            const installmentAmountARS = isUSD ? installmentAmountNative * rate : installmentAmountNative;

            for (let i = 0; i < item.installments; i++) {
                let month = startMonth + i;
                let year = startYear;
                while (month > 12) {
                    month -= 12;
                    year += 1;
                }
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;

                if (!projections[monthKey]) {
                    projections[monthKey] = {
                        month: monthKey,
                        items: [],
                        netAmount: 0 // Always in ARS
                    };
                }

                const isPayerMe = item.payerId === currentUser.id;
                const isParticipantMe = participants.includes(currentUser.id);

                if (isPayerMe) {
                    participants.forEach((participantId: string) => {
                        projections[monthKey].items.push({
                            id: item.id,
                            description: `${item.description} (${i + 1}/${item.installments})`,
                            amount: installmentAmountARS, // Store ARS for consistency in sorting/display logic potentially
                            originalAmount: installmentAmountNative, // Keep original
                            currency: (item as any).currency || 'ARS',
                            type: 'receive',
                            fromTo: getMemberName(participantId)
                        });
                        projections[monthKey].netAmount += installmentAmountARS;
                    });
                } else if (isParticipantMe) {
                    projections[monthKey].items.push({
                        id: item.id,
                        description: `${item.description} (${i + 1}/${item.installments})`,
                        amount: installmentAmountARS,
                        originalAmount: installmentAmountNative,
                        currency: (item as any).currency || 'ARS',
                        type: 'pay',
                        fromTo: getMemberName(item.payerId)
                    });
                    projections[monthKey].netAmount -= installmentAmountARS;
                }
            }
        });

        const sortedProjections = Object.values(projections).sort((a, b) => a.month.localeCompare(b.month));

        const finalProjections = currentMonth
            ? sortedProjections.filter(p => p.month === currentMonth)
            : sortedProjections;

        setProjection(finalProjections);

    }, [items, currentUser.id, currentMonth]);

    const totalItemsAmount = items.reduce((sum, item) => {
        // Approximate total in ARS for summary
        const rate = (item as any).exchangeRate || 1;
        return sum + (item.totalAmount * rate);
    }, 0);

    if (loading && items.length === 0) {
        return <div className="p-8 text-center text-slate-400 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin mb-2 text-teal-400" />
            Cargando plan de cuotas...
        </div>;
    }

    return (
        <div id="installment-simulator-form" className="space-y-6 animate-in fade-in duration-500 pb-20">
            <Card className={`${themeColors.card} ${themeColors.border} border`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Calendar className={`w-5 h-5 ${themeColors.amountText}`} />
                        {editingId ? 'Editando Plan de Cuotas' : 'Simulador de Plan de Cuotas'}
                        <InfoTooltip content="Registra compras en cuotas para calcular automáticamente cuánto debe transferir cada mes quien no pagó." position="right" useIcon />
                    </h3>
                    {editingId && (
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setDescription('');
                                setAmount('');
                                setCurrency('ARS');
                                setExchangeRate('');
                                setEstimatedRate('');
                                setInstallments('1');
                                setPayerId(currentUser.id);
                                setParticipantIds([]);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 bg-red-500/10 rounded-lg transition-colors"
                        >
                            Cancelar Edición
                        </button>
                    )}
                </div>

                {/* --- REFINED FORM UI START --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Description & Plan Config (Out of the styled box for cleaner look, or inside? User screenshot shows only the Amount/Rate box. Let's keep Desc/Plan separate above.) */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción</label>
                        <input
                            type="text"
                            placeholder="Ej: Compra Supermercado"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plan</label>
                        <div className="flex gap-2">
                            <select
                                value={installments}
                                onChange={e => setInstallments(e.target.value)}
                                className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500"
                            >
                                {[1, 2, 3, 6, 9, 12, 18, 24].map(n => (
                                    <option key={n} value={n}>{n} Cuotas</option>
                                ))}
                            </select>
                            <input
                                type="month"
                                value={startMonth}
                                onChange={e => setStartMonth(e.target.value)}
                                className="w-40 bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Styled Currency/Amount Box (Matching Screenshot) */}
                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 mb-6 space-y-4">
                    <div className="flex gap-4">
                        {/* Currency Selector */}
                        <div className="w-1/3 space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Moneda</label>
                            <select
                                className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-xs font-black text-white appearance-none"
                                value={currency}
                                onChange={e => setCurrency(e.target.value)}
                            >
                                <option value="ARS">ARS</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>

                        {/* Amount Input */}
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto {currency}</label>
                            <input
                                type="number"
                                className={`w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none font-black text-lg ${currency === 'USD' ? 'text-green-400' : 'text-blue-400'}`}
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Exchange Rates and Total (Conditional) */}
                    {currency === 'USD' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            {/* Estimated Rate */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cotiz. Estimada</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={estimatedRate}
                                    onChange={e => setEstimatedRate(e.target.value)}
                                    className="w-full bg-slate-900 rounded-xl p-3 border border-white/5 focus:border-blue-500 outline-none text-sm font-bold text-slate-500"
                                />
                            </div>
                            {/* Actual Rate */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-blue-400">Cotiz. Real (Compra)</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 1215"
                                    value={exchangeRate}
                                    onChange={e => setExchangeRate(e.target.value)}
                                    className="w-full bg-slate-900 rounded-xl p-3 border border-blue-500/50 focus:border-blue-400 outline-none text-sm font-bold text-white shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                />
                            </div>

                            {/* Calculated Total */}
                            <div className="col-span-2 space-y-1 pt-2 border-t border-white/5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Calculado (ARS)</label>
                                <div className="w-full bg-slate-900/30 rounded-xl p-3 border border-white/5 font-black text-blue-400 text-xl tracking-tight">
                                    ${(parseFloat(amount || '0') * (parseFloat(exchangeRate || '0') || 0)).toLocaleString('es-AR')}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* --- REFINED FORM UI END --- */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Quién Pagó</label>
                        <select
                            value={payerId}
                            onChange={e => {
                                const newPayerId = e.target.value;
                                setPayerId(newPayerId);
                                setParticipantIds(prev => prev.filter(id => id !== newPayerId));
                            }}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            {members.map(m => (
                                <option key={m.memberId} value={m.id || m.memberId}>{getMemberName(m.id || m.memberId)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">
                            Quiénes deben pagar su parte
                            {participantIds.length > 0 && amount && (
                                <span className="ml-2 text-teal-400 font-semibold">
                                    (${(
                                        (parseFloat(amount || '0') * (currency === 'USD' ? (parseFloat(exchangeRate || '1') || 1) : 1)) / (participantIds.length * parseInt(installments || '1'))
                                    ).toLocaleString(undefined, { maximumFractionDigits: 0 })} c/u por mes)
                                </span>
                            )}
                        </label>
                        <div className="bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 max-h-40 overflow-y-auto space-y-2">
                            {members.filter(m => (m.id || m.memberId) !== payerId).map(m => (
                                <label key={m.memberId} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={participantIds.includes(m.id || m.memberId)}
                                        onChange={e => {
                                            const val = m.id || m.memberId;
                                            if (e.target.checked) setParticipantIds(prev => [...prev, val]);
                                            else setParticipantIds(prev => prev.filter(id => id !== val));
                                        }}
                                        className="w-4 h-4 rounded border-white/20 bg-slate-800 text-teal-500 focus:ring-2 focus:ring-teal-500"
                                    />
                                    <span className="text-sm text-white">{getMemberName(m.id || m.memberId)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <Button onClick={handleAddItem} disabled={submitting} className={`${editingId ? 'bg-blue-600 hover:bg-blue-700' : themeColors.primaryButton} w-full flex items-center justify-center gap-2`}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                    {editingId ? 'Guardar Cambios' : 'Agregar al Plan'}
                </Button>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-300">Proyección Mensual</h3>
                    <InfoTooltip content="Muestra el flujo de dinero mes a mes basado en las cuotas activas." position="right" useIcon />
                </div>

                {projection.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-white/5 rounded-2xl">
                        No hay cuotas registradas.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {projection.map((proj) => (
                            <Card key={proj.month} className="bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                                    <div className="bg-slate-800 p-2 rounded-lg text-slate-300 font-bold">
                                        {new Date(proj.month + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                                    </div>
                                    <div className={`text-xl font-bold ${proj.netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {proj.netAmount >= 0 ? 'Recibes' : 'Pagas'} ${Math.abs(proj.netAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {proj.items.map((item: any, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm p-3 rounded-xl bg-slate-900/30 hover:bg-slate-900/50 border border-white/5 group transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${item.type === 'receive' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <span className="text-slate-200 font-medium">{item.description}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-slate-500 text-xs text-right">
                                                    {item.type === 'receive' ? `de ${item.fromTo}` : `a ${item.fromTo}`}
                                                </span>
                                                <div className="text-right">
                                                    {/* Primary Amount (ARS) */}
                                                    <div className={`font-mono font-bold text-lg ${item.type === 'receive' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {item.type === 'receive' ? '+' : '-'}${Math.abs(item.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </div>
                                                    {/* Secondary Amount Badge (USD) */}
                                                    {item.currency === 'USD' && (
                                                        <div className="flex justify-end mt-1">
                                                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                                USD {item.originalAmount.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity p-2">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {proj.items.length > 1 && (
                                        <div className="mt-3 pt-3 border-t border-white/5 flex justify-end items-center gap-2">
                                            <span className="text-xs text-slate-400 uppercase font-bold">Neto Mes:</span>
                                            <span className={`font-bold ${proj.netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {proj.netAmount >= 0
                                                    ? `Te transfieren $${proj.netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                    : `Transfieres $${Math.abs(proj.netAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Manage Plans List - Allows deleting items */}
            {items.length > 0 && (
                <div className="mt-8 pt-8 border-t border-white/10 px-4 mb-24">
                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-slate-400" />
                        Historial de Planes (Administrar)
                    </h3>
                    <div className="space-y-3">
                        {items.map(item => (
                            <div key={item.id} className="flex justify-between items-center bg-slate-900/40 border border-white/5 p-4 rounded-xl hover:bg-slate-900/60 transition-colors">
                                <div>
                                    <div className="text-white font-medium flex items-center gap-2">
                                        {item.description}
                                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{item.installments} cuotas</span>
                                        {(() => {
                                            if (!currentMonth) return null;
                                            const [cY, cM] = currentMonth.split('-').map(Number);
                                            const [sY, sM] = item.startDate.split('-').map(Number);
                                            const startTotal = sY * 12 + (sM - 1);
                                            const endTotal = startTotal + item.installments;
                                            const currentTotal = cY * 12 + (cM - 1);

                                            if (currentTotal >= endTotal) {
                                                return <span className="text-xs bg-emerald-500 text-white font-bold px-2 py-0.5 rounded shadow-lg border border-emerald-400">Finalizado</span>;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        Total: ${item.totalAmount.toLocaleString()} • Inicio: {item.startDate}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                        <span>Pagó: <span className="text-teal-400">{getMemberName(item.payerId)}</span></span>
                                        <span>→</span>
                                        <span>Debe: <span className="text-indigo-400">{getMemberName(item.debtorId)}</span></span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {(item.createdBy === currentUser.id || item.payerId === currentUser.id) && (
                                        <button
                                            onClick={() => {
                                                // Populate form with existing data
                                                setDescription(item.description);
                                                setAmount(item.totalAmount.toString());
                                                setInstallments(item.installments.toString());
                                                setPayerId(item.payerId);
                                                setStartMonth(item.startDate);
                                                // Get participants from item
                                                const participants = item.participants || [item.debtorId];
                                                setParticipantIds(participants);
                                                setCurrency((item as any).currency || 'ARS');
                                                setExchangeRate((item as any).exchangeRate ? String((item as any).exchangeRate) : '');
                                                setEditingId(item.id);

                                                // Scroll to form (to the beginning of the component)
                                                const element = document.getElementById('installment-simulator-form');
                                                if (element) {
                                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                } else {
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }
                                            }}
                                            className="text-slate-500 hover:text-blue-400 p-2 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            title="Editar Plan"
                                        >
                                            <Pencil className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Eliminar Plan Completo"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {items.length > 0 && (
                <div className="mt-6 bg-slate-900/50 rounded-xl border border-white/10 p-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-medium">Total Acumulado en Cuotas:</span>
                        <span className={`text-2xl font-bold ${themeColors.amountText}`}>${totalItemsAmount.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
