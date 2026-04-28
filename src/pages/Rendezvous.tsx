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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    LogOut, Search, MessageSquare, Calendar as CalendarIcon,
    Users, CheckCircle2, XCircle, Clock, History, Plus, Phone, Trash2
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
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [newVisitData, setNewVisitData] = useState<Partial<CompletedClient>>({
        client_name: '',
        phone: '',
        treatment: '',
        total_amount: 0,
        tranche_paid: 0,
        doctor_id: '',
        notes: '',
        state: 'N'
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

    const handleSaveVisit = async (visit: Partial<CompletedClient>) => {
        if (!visit.client_name || !visit.phone || !visit.treatment || !visit.total_amount) {
            toast.error('Veuillez remplir les champs obligatoires');
            return;
        }

        const dataToSave: any = {
            client_name: visit.client_name,
            phone: visit.phone,
            treatment: visit.treatment,
            total_amount: Number(visit.total_amount),
            tranche_paid: Number(visit.tranche_paid || 0),
            doctor_id: visit.doctor_id || null,
            notes: visit.notes || null,
            completed_at: visit.completed_at || new Date().toISOString(),
            state: visit.state || 'N',
            receptionist_id: user?.id,
            session_id: activeSessionId,
            client_id: visit.client_id || `ADM-${Date.now()}`
        };

        try {
            let error;
            if (visit.id) {
                const { error: err } = await supabase.from('completed_clients').update(dataToSave).eq('id', visit.id);
                error = err;
            } else {
                const { error: err } = await supabase.from('completed_clients').insert(dataToSave);
                error = err;
            }

            if (error) throw error;

            toast.success('Enregistré avec succès');
            setIsAddVisitOpen(false);
            setEditingVisit(null);
            fetchInitialData();
        } catch (error) {
            console.error('Error saving visit:', error);
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
            if (viewingClient && viewingClient.id === visitId) {
                setViewingClient(null);
            }
        } catch (error) {
            console.error('Error deleting visit:', error);
            toast.error('Erreur lors de la suppression');
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Fetch clients with server-side debounce for scalability
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            let q = supabase
                .from('completed_clients')
                .select('*');

            if (searchQuery.trim()) {
                q = q.or(`client_name.ilike.%${searchQuery.trim()}%,phone.ilike.%${searchQuery.trim()}%`);
            }

            q = q.order('completed_at', { ascending: false }).limit(200);

            const { data } = await q;
            if (data) setClients(data as any);
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

    // Use uniqueClients directly because sorting and filtering is handled server-side now
    const filteredClients = uniqueClients;

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
        const message = `We are PasseVite clinic. Your rendezvous with our equipe is in 24H. Please confirm if you will attend.`;
        window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank');
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
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = '/accueil'} className="h-9 w-9">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>

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
                                {['manager', 'admin'].includes(userRole || '') && (
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
                                                state: 'N'
                                            });
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
                                ) : filteredClients.length === 0 ? (
                                    <p className="text-center py-10 text-muted-foreground">Aucun patient trouvé</p>
                                ) : (
                                    filteredClients.map(client => (
                                        <Card key={`${client.phone}_${client.client_name}_${client.treatment}`} onClick={() => setViewingClient(client)} className="cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="font-bold text-foreground group-hover:text-primary transition-colors">{client.client_name}</p>
                                                    <p className="text-xs text-muted-foreground">{client.phone} · <span className="text-primary/70">{client.treatment}</span></p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-[10px] text-muted-foreground uppercase font-medium">Dernière visite</p>
                                                        <p className="text-xs font-semibold">{format(parseISO(client.completed_at), 'dd/MM/yyyy')}</p>
                                                    </div>
                                                    <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>

                            <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
                                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                                    {viewingClient && (
                                        <>
                                            <DialogHeader className="p-6 pb-2">
                                                <DialogTitle className="text-2xl font-black italic text-primary">Dossier Patient</DialogTitle>
                                            </DialogHeader>

                                            <div className="p-6 pt-0 flex-1 overflow-y-auto space-y-6">
                                                <div className="bg-primary/5 p-4 rounded-xl flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-lg font-bold">{viewingClient.client_name}</h3>
                                                        <p className="text-sm font-medium text-primary">{viewingClient.phone}</p>
                                                    </div>
                                                    <Button variant="default" className="gap-2" onClick={() => {
                                                        setSelectedClient({ phone: viewingClient.phone, name: viewingClient.client_name });
                                                        setIsScheduleOpen(true);
                                                    }}>
                                                        <Plus className="h-4 w-4" /> Nouveau RDV
                                                    </Button>
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
                                                                    {['manager', 'admin'].includes(userRole || '') && <TableHead className="text-xs h-9 text-right uppercase font-black">Actions</TableHead>}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {getClientHistory(viewingClient.phone, viewingClient.client_name, viewingClient.treatment).history.map((h: any) => (
                                                                    <TableRow key={h.id}>
                                                                        <TableCell className="text-xs py-2">{format(parseISO(h.completed_at), 'dd/MM/yy')}</TableCell>
                                                                        <TableCell className="text-xs py-2">
                                                                            <div>{h.treatment}</div>
                                                                        </TableCell>
                                                                        <TableCell className="text-xs py-2 text-slate-500 max-w-[150px] truncate" title={h.notes}>{h.notes || '-'}</TableCell>
                                                                        <TableCell className="text-xs py-2 text-right font-medium">{h.total_amount?.toLocaleString()}</TableCell>
                                                                        <TableCell className="text-xs py-2 text-right text-emerald-600 font-bold">{h.tranche_paid?.toLocaleString()}</TableCell>
                                                                        {['manager', 'admin'].includes(userRole || '') && (
                                                                            <TableCell className="text-xs py-2 text-right">
                                                                                <div className="flex justify-end gap-1">
                                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:bg-blue-50" onClick={() => setEditingVisit(h)}>
                                                                                        <Plus className="h-3.5 w-3.5 rotate-45" /> {/* Use Plus rotated for edit or History icon */}
                                                                                        <Users className="h-3.5 w-3.5" />
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
                                                        <p className="text-2xl font-black text-emerald-700">
                                                            {(viewingClient as any).totalPaid?.toLocaleString()} DZD
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase font-bold text-emerald-600">Montant total</p>
                                                        <p className="text-lg font-bold text-emerald-800">{viewingClient.total_amount?.toLocaleString()} DZD</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                        <CalendarIcon className="h-3.5 w-3.5" /> Historique des Rendez-vous
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {getClientHistory(viewingClient.phone, viewingClient.client_name, viewingClient.treatment).appts.length === 0 ? (
                                                            <p className="text-sm text-center py-4 bg-muted/20 rounded-xl text-muted-foreground">Aucun historique de rendez-vous</p>
                                                        ) : (
                                                            getClientHistory(viewingClient.phone, viewingClient.client_name, viewingClient.treatment).appts.map(a => (
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
                                    )}
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isAddVisitOpen || !!editingVisit} onOpenChange={(open) => { if (!open) { setIsAddVisitOpen(false); setEditingVisit(null); } }}>
                                <DialogContent className="max-w-md rounded-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold italic text-primary">
                                            {editingVisit ? 'Modifier la Visite' : 'Ajouter un Patient / Visite'}
                                        </DialogTitle>
                                        <DialogDescription>Remplissez les détails médicaux et financiers du patient.</DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Nom du Patient</label>
                                            <Input
                                                placeholder="Nom complet"
                                                value={(editingVisit || newVisitData).client_name}
                                                onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, client_name: e.target.value }) : setNewVisitData({ ...newVisitData, client_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Téléphone</label>
                                            <Input
                                                placeholder="05XX XX XX XX"
                                                value={(editingVisit || newVisitData).phone}
                                                onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, phone: e.target.value }) : setNewVisitData({ ...newVisitData, phone: e.target.value })}
                                            />
                                        </div>
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
                                                <label className="text-[10px] uppercase font-black text-muted-foreground">Prix Total (DZD)</label>
                                                <Input
                                                    type="number"
                                                    value={(editingVisit || newVisitData).total_amount}
                                                    onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, total_amount: Number(e.target.value) }) : setNewVisitData({ ...newVisitData, total_amount: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase font-black text-muted-foreground">Versé (DZD)</label>
                                                <Input
                                                    type="number"
                                                    value={(editingVisit || newVisitData).tranche_paid}
                                                    onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, tranche_paid: Number(e.target.value) }) : setNewVisitData({ ...newVisitData, tranche_paid: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Equipe / Médecin</label>
                                            <Select
                                                value={(editingVisit || newVisitData).doctor_id}
                                                onValueChange={val => editingVisit ? setEditingVisit({ ...editingVisit, doctor_id: val }) : setNewVisitData({ ...newVisitData, doctor_id: val })}
                                            >
                                                <SelectTrigger className="rounded-xl">
                                                    <SelectValue placeholder="Choisir un médecin" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {doctors.map(d => (
                                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase font-black text-muted-foreground">Notes</label>
                                            <Input
                                                placeholder="Notes facultatives..."
                                                value={(editingVisit || newVisitData).notes || ''}
                                                onChange={e => editingVisit ? setEditingVisit({ ...editingVisit, notes: e.target.value }) : setNewVisitData({ ...newVisitData, notes: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            className="w-full h-12 rounded-xl"
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
                                        <ScrollArea className="h-[650px] sm:h-[600px] px-2 sm:px-4">
                                            <div className="relative min-h-[1050px] min-w-0">

                                                {/* Time Background Grid Lines */}
                                                <div className="absolute inset-0 pt-10 pointer-events-none">
                                                    {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((t, idx) => (
                                                        <div
                                                            key={t}
                                                            className="absolute left-0 w-full border-t border-muted/30 flex items-start"
                                                            style={{ top: `${idx * 80 + 50}px` }}
                                                        >
                                                            <span className="text-[9px] font-black text-muted-foreground/30 -mt-2.5 bg-background pr-2 z-10 uppercase tracking-tighter">
                                                                {t}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Current Time Indicator */}
                                                {newApptDate && format(newApptDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                                                    <div
                                                        className="absolute left-0 right-0 border-t-2 border-rose-500/50 z-30 pointer-events-none flex items-center"
                                                        style={{
                                                            top: `${(new Date().getHours() - 8) * 80 + (new Date().getMinutes() / 60) * 80 + 50}px`,
                                                            transition: 'top 60s linear'
                                                        }}
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                                        <div className="ml-2 px-1.5 py-0.5 rounded bg-rose-500 text-[8px] font-black text-white uppercase tracking-widest shadow-lg">Maintenant</div>
                                                    </div>
                                                )}

                                                {/* Doctor Columns */}
                                                <div className={`ml-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-full ${selectedDoctorMobile === 'all' ? 'min-w-[700px] sm:min-w-0' : ''}`}>
                                                    {doctors
                                                        .filter(d => selectedDoctorMobile === 'all' || d.id === selectedDoctorMobile)
                                                        .map(doctor => (
                                                            <div key={doctor.id} className="relative min-h-[1000px] rounded-2xl bg-muted/5 border border-primary/5 overflow-hidden group/col">
                                                                {/* Column Sticky Header */}
                                                                <div className="sticky top-0 z-10 bg-white/80 dark:bg-black/40 backdrop-blur-md p-3 border-b border-primary/5 text-center group-hover/col:bg-primary/5 transition-colors">
                                                                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-0.5 opacity-60">Cabinet</p>
                                                                    <p className="font-black text-sm text-foreground italic flex items-center justify-center gap-2">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                                        {doctor.name}
                                                                    </p>
                                                                </div>

                                                                {/* Appointments for this doctor */}
                                                                <div className="relative h-full pt-10">
                                                                    {parsedAppointments
                                                                        .filter(a => a.status !== 'denied' && a.doctor_id === doctor.id && a.startOfDayTime === startOfDay(newApptDate || new Date()).getTime())
                                                                        .map(appt => {
                                                                            const date = parseISO(appt.appointment_at);
                                                                            const hours = date.getHours();
                                                                            const minutes = date.getMinutes();
                                                                            const offset = (hours - 8) * 80 + (minutes / 60) * 80;

                                                                            return (
                                                                                <div
                                                                                    key={appt.id}
                                                                                    className={`
                                                                                        absolute left-2 right-2 p-3 rounded-2xl border-l-[6px] 
                                                                                        shadow-xl shadow-primary/5 transition-all duration-300 
                                                                                        hover:scale-[1.02] active:scale-95 z-20 cursor-pointer group
                                                                                        bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-primary/5
                                                                                        ${appt.status === 'coming' ? 'border-l-emerald-500 shadow-emerald-500/10' :
                                                                                            appt.status === 'denied' ? 'border-l-rose-500 shadow-rose-500/10' :
                                                                                                appt.status === 'attended' ? 'border-l-blue-500 shadow-blue-500/10 opacity-75' :
                                                                                                    'border-l-primary shadow-primary/10'}
                                                                                    `}
                                                                                    style={{ top: `${offset}px`, height: '75px' }}
                                                                                    onClick={() => openEditModal(appt)}
                                                                                >
                                                                                    <div className="flex justify-between items-start mb-1">
                                                                                        <span className={`text-[11px] font-black tracking-tighter italic ${appt.status === 'coming' ? 'text-emerald-600' : appt.status === 'denied' ? 'text-rose-600' : 'text-primary'}`}>
                                                                                            {format(date, 'HH:mm')}
                                                                                        </span>
                                                                                        <div className={`w-1.5 h-1.5 rounded-full ${appt.status === 'coming' ? 'bg-emerald-500 animate-pulse' : 'bg-primary/20'}`} />
                                                                                    </div>
                                                                                    <p className="text-xs font-black text-foreground truncate uppercase tracking-tight">
                                                                                        {appt.client_name}
                                                                                    </p>
                                                                                    <p className="text-[9px] text-muted-foreground font-bold mt-0.5 truncate flex items-center gap-1">
                                                                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                                                        {appt.notes || 'Sans note'}
                                                                                    </p>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    }
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
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-11 rounded-xl">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {newApptDate ? format(newApptDate, 'PP', { locale: fr }) : <span>Choisir...</span>}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="p-0 border-none shadow-none max-w-fit">
                                        <Calendar mode="single" selected={newApptDate} onSelect={(d) => { setNewApptDate(d); }} locale={fr} />
                                    </DialogContent>
                                </Dialog>
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

            <footer className="p-4 border-t bg-muted/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">&copy; PasseVite - Gestion Holistique des Soins</p>
            </footer>
        </div>
    );
};

export default Rendezvous;
