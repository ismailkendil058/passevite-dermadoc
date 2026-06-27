import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    LogOut, Search, MessageSquare, Calendar as CalendarIcon,
    Users, CheckCircle2, XCircle, Clock, History, Plus, Phone, Trash2, Pencil
} from 'lucide-react';
import { format, addHours, isWithinInterval, startOfDay, endOfDay, parseISO, startOfToday, endOfToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface CompletedClient {
    id: string;
    client_name: string;
    phone: string;
    client_id: string;
    state: string;
    treatment: string;
    total_amount: number;
    tranche_paid: number;
    completed_at: string;
    doctor_id: string;
    notes?: string;
}

interface Appointment {
    id: string;
    client_phone: string;
    client_name: string;
    doctor_id: string;
    appointment_at: string;
    status: 'scheduled' | 'confirmed' | 'coming' | 'denied' | 'no_answer' | 'attended';
    notes: string;
    doctor?: { name: string; initial: string };
}

interface Doctor {
    id: string;
    name: string;
    initial: string;
}

const TREATMENTS = [
    'Peeling carbonique',
    'Hydrafacial',
    'Nettoyage de peau',
    'Rehaussement de cils',
    'Browlift',
    'Extension de cils',
    'Epilation sourcils',
    'Teinture sourcils',
    'Epilation a la cire',
    'Epilation au laser',
    'Consultation'
];

const Rendezvous = () => {
    const [clients, setClients] = useState<CompletedClient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState<{ phone: string, name: string } | null>(null);
    const [selectedDoctorMobile, setSelectedDoctorMobile] = useState<string>('all');
    const [viewingPatient, setViewingPatient] = useState<{ phone: string; name: string } | null>(null);
    const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [viewingClient, setViewingClient] = useState<CompletedClient | null>(null);

    // Form state for new appointment
    const [newApptDate, setNewApptDate] = useState<Date | undefined>(new Date());
    const [newApptTime, setNewApptTime] = useState('09:00');
    const [newApptDoctor, setNewApptDoctor] = useState('');
    const [newApptNotes, setNewApptNotes] = useState('');
    const [editingApptId, setEditingApptId] = useState<string | null>(null);
    const { user, userRole, signOut } = useAuth();
    const [editingVisit, setEditingVisit] = useState<CompletedClient | null>(null);
    const [isAddVisitOpen, setIsAddVisitOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [showAddTreatment, setShowAddTreatment] = useState(false);
    const [showAddAppt, setShowAddAppt] = useState(false);
    const [isBaseInfoOpen, setIsBaseInfoOpen] = useState(false);
    const [isDeletingPatient, setIsDeletingPatient] = useState(false);
    const [filterAppointmentOnly, setFilterAppointmentOnly] = useState(false);
    const [baseInfo, setBaseInfo] = useState({ name: '', phone: '', client_id: '' });
    const [newVisitData, setNewVisitData] = useState<Partial<CompletedClient & { apptDate: Date; apptTime: string; apptDoctor: string; apptNotes: string }>>({
        client_name: '',
        phone: '',
        treatment: '',
        total_amount: 0,
        tranche_paid: 0,
        doctor_id: '',
        notes: '',
        state: 'N',
        apptDate: new Date(),
        apptTime: '09:00',
        apptDoctor: '',
        apptNotes: ''
    });

    const fetchActiveSession = async () => {
        const { data } = await supabase.from('sessions').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (data) setActiveSessionId(data.id);
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await fetchActiveSession();
            // Fetch Appointments
            const { data: apptsData } = await supabase
                .from('appointments')
                .select('*, doctor:doctors(*)')
                .order('appointment_at', { ascending: true });

            // Fetch Doctors
            const { data: docsData } = await supabase
                .from('doctors')
                .select('*');

            if (apptsData) setAppointments(apptsData as any);
            if (docsData) {
                setDoctors(docsData as any);
                if (docsData.length > 0 && window.innerWidth < 640) {
                    setSelectedDoctorMobile(docsData[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        let q = supabase
            .from('completed_clients')
            .select('*');

        if (searchQuery.trim()) {
            q = q.or(`client_name.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%`);
        }

        q = q.order('completed_at', { ascending: false });

        const { data } = await q;
        if (data) setClients(data as any);
    };

    const handleSaveVisit = async (visit: Partial<CompletedClient & { apptDate?: Date; apptTime?: string; apptDoctor?: string; apptNotes?: string }>) => {
        if (!visit.client_name || !visit.phone) {
            toast.error('Le nom et le téléphone sont obligatoires');
            return;
        }

        const isNewEntry = !editingVisit && !visit.id;

        try {
            // 1. Handle Treatment (completed_clients)
            // Always create a record for a new entry to establish the patient in the system
            if (showAddTreatment || editingVisit || isNewEntry) {
                const treatmentData: any = {
                    client_name: visit.client_name,
                    phone: visit.phone,
                    treatment: (showAddTreatment || editingVisit) && visit.treatment ? visit.treatment : 'Nouveau Patient',
                    total_amount: Number(visit.total_amount || 0),
                    tranche_paid: Number(visit.tranche_paid || 0),
                    doctor_id: visit.doctor_id || null,
                    notes: visit.notes || null,
                    completed_at: visit.completed_at || new Date().toISOString(),
                    state: visit.state || 'N',
                    receptionist_id: user?.id,
                    session_id: activeSessionId,
                    client_id: visit.client_id || `ADM-${Date.now()}`
                };

                let error;
                if (visit.id) {
                    const { error: err } = await supabase.from('completed_clients').update(treatmentData).eq('id', visit.id);
                    error = err;
                } else {
                    const { error: err } = await supabase.from('completed_clients').insert(treatmentData);
                    error = err;
                }

                if (error) throw error;
            }

            // 2. Handle Appointment
            if (showAddAppt && !visit.id) { // Only for new entries, not editing an existing visit
                if (!visit.apptDate || !visit.apptDoctor) {
                    toast.error('Veuillez remplir les détails du rendez-vous');
                    return;
                }

                const [hours, minutes] = (visit.apptTime || '09:00').split(':');
                const appointmentAt = new Date(visit.apptDate);
                appointmentAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                const appointmentData = {
                    client_phone: visit.phone,
                    client_name: visit.client_name,
                    doctor_id: visit.apptDoctor,
                    appointment_at: appointmentAt.toISOString(),
                    notes: visit.apptNotes || '',
                    status: 'scheduled'
                };

                const { error: apptErr } = await supabase.from('appointments').insert(appointmentData);
                if (apptErr) throw apptErr;
            }

            // Close modals immediately
            setIsAddVisitOpen(false);
            setEditingVisit(null);

            // Re-fetch in parallel
            fetchInitialData();
            fetchClients();

            toast.success('Enregistré avec succès');
        } catch (error) {
            console.error('Error saving visit/appt:', error);
            toast.error('Erreur lors de l\'enregistrement');
        }
    };

    const handleDeleteVisit = async (visitId: string) => {
        if (!['manager', 'admin'].includes(userRole || '')) {
            toast.error('Seul un administrateur peut supprimer une visite');
            return;
        }
        if (!window.confirm('Voulez-vous vraiment supprimer cette visite ?')) return;

        try {
            const { error } = await supabase
                .from('completed_clients')
                .delete()
                .eq('id', visitId);

            if (error) throw error;

            toast.success('Visite supprimée');
            fetchInitialData();
            fetchClients();
            if (viewingClient && viewingClient.id === visitId) {
                setViewingClient(null);
            }
        } catch (error) {
            console.error('Error deleting visit:', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    const handleUpdateBaseInfo = async () => {
        if (!baseInfo.name || !baseInfo.phone) {
            toast.error('Le nom et le téléphone sont obligatoires');
            return;
        }

        if (!viewingPatient) {
            toast.error('Informations patient d\'origine manquantes');
            return;
        }

        try {
            // Update ALL records with this client's original name and phone to maintain dossier integrity
            const { error } = await supabase
                .from('completed_clients')
                .update({
                    client_name: baseInfo.name,
                    phone: baseInfo.phone
                })
                .eq('phone', viewingPatient.phone)
                .ilike('client_name', viewingPatient.name);

            if (error) throw error;

            // Also update any appointments with the old phone and name
            await supabase
                .from('appointments')
                .update({
                    client_name: baseInfo.name,
                    client_phone: baseInfo.phone
                })
                .eq('client_phone', viewingPatient.phone)
                .ilike('client_name', viewingPatient.name);

            toast.success('Informations patient mises à jour');
            setIsBaseInfoOpen(false);

            // Update local viewing state if necessary
            if (viewingPatient) {
                setViewingPatient({ name: baseInfo.name, phone: baseInfo.phone });
            }

            fetchClients();
            fetchInitialData();
        } catch (error) {
            console.error('Error updating patient info:', error);
            toast.error('Erreur lors de la mise à jour');
        }
    };

    const handleDeletePatient = async () => {
        if (!baseInfo.phone || !baseInfo.name) {
            toast.error('Informations patient manquantes');
            return;
        }

        if (!window.confirm(`Supprimer définitivement le dossier de ${baseInfo.name} ? Cette action supprimera tout l'historique et les rendez-vous.`)) return;

        setIsDeletingPatient(true);
        try {
            // Delete from completed_clients by phone + name for maximum reliability
            const deleteHistory = supabase
                .from('completed_clients')
                .delete()
                .eq('phone', baseInfo.phone)
                .ilike('client_name', baseInfo.name);

            // Delete from appointments
            const deleteAppts = supabase
                .from('appointments')
                .delete()
                .eq('client_phone', baseInfo.phone)
                .ilike('client_name', baseInfo.name);

            const [res1, res2] = await Promise.all([deleteHistory, deleteAppts]);

            if (res1.error) throw res1.error;
            if (res2.error) throw res2.error;

            toast.success('Dossier patient supprimé');
            setIsBaseInfoOpen(false);
            setViewingPatient(null);

            // Fast refresh
            fetchClients();
            fetchInitialData();
        } catch (error) {
            console.error('Error deleting patient dossier:', error);
            toast.error('Erreur lors de la suppression');
        } finally {
            setIsDeletingPatient(false);
        }
    };

    const handleDeleteAppointment = async (id: string) => {
        if (!['manager', 'admin'].includes(userRole || '')) {
            toast.error('Seul un administrateur peut supprimer un rendez-vous');
            return;
        }
        if (!window.confirm('Voulez-vous vraiment supprimer ce rendez-vous ?')) return;

        const { error } = await supabase
            .from('appointments')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Erreur lors de la suppression');
        } else {
            setAppointments(prev => prev.filter(a => a.id !== id));
            toast.success('Rendez-vous supprimé');
        }
    };

    useEffect(() => {
        fetchInitialData();
        const channel = supabase
            .channel('appointments-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments' },
                () => {
                    fetchInitialData();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'completed_clients' },
                () => {
                    fetchInitialData();
                    fetchClients();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Fetch clients with server-side debounce for scalability
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchClients();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    // Deduplication and debt filtering logic
    const uniqueClients = useMemo(() => {
        const patientData = new Map<string, { latest: CompletedClient, totalPaid: number }>();

        clients.forEach(c => {
            const key = `${c.phone}_${c.client_name.toLowerCase().trim()}_${(c.treatment || '').toLowerCase().trim()}`;
            const existing = patientData.get(key);
            const currentPaid = c.tranche_paid || 0;

            if (!existing) {
                patientData.set(key, { latest: c, totalPaid: currentPaid });
            } else {
                // Keep the record with the most recent completion date as 'latest'
                const isNewer = new Date(c.completed_at) > new Date(existing.latest.completed_at);
                patientData.set(key, { // Fixo: ensure we set using the same key
                    latest: isNewer ? c : existing.latest,
                    totalPaid: existing.totalPaid + currentPaid
                });
            }
        });

        return Array.from(patientData.values())
            .map(d => ({ ...d.latest, totalPaid: d.totalPaid }))
            .sort((a, b) => a.client_name.localeCompare(b.client_name));
    }, [clients]);

    // Filter appointments in memory by search query
    const filteredAppointments = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return appointments;
        return appointments.filter(a =>
            (a.client_name || '').toLowerCase().includes(query) ||
            (a.client_phone || '').toLowerCase().includes(query)
        );
    }, [appointments, searchQuery]);

    // Group by patient (phone + name) to build dossier entries with multiple treatments
    const groupedPatients = useMemo(() => {
        const map = new Map<string, { name: string; phone: string; treatments: Array<{ treatment: string; latest: CompletedClient; totalPaid: number }>; latestVisitDate?: string; latestApptDate?: string }>();
        
        // 1. Group completed clients
        uniqueClients.forEach(c => {
            const key = `${c.phone}_${c.client_name.toLowerCase().trim()}`;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, {
                    name: c.client_name,
                    phone: c.phone,
                    treatments: [{ treatment: c.treatment || '—', latest: c, totalPaid: (c as any).totalPaid || 0 }],
                    latestVisitDate: c.completed_at
                });
            } else {
                existing.treatments.push({ treatment: c.treatment || '—', latest: c, totalPaid: (c as any).totalPaid || 0 });
                if (!existing.latestVisitDate || new Date(c.completed_at) > new Date(existing.latestVisitDate)) {
                    existing.latestVisitDate = c.completed_at;
                }
            }
        });

        // 2. Merge appointments
        filteredAppointments.forEach(a => {
            const key = `${a.client_phone}_${a.client_name.toLowerCase().trim()}`;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, {
                    name: a.client_name,
                    phone: a.client_phone,
                    treatments: [],
                    latestApptDate: a.appointment_at
                });
            } else {
                if (!existing.latestApptDate || new Date(a.appointment_at) > new Date(existing.latestApptDate)) {
                    existing.latestApptDate = a.appointment_at;
                }
            }
        });

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [uniqueClients, filteredAppointments]);

    const filteredClients = uniqueClients; // keep for other uses

    const parsedAppointments = useMemo(() => {
        return appointments.map(a => ({
            ...a,
            startOfDayTime: startOfDay(parseISO(a.appointment_at)).getTime()
        }));
    }, [appointments]);

    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        const next24h = addHours(now, 24);
        return parsedAppointments.filter(a => {
            const apptDate = parseISO(a.appointment_at);
            const isWithin24h = isWithinInterval(apptDate, { start: now, end: next24h });
            return isWithin24h && (a.status === 'scheduled' || a.status === 'confirmed');
        });
    }, [parsedAppointments]);

    const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);

        if (error) {
            toast.error('Erreur lors de la mise à jour');
        } else {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
            toast.success('Statut mis à jour');
        }
    };

    const handleSendSMS = (phone: string, name: string, time: string) => {
        const message = `Clinique DermaDoc : votre rendez-vous avec notre équipe est dans 24h. Merci de confirmer votre présence.`;
        window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
    };

    const handleSendWhatsApp = (phone: string, name: string, time: string) => {
        const message = `Clinique DermaDoc : votre rendez-vous avec notre équipe est dans 24h. Merci de confirmer votre présence.`;
        const normalizePhoneForWhatsApp = (p: string) => {
            let digits = (p || '').replace(/\D/g, '');
            if (!digits) return '';
            // Strip leading international 00 or +
            if (digits.startsWith('00')) digits = digits.replace(/^00/, '');
            // If it still starts with 0, assume local format and prepend Algeria country code '213'
            if (digits.startsWith('0')) {
                digits = '213' + digits.slice(1);
            }
            return digits;
        };

        const digits = normalizePhoneForWhatsApp(phone);
        if (!digits) {
            toast.error('Numéro WhatsApp invalide');
            return;
        }

        const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    };

    const handleCall = (phone: string) => {
        window.open(`tel:${phone}`, '_self');
    };

    const getStatusStyle = (status: Appointment['status']) => {
        switch (status) {
            case 'coming': return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500';
            case 'denied': return 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500';
            case 'scheduled': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'attended': return 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleScheduleAppt = async () => {
        if (!selectedClient || !newApptDate || !newApptDoctor) {
            toast.error('Veuillez remplir tous les champs');
            return;
        }

        const [hours, minutes] = newApptTime.split(':');
        const h = parseInt(hours);
        const m = parseInt(minutes);

        if (h < 8 || h > 18 || (h === 18 && m > 0)) {
            toast.error('Les horaires sont limités de 08:00 à 18:00');
            return;
        }

        const appointmentAt = new Date(newApptDate);
        appointmentAt.setHours(h, m, 0, 0);

        const appointmentData = {
            client_phone: selectedClient.phone,
            client_name: selectedClient.name,
            doctor_id: newApptDoctor,
            appointment_at: appointmentAt.toISOString(),
            notes: newApptNotes,
            status: 'scheduled' as Appointment['status']
        };

        if (editingApptId) {
            const { data, error } = await supabase
                .from('appointments')
                .update(appointmentData)
                .eq('id', editingApptId)
                .select('*, doctor:doctors(*)')
                .single();

            if (error) {
                toast.error('Erreur lors de la mise à jour du rendez-vous');
            } else {
                setAppointments(prev => prev.map(a => a.id === editingApptId ? (data as any) : a).sort((a, b) =>
                    new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()
                ));
                toast.success('Rendez-vous mis à jour');
                setIsScheduleOpen(false);
                setEditingApptId(null);
                setNewApptNotes('');
            }
        } else {
            const { data, error } = await supabase
                .from('appointments')
                .insert(appointmentData)
                .select('*, doctor:doctors(*)')
                .single();

            if (error) {
                toast.error('Erreur lors de la création du rendez-vous');
            } else {
                setAppointments(prev => [...prev, data as any].sort((a, b) =>
                    new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime()
                ));
                toast.success('Rendez-vous programmé');
                setIsScheduleOpen(false);
                setNewApptNotes('');
            }
        }
    };

    const openEditModal = (appt: Appointment) => {
        setEditingApptId(appt.id);
        setSelectedClient({ phone: appt.client_phone, name: appt.client_name });
        const date = parseISO(appt.appointment_at);
        setNewApptDate(date);
        setNewApptTime(format(date, 'HH:mm'));
        setNewApptDoctor(appt.doctor_id);
        setNewApptNotes(appt.notes || '');
        setIsScheduleOpen(true);
    };

    const getClientHistory = (phone: string, name: string, treatment: string) => {
        const history = clients.filter(c =>
            c.phone === phone &&
            c.client_name.toLowerCase().trim() === name.toLowerCase().trim() &&
            (c.treatment || '').toLowerCase().trim() === treatment.toLowerCase().trim()
        );
        const appts = appointments.filter(a => a.client_phone === phone && a.client_name.toLowerCase().trim() === name.toLowerCase().trim());
        return { history, appts };
    };

    const getPatientTreatments = (phone: string, name: string) => {
        const entries = clients.filter(c => c.phone === phone && c.client_name.toLowerCase().trim() === name.toLowerCase().trim());
        const map = new Map<string, { entries: CompletedClient[]; totalPaid: number; latestTotal: number }>();
        entries.forEach(e => {
            const key = e.treatment || '—';
            const existing = map.get(key) || { entries: [], totalPaid: 0, latestTotal: 0 };
            existing.entries.push(e);
            existing.totalPaid += e.tranche_paid || 0;
            const ts = new Date(e.completed_at).getTime();
            // keep latest total_amount
            if (!existing.latestTotal || ts > (existing.entries[0] ? new Date(existing.entries[0].completed_at).getTime() : 0)) {
                existing.latestTotal = e.total_amount || 0;
            }
            map.set(key, existing);
        });

        const treatments = Array.from(map.entries()).map(([t, v]) => ({ treatment: t, entries: v.entries.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()), totalPaid: v.totalPaid, latestTotal: v.latestTotal }));

        const apptsById = new Map<string, Appointment>();
        appointments.forEach(a => apptsById.set(a.id, a));

        const getApptsForTreatment = (treatment: string) => {
            const ids = new Set((map.get(treatment)?.entries || []).map(e => (e as any).appointment_id).filter(Boolean));
            const result: Appointment[] = [];
            ids.forEach(id => {
                const a = apptsById.get(id as string);
                if (a) result.push(a);
            });
            // fallback: also include appointments matching phone/name
            if (result.length === 0) {
                return appointments.filter(a => a.client_phone === phone && a.client_name.toLowerCase().trim() === name.toLowerCase().trim());
            }
            return result;
        };

        return { treatments, getApptsForTreatment };
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-background/80 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-primary italic">Rendez-vous</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Gestion du cabinet</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(!isSearchOpen)} className="sm:hidden h-9 w-9">
                        <Search className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = '/accueil'} className="h-9 w-9">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

            {/* Mobile Search Bar */}
            {isSearchOpen && (
                <div className="px-4 pb-4 sm:hidden animate-in slide-in-from-top-2 fade-in">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            autoFocus
                            placeholder="Rechercher patient..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20"
                        />
                    </div>
                </div>
            )}

            <main className="p-4 flex-1 space-y-6">
                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl h-12">
                        <TabsTrigger value="upcoming" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Clock className="h-4 w-4 mr-2" /> À venir
                        </TabsTrigger>
                        <TabsTrigger value="clients" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4 mr-2" /> Patients
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <CalendarIcon className="h-4 w-4 mr-2" /> Calendrier
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid gap-4">
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Prochaines 24 Heures</h2>
                            {loading ? (
                                <div className="h-32 flex items-center justify-center border rounded-xl border-dashed">
                                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                </div>
                            ) : upcomingAppointments.length === 0 ? (
                                <Card className="border-dashed shadow-none">
                                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                                        <CalendarIcon className="h-10 w-10 text-muted-foreground/20 mb-4" />
                                        <p className="text-muted-foreground font-medium">Aucun rendez-vous prévu pour les prochaines 24h</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                upcomingAppointments.map(appt => (
                                    <Card key={appt.id} className="overflow-hidden border-none shadow-premium bg-gradient-to-br from-white to-slate-50 dark:from-white/5 dark:to-transparent cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openEditModal(appt)}>
                                        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex gap-4">
                                                <div className="bg-primary/5 p-3 rounded-2xl flex flex-col items-center justify-center min-w-[70px] h-[70px]">
                                                    <span className="text-[10px] uppercase font-bold text-primary/60">{format(parseISO(appt.appointment_at), 'EEE', { locale: fr })}</span>
                                                    <span className="text-xl font-black text-primary">{format(parseISO(appt.appointment_at), 'HH:mm')}</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-lg text-foreground">{appt.client_name}</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                        {appt.doctor?.name || 'Inconnu'}
                                                    </p>
                                                    <div className="mt-2 flex gap-1.5">
                                                        <Badge variant="outline" className={`capitalize text-[10px] px-2 py-0 ${getStatusStyle(appt.status)}`}>
                                                            {appt.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSendSMS(appt.client_phone, appt.client_name, format(parseISO(appt.appointment_at), 'HH:mm'));
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span className="text-sm">SMS</span>
                                                </Button>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSendWhatsApp(appt.client_phone, appt.client_name, format(parseISO(appt.appointment_at), 'HH:mm'));
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span className="text-sm">WhatsApp</span>
                                                </Button>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCall(appt.client_phone);
                                                    }}
                                                    variant="secondary" className="flex-1 sm:flex-none h-10 gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                                                >
                                                    <Phone className="h-4 w-4" />
                                                    <span className="text-sm">Appel</span>
                                                </Button>
                                                <div className="flex gap-1 flex-1 sm:flex-none" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        onClick={() => handleUpdateStatus(appt.id, 'coming')}
                                                        size="icon" variant="outline" className="h-10 w-10 text-emerald-600 hover:text-white hover:bg-emerald-600 border-emerald-100"
                                                        title="Vient"
                                                    >
                                                        <CheckCircle2 className="h-5 w-5" />
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleUpdateStatus(appt.id, 'denied')}
                                                        size="icon" variant="outline" className="h-10 w-10 text-rose-600 hover:text-white hover:bg-rose-600 border-rose-100"
                                                        title="Refusé"
                                                    >
                                                        <XCircle className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="clients" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Rechercher un patient (nom ou téléphone)..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 h-12 rounded-xl"
                                    />
                                </div>
                                <Button
                                    variant={filterAppointmentOnly ? 'default' : 'outline'}
                                    size="sm"
                                    className={`h-10 rounded-xl text-xs gap-2 whitespace-nowrap ${filterAppointmentOnly ? 'bg-primary text-primary-foreground' : ''}`}
                                    onClick={() => setFilterAppointmentOnly(!filterAppointmentOnly)}
                                >
                                    <CalendarIcon className="h-3.5 w-3.5" /> RDV uniquement
                                </Button>
                                {['manager', 'admin', 'receptionist'].includes(userRole || '') && (
                                    <Button
                                        className="w-full sm:w-auto h-12 rounded-xl px-6 gap-2 shadow-lg shadow-primary/20"
                                        onClick={() => {
                                            setNewVisitData({
                                                client_name: '',
                                                phone: '',
                                                treatment: '',
                                                total_amount: 0,
                                                tranche_paid: 0,
                                                doctor_id: '',
                                                notes: '',
                                                state: 'N',
                                                apptDate: new Date(),
                                                apptTime: '09:00',
                                                apptDoctor: '',
                                                apptNotes: ''
                                            });
                                            setShowAddTreatment(false);
                                            setShowAddAppt(false);
                                            setIsAddVisitOpen(true);
                                        }}
                                    >
                                        <Plus className="h-5 w-5" /> Nouveau Patient
                                    </Button>
                                )}
                            </div>

                            <div className="grid gap-2">
                                {loading ? (
                                    <p className="text-center py-10 text-muted-foreground">Chargement...</p>
                                ) : (filterAppointmentOnly ? groupedPatients.filter(p => p.treatments.length === 0) : groupedPatients).length === 0 ? (
                                    <p className="text-center py-10 text-muted-foreground">{filterAppointmentOnly ? 'Aucun patient avec RDV uniquement' : 'Aucun patient trouvé'}</p>
                                ) : (
                                    (filterAppointmentOnly ? groupedPatients.filter(p => p.treatments.length === 0) : groupedPatients.filter(p => p.treatments.length > 0)).map(patient => (
                                        <Card key={`${patient.phone}_${patient.name}`} onClick={() => { setViewingPatient({ phone: patient.phone, name: patient.name }); setSelectedTreatment(null); }} className="cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="font-bold text-foreground group-hover:text-primary transition-colors">{patient.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {patient.phone}
                                                        {patient.treatments.length > 0 && (
                                                            <>
                                                                {' · '}
                                                                <span className="text-primary/70">{patient.treatments.map(t => t.treatment).slice(0, 2).join(', ')}</span>
                                                            </>
                                                        )}
                                                        {patient.treatments.length === 0 && (
                                                            <>
                                                                {' · '}
                                                                <span className="text-muted-foreground/60 italic">Rendez-vous uniquement</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                                            {patient.latestVisitDate ? 'Dernière visite' : 'Dernier RDV'}
                                                        </p>
                                                        <p className="text-xs font-semibold">
                                                            {patient.latestVisitDate 
                                                                ? format(parseISO(patient.latestVisitDate), 'dd/MM/yyyy') 
                                                                : (patient.latestApptDate 
                                                                    ? format(parseISO(patient.latestApptDate), 'dd/MM/yyyy') 
                                                                    : '—')
                                                            }
                                                        </p>
                                                    </div>
                                                    <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>

                            <Dialog open={!!viewingPatient} onOpenChange={(open) => !open && setViewingPatient(null)}>
                                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                                    {viewingPatient && (() => {
                                        const patientData = getPatientTreatments(viewingPatient.phone, viewingPatient.name);
                                        const treatments = patientData.treatments;
                                        const chosen = selectedTreatment || (treatments[0] && treatments[0].treatment) || null;
                                        const entriesForChosen = treatments.find(t => t.treatment === chosen)?.entries || [];
                                        const totalPaidForChosen = treatments.find(t => t.treatment === chosen)?.totalPaid || 0;
                                        const latestTotalForChosen = treatments.find(t => t.treatment === chosen)?.latestTotal || 0;

                                        return (
                                            <>
                                                <DialogHeader className="p-6 pb-2">
                                                    <DialogTitle className="text-2xl font-black italic text-primary">Dossier Patient</DialogTitle>
                                                </DialogHeader>

                                                <div className="p-6 pt-0 flex-1 overflow-y-auto space-y-6">
                                                    <div className="bg-primary/5 p-4 rounded-xl flex items-center justify-between">
                                                        <div>
                                                            <h3 className="text-lg font-bold">{viewingPatient.name}</h3>
                                                            <p className="text-sm font-medium text-primary">{viewingPatient.phone}</p>
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row gap-2">
                                                            <Button variant="default" size="sm" className="gap-2" onClick={() => {
                                                                setSelectedClient({ phone: viewingPatient.phone, name: viewingPatient.name });
                                                                setIsScheduleOpen(true);
                                                            }}>
                                                                <Plus className="h-4 w-4" /> Nouveau RDV
                                                            </Button>
                                                            {['manager', 'admin'].includes(userRole || '') && (
                                                                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                                                                    setBaseInfo({
                                                                        name: viewingPatient.name,
                                                                        phone: viewingPatient.phone,
                                                                        client_id: entriesForChosen[0]?.client_id || ''
                                                                    });
                                                                    setIsBaseInfoOpen(true);
                                                                }}>
                                                                    <Users className="h-4 w-4" /> Modifier Patient
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                            <History className="h-3.5 w-3.5" /> Traitements
                                                        </h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {treatments.length === 0 ? (
                                                                <div className="text-xs text-muted-foreground">Aucun traitement enregistré</div>
                                                            ) : (
                                                                treatments.map(t => (
                                                                    <Button key={t.treatment} variant={chosen === t.treatment ? 'secondary' : 'outline'} size="sm" onClick={() => setSelectedTreatment(t.treatment)}>
                                                                        <span className="mr-2">{t.treatment}</span>
                                                                        <span className="text-xs">{t.totalPaid.toLocaleString()} / {t.latestTotal.toLocaleString()} DZD</span>
                                                                    </Button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                            <History className="h-3.5 w-3.5" /> Historique des Paiements
                                                        </h4>
                                                        <div className="border rounded-xl overflow-hidden">
                                                            <Table>
                                                                <TableHeader className="bg-muted/50">
                                                                    <TableRow>
                                                                        <TableHead className="text-xs h-9">Date</TableHead>
                                                                        <TableHead className="text-xs h-9">Traitement</TableHead>
                                                                        <TableHead className="text-xs h-9">Note</TableHead>
                                                                        <TableHead className="text-xs h-9 text-right">Total</TableHead>
                                                                        <TableHead className="text-xs h-9 text-right">Payé</TableHead>
                                                                        <TableHead className="text-xs h-9 text-right uppercase font-black">Admin</TableHead>

                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {entriesForChosen.map((h: any) => (
                                                                        <TableRow key={h.id}>
                                                                            <TableCell className="text-xs py-2">{format(parseISO(h.completed_at), 'dd/MM/yy')}</TableCell>
                                                                            <TableCell className="text-xs py-2"><div>{h.treatment}</div></TableCell>
                                                                            <TableCell className="text-xs py-2 text-slate-500 max-w-[150px] truncate" title={h.notes}>{h.notes || '-'}</TableCell>
                                                                            <TableCell className="text-xs py-2 text-right font-medium">{h.total_amount?.toLocaleString()}</TableCell>
                                                                            <TableCell className="text-xs py-2 text-right text-emerald-600 font-bold">{h.tranche_paid?.toLocaleString()}</TableCell>
                                                                            {['manager', 'admin'].includes(userRole || '') && (
                                                                                <TableCell className="text-xs py-2 text-right">
                                                                                    <div className="flex justify-end gap-1">
                                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:bg-blue-50" onClick={() => setEditingVisit(h)}>
                                                                                            <Pencil className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteVisit(h.id)}>
                                                                                            <XCircle className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    </div>
                                                                                </TableCell>
                                                                            )}
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>

                                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-emerald-600">Total payé pour ce traitement</p>
                                                            <p className="text-2xl font-black text-emerald-700">{totalPaidForChosen.toLocaleString()} DZD</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] uppercase font-bold text-emerald-600">Montant total</p>
                                                            <p className="text-lg font-bold text-emerald-800">{latestTotalForChosen.toLocaleString()} DZD</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                            <CalendarIcon className="h-3.5 w-3.5" /> Historique des Rendez-vous
                                                        </h4>
                                                        <div className="space-y-2">
                                                            {patientData.getApptsForTreatment(chosen || '').length === 0 ? (
                                                                <p className="text-sm text-center py-4 bg-muted/20 rounded-xl text-muted-foreground">Aucun historique de rendez-vous</p>
                                                            ) : (
                                                                patientData.getApptsForTreatment(chosen || '').map(a => (
                                                                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border text-sm">
                                                                        <div>
                                                                            <p className="font-semibold">{format(parseISO(a.appointment_at), 'PPp', { locale: fr })}</p>
                                                                            <p className="text-xs text-muted-foreground">Dr. {a.doctor?.name || '...'}</p>
                                                                        </div>
                                                                        <Badge variant="outline" className={`text-[10px] capitalize ${getStatusStyle(a.status)}`}>{a.status}</Badge>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isAddVisitOpen || !!editingVisit} onOpenChange={(open) => { if (!open) { setIsAddVisitOpen(false); setEditingVisit(null); } }}>
                                <DialogContent className="max-w-md w-[95vw] rounded-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl">
                                    <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/10 bg-white z-10">
                                        <DialogTitle className="text-xl font-bold italic text-primary">
                                            {editingVisit ? 'Modifier la Visite' : 'Ajouter un Patient / Visite'}
                                        </DialogTitle>
                                        <DialogDescription>Remplissez les détails médicaux et financiers du patient.</DialogDescription>
                                    </DialogHeader>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-6 overscroll-contain">
                                        {editingVisit ? (
                                            <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Visite de</p>
                                                <p className="text-sm font-black text-primary leading-tight">{editingVisit.client_name}</p>
                                                <p className="text-[11px] text-muted-foreground">{editingVisit.phone}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Nom du Patient</label>
                                                    <Input
                                                        placeholder="Nom complet"
                                                        value={newVisitData.client_name}
                                                        onChange={e => setNewVisitData({ ...newVisitData, client_name: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Téléphone</label>
                                                    <Input
                                                        placeholder="05XX XX XX XX"
                                                        value={newVisitData.phone}
                                                        onChange={e => setNewVisitData({ ...newVisitData, phone: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {!editingVisit && (
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={showAddTreatment ? "default" : "outline"}
                                                    size="sm"
                                                    className={`flex-1 rounded-xl h-10 gap-2 ${showAddTreatment ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
                                                    onClick={() => setShowAddTreatment(!showAddTreatment)}
                                                >
                                                    <Plus className={`h-4 w-4 transition-transform ${showAddTreatment ? 'rotate-45' : ''}`} />
                                                    Traitement
                                                </Button>
                                                <Button
                                                    variant={showAddAppt ? "default" : "outline"}
                                                    size="sm"
                                                    className={`flex-1 rounded-xl h-10 gap-2 ${showAddAppt ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}
                                                    onClick={() => setShowAddAppt(!showAddAppt)}
                                                >
                                                    <CalendarIcon className="h-4 w-4" />
                                                    Rendez-vous
                                                </Button>
                                            </div>
                                        )}

                                        {(showAddTreatment || editingVisit) && (
                                            <div className="space-y-4 p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 animate-in fade-in slide-in-from-top-2">
                                                <h4 className="text-[10px] uppercase font-black text-primary tracking-widest flex items-center gap-2">
                                                    <Plus className="h-3 w-3" /> Détails du Traitement
                                                </h4>
                                                <div className="space-y-2 relative">
                                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Traitement</label>
                                                    <Input
                                                        placeholder="Soin pratiqué"
                                                        value={(editingVisit || newVisitData).treatment}
                                                        onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, treatment: e.target.value }) : setNewVisitData({ ...newVisitData, treatment: e.target.value })}
                                                    />
                                                    {((editingVisit || newVisitData).treatment && (editingVisit || newVisitData).treatment.length > 0) && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {TREATMENTS.filter(t =>
                                                                t.toLowerCase().includes(((editingVisit || newVisitData).treatment || '').toLowerCase()) &&
                                                                t.toLowerCase() !== ((editingVisit || newVisitData).treatment || '').toLowerCase()
                                                            ).slice(0, 5).map(suggestion => (
                                                                <Button
                                                                    key={suggestion}
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    className="h-7 text-[10px] px-2 bg-primary/5 hover:bg-primary/10 text-primary border-primary/10 font-bold uppercase tracking-tighter"
                                                                    onClick={() => editingVisit
                                                                        ? setEditingVisit({ ...editingVisit, treatment: suggestion })
                                                                        : setNewVisitData({ ...newVisitData, treatment: suggestion })
                                                                    }
                                                                >
                                                                    {suggestion}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-black text-muted-foreground">Prix Total</label>
                                                        <Input
                                                            type="number"
                                                            value={(editingVisit || newVisitData).total_amount}
                                                            onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, total_amount: Number(e.target.value) }) : setNewVisitData({ ...newVisitData, total_amount: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-black text-muted-foreground">Versé</label>
                                                        <Input
                                                            type="number"
                                                            value={(editingVisit || newVisitData).tranche_paid}
                                                            onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, tranche_paid: Number(e.target.value) }) : setNewVisitData({ ...newVisitData, tranche_paid: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Médecin</label>
                                                    <Select
                                                        value={(editingVisit || newVisitData).doctor_id}
                                                        onValueChange={val => editingVisit ? setEditingVisit({ ...editingVisit, doctor_id: val }) : setNewVisitData({ ...newVisitData, doctor_id: val })}
                                                    >
                                                        <SelectTrigger className="rounded-xl h-11">
                                                            <SelectValue placeholder="Choisir un médecin" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {doctors.map(d => (
                                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}

                                        {showAddAppt && !editingVisit && (
                                            <div className="space-y-4 p-4 rounded-2xl bg-blue-50/50 border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                                <h4 className="text-[10px] uppercase font-black text-blue-600 tracking-widest flex items-center gap-2">
                                                    <CalendarIcon className="h-3 w-3" /> Détails du Rendez-vous
                                                </h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-black text-muted-foreground">Date</label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className="w-full justify-start text-left font-normal h-11 rounded-xl px-3 text-xs">
                                                                    {newVisitData.apptDate ? format(newVisitData.apptDate, 'dd/MM/yy', { locale: fr }) : <span>Date...</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
                                                                <Calendar mode="single" selected={newVisitData.apptDate} onSelect={(d) => setNewVisitData({ ...newVisitData, apptDate: d || new Date() })} locale={fr} />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] uppercase font-black text-muted-foreground">Heure</label>
                                                        <Input type="time" value={newVisitData.apptTime} onChange={e => setNewVisitData({ ...newVisitData, apptTime: e.target.value })} className="h-11 rounded-xl text-xs px-3" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Equipe</label>
                                                    <Select
                                                        value={newVisitData.apptDoctor}
                                                        onValueChange={val => setNewVisitData({ ...newVisitData, apptDoctor: val })}
                                                    >
                                                        <SelectTrigger className="rounded-xl h-11 px-3 text-xs">
                                                            <SelectValue placeholder="Choisir l'équipe" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {doctors.map(d => (
                                                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-black text-muted-foreground">Notes RDV</label>
                                                    <Input
                                                        placeholder="Motif..."
                                                        value={newVisitData.apptNotes}
                                                        onChange={e => setNewVisitData({ ...newVisitData, apptNotes: e.target.value })}
                                                        className="h-11 rounded-xl px-3 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Notes Générales</label>
                                            <Input
                                                placeholder="Notes facultatives..."
                                                value={(editingVisit || newVisitData).notes || ''}
                                                onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, notes: e.target.value }) : setNewVisitData({ ...newVisitData, notes: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <DialogFooter className="p-6 pt-4 shrink-0 border-t border-border/10 bg-white z-10">
                                        <Button
                                            className="w-full h-12 rounded-xl text-md font-bold shadow-premium"
                                            onClick={() => handleSaveVisit(editingVisit || newVisitData)}
                                        >
                                            Enregistrer
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </TabsContent>

                    <TabsContent value="calendar" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Date Selector & Summary - Above on Mobile, Right on Desktop */}
                            <div className="w-full lg:w-[300px] space-y-6 lg:order-2 shrink-0">
                                <Card className="border-none shadow-premium overflow-hidden">
                                    <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-bold truncate">Sélecteur de Date</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-2 flex justify-center">
                                        <Calendar
                                            mode="single"
                                            selected={newApptDate}
                                            onSelect={setNewApptDate}
                                            className="rounded-xl border-none"
                                            locale={fr}
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-premium bg-primary text-primary-foreground p-5 rounded-2xl">
                                    <h4 className="font-black italic text-lg mb-2">Résumé du jour</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-primary-foreground/80">
                                            <span className="text-sm">Total RDV</span>
                                            <span className="text-xl font-black">
                                                {parsedAppointments.filter(a => a.startOfDayTime === startOfDay(newApptDate || new Date()).getTime()).length}
                                            </span>
                                        </div>
                                        <div className="h-px bg-white/20" />
                                        <p className="text-[10px] uppercase font-bold text-white/60 tracking-widest">Aujourd'hui {format(new Date(), 'PP', { locale: fr })}</p>
                                    </div>
                                </Card>
                            </div>

                            {/* Main Calendar View */}
                            <Card className="flex-1 border-none shadow-premium overflow-hidden lg:order-1 min-w-0">
                                <CardContent className="p-0">
                                    <div className="p-6 border-b bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div>
                                            <h3 className="font-black italic text-xl text-primary">Vue Equipe</h3>
                                            <p className="text-xs text-muted-foreground">Gestion d'agenda globale</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="h-9 px-3 text-xs" onClick={() => setNewApptDate(new Date())}>Aujourd'hui</Button>
                                            <Button className="h-9 px-3 text-xs gap-2" onClick={() => {
                                                setSelectedClient(null);
                                                setIsScheduleOpen(true);
                                            }}>
                                                <Plus className="h-4 w-4" /> Nouveau RDV
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Mobile Doctor Switcher (Pills) */}
                                    <div className="px-6 pb-4 sm:hidden flex overflow-scroll no-scrollbar gap-2">
                                        {doctors.map(d => (
                                            <button
                                                key={d.id}
                                                onClick={() => setSelectedDoctorMobile(d.id)}
                                                className={`
                                                    px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap
                                                    ${selectedDoctorMobile === d.id
                                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                                                `}
                                            >
                                                {d.name}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-0 sm:p-2">
                                        <ScrollArea className="h-[400px] sm:h-[350px] px-2 sm:px-4">
                                            <div className="relative pb-4">
                                                {/* Doctor Columns */}
                                                <div className={`flex flex-wrap gap-4 ${selectedDoctorMobile === 'all' ? 'w-full' : ''}`}>
                                                    {doctors
                                                        .filter(d => selectedDoctorMobile === 'all' || d.id === selectedDoctorMobile)
                                                        .map(doctor => (
                                                            <div key={doctor.id} className="rounded-2xl bg-muted/5 border border-primary/5 overflow-hidden group/col flex-1 min-w-[250px]">
                                                                {/* Column Sticky Header */}
                                                                <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md p-3 border-b border-primary/5 text-center group-hover/col:bg-primary/5 transition-colors">
                                                                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-0.5 opacity-60">Cabinet</p>
                                                                    <p className="font-black text-sm text-foreground italic flex items-center justify-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                                        {doctor.name}
                                                                    </p>
                                                                </div>

                                                                {/* Appointments for this doctor */}
                                                                <div className="flex flex-wrap gap-2 p-3">
                                                                    {(() => {
                                                                        const dayStart = startOfDay(newApptDate || new Date()).getTime();
                                                                        const filteredAppts = parsedAppointments.filter(a =>
                                                                            a.status !== 'denied' &&
                                                                            a.doctor_id === doctor.id &&
                                                                            a.startOfDayTime === dayStart
                                                                        );

                                                                        if (filteredAppts.length === 0) {
                                                                            return <p className="text-xs text-muted-foreground italic">Aucun RDV</p>;
                                                                        }

                                                                        return filteredAppts.map(appt => (
                                                                            <div
                                                                                key={appt.id}
                                                                                className={`
                                                                                    p-2 rounded-xl border-l-[4px] 
                                                                                    shadow-sm transition-all duration-300 
                                                                                    hover:scale-[1.02] active:scale-95 cursor-pointer group
                                                                                    bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-primary/5
                                                                                    flex-1 min-w-[120px]
                                                                                    ${appt.status === 'coming' ? 'border-l-emerald-500 shadow-emerald-500/10' :
                                                                                        appt.status === 'denied' ? 'border-l-rose-500 shadow-rose-500/10' :
                                                                                            appt.status === 'attended' ? 'border-l-blue-500 shadow-blue-500/10 opacity-75' :
                                                                                                'border-l-primary shadow-primary/10'}
                                                                                `}
                                                                                onClick={() => openEditModal(appt)}
                                                                            >
                                                                                <div className="flex justify-between items-start mb-0.5">
                                                                                    <div className={`w-1.5 h-1.5 rounded-full ${appt.status === 'coming' ? 'bg-emerald-500 animate-pulse' : 'bg-primary/20'}`} />
                                                                                </div>
                                                                                <p className="text-xs font-black text-foreground truncate uppercase tracking-tight">
                                                                                    {appt.client_name}
                                                                                </p>
                                                                                <p className="text-[8px] text-muted-foreground font-bold mt-0.5 truncate flex items-center gap-1">
                                                                                    <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                                                                                    {appt.notes || 'Sans note'}
                                                                                </p>
                                                                            </div>
                                                                        ));
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>

            {/* Global Scheduling Modal */}
            <Dialog open={isScheduleOpen} onOpenChange={(open) => {
                setIsScheduleOpen(open);
                if (!open) {
                    setEditingApptId(null);
                    setNewApptNotes('');
                }
            }}>
                <DialogContent className="sm:rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold italic">
                            {editingApptId ? 'Modifier le Rendez-vous' : 'Programmer un Rendez-vous'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {!selectedClient && (
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Rechercher</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Nom ou téléphone..."
                                        className="pl-10 h-11 rounded-xl"
                                        onChange={(e) => {
                                            const found = uniqueClients.find(c => c.client_name.toLowerCase() === e.target.value.toLowerCase() || c.phone === e.target.value);
                                            if (found) setSelectedClient({ phone: found.phone, name: found.client_name });
                                        }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">Sélectionnez un patient existant en tapant son nom exact ou son numéro.</p>
                            </div>
                        )}

                        {selectedClient && (
                            <div className="bg-muted/30 p-3 rounded-xl border border-dashed text-center relative group">
                                <Button
                                    variant="ghost" size="icon"
                                    className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setSelectedClient(null)}
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                                <p className="text-xs text-muted-foreground uppercase font-bold">Patient</p>
                                <p className="text-lg font-black text-primary">{selectedClient.name}</p>
                                <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Date</label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-11 rounded-xl">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {newApptDate ? format(newApptDate, 'PP', { locale: fr }) : <span>Choisir...</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
                                        <Calendar mode="single" selected={newApptDate} onSelect={(d) => { setNewApptDate(d); }} locale={fr} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-muted-foreground">Heure</label>
                                <Input type="time" min="08:00" max="18:00" value={newApptTime} onChange={(e) => setNewApptTime(e.target.value)} className="h-11 rounded-xl" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground">Equipe</label>
                            <Select value={newApptDoctor} onValueChange={setNewApptDoctor}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Choisir l'équipe" /></SelectTrigger>
                                <SelectContent>
                                    {doctors.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground">Notes</label>
                            <Input placeholder="Motif du rendez-vous..." value={newApptNotes} onChange={(e) => setNewApptNotes(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsScheduleOpen(false)} className="rounded-xl h-11 flex-1">Annuler</Button>
                        <Button onClick={handleScheduleAppt} className="rounded-xl h-11 flex-1 bg-primary">
                            {editingApptId ? 'Enregistrer' : 'Confirmer'}
                        </Button>
                        {editingApptId && ['manager', 'admin'].includes(userRole || '') && (
                            <Button variant="destructive" onClick={() => handleDeleteAppointment(editingApptId)} className="rounded-xl h-11 px-3">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBaseInfoOpen} onOpenChange={setIsBaseInfoOpen}>
                <DialogContent className="max-w-md w-[95vw] rounded-2xl p-6 space-y-6">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold italic text-primary">Modifier Identité Patient</DialogTitle>
                        <DialogDescription>Mettre à jour le nom et le numéro de téléphone pour tout le dossier.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-muted-foreground">Nom Complet</label>
                            <Input
                                value={baseInfo.name}
                                onChange={e => setBaseInfo({ ...baseInfo, name: e.target.value })}
                                placeholder="Nom du patient"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-muted-foreground">Téléphone</label>
                            <Input
                                value={baseInfo.phone}
                                onChange={e => setBaseInfo({ ...baseInfo, phone: e.target.value })}
                                placeholder="05XX XX XX XX"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:flex-row flex-col">
                        <Button className="flex-1 h-11 rounded-xl font-bold order-1 sm:order-2" onClick={handleUpdateBaseInfo}>Enregistrer les modifications</Button>
                        {['manager', 'admin'].includes(userRole || '') && (
                            <Button
                                variant="destructive"
                                className="sm:w-11 h-11 rounded-xl order-2 sm:order-1"
                                onClick={handleDeletePatient}
                                disabled={isDeletingPatient}
                            >
                                {isDeletingPatient ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                ) : (
                                    <Trash2 className="h-4 w-4" />
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <footer className="p-4 border-t bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">&copy; PasseVite - Gestion Holistique des Soins</p>
            </footer>
        </div>
    );
};

export default Rendezvous;
