import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Calendar as CalendarIcon,
    Clock,
    User,
    Phone,
    CheckCircle2,
    XCircle,
    Search,
    Filter,
    ArrowLeft,
    Sparkles,
} from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

interface Appointment {
    id: string;
    client_name: string;
    client_phone: string;
    appointment_at: string;
    status: string;
    notes: string | null;
    created_at: string | null;
}

const Appointment = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: apptsData, error: apptsError } = await (supabase as any)
                .from('website')
                .select('*')
                .order('appointment_at', { ascending: true });

            if (apptsError) throw apptsError;
            setAppointments(apptsData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        // Real-time subscription for website table
        const channel = supabase
            .channel('website-appointments')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'website' },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            const { error } = await (supabase as any)
                .from('website')
                .update({ status })
                .eq('id', id);

            if (error) throw error;

            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
            toast.success(status === 'confirmed' ? 'Rendez-vous confirmé' : 'Rendez-vous annulé');
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Erreur lors de la mise à jour');
        }
    };

    const filteredAppointments = appointments.filter(a => {
        const matchesSearch =
            a.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.client_phone.includes(searchQuery);

        const matchesStatus = filterStatus === 'all' || a.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <Badge className="bg-[#8A9A8A]/10 text-[#8A9A8A] border-none rounded-full px-3 text-[8px] uppercase font-black tracking-widest">Confirmé</Badge>;
            case 'denied':
                return <Badge className="bg-rose-500/10 text-rose-600 border-none rounded-full px-3 text-[8px] uppercase font-black tracking-widest">Annulé</Badge>;
            default:
                return <Badge className="bg-amber-500/10 text-amber-600 border-none rounded-full px-3 text-[8px] uppercase font-black tracking-widest">En attente</Badge>;
        }
    };

    return (
        <div className="min-h-screen bg-[#EFEBE6] text-[#2A2A2A] font-sans selection:bg-[#8A9A8A]/30 pb-10">
            {/* Mini Nav */}
            <nav className="sticky top-4 left-1/2 z-50 -translate-x-1/2 w-[92%] max-w-5xl rounded-full border border-white/20 bg-white/40 backdrop-blur-md px-4 py-2 flex items-center justify-between shadow-lg mx-auto mb-6">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full h-8 w-8 text-[#2A2A2A]"><ArrowLeft className="h-4 w-4" /></Button>
                    <span className="font-serif text-sm font-bold tracking-tight uppercase">Dashboard</span>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full sm:hidden" onClick={() => setIsSearchOpen(!isSearchOpen)}><Search className="h-4 w-4" /></Button>
                    <div className="relative hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A9A8A]/60" />
                        <Input
                            placeholder="Nom ou Tél..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-8 w-40 rounded-full border-none bg-white/50 focus-visible:ring-[#8A9A8A]/30 text-xs"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-28 h-8 rounded-full border-none bg-white/50 text-[10px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none bg-[#EFEBE6] shadow-2xl">
                            <SelectItem value="all">Tous</SelectItem>
                            <SelectItem value="scheduled">En attente</SelectItem>
                            <SelectItem value="confirmed">Confirmés</SelectItem>
                            <SelectItem value="denied">Annulés</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 animate-fade-in">
                <header className="mb-8 text-center">
                    <h1 className="font-serif text-3xl font-light">
                        Flux <span className="italic">Réservations</span>
                    </h1>
                    <div className="flex items-center justify-center gap-4 mt-4 text-[10px] font-bold text-[#8A9A8A] uppercase tracking-widest">
                        <span>Site Web</span>
                        <div className="w-1 h-1 rounded-full bg-[#8A9A8A]" />
                        <span>{appointments.length} Total</span>
                    </div>
                </header>

                {/* Small Progress Indicator */}
                {loading && (
                    <div className="flex justify-center py-10">
                        <div className="w-6 h-6 border-2 border-[#8A9A8A] border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Appointment Grid - Smaller Cards */}
                <div className="grid gap-3 sm:gap-4">
                    {filteredAppointments.map((appt) => (
                        <Card key={appt.id} className="overflow-hidden rounded-[1.8rem] border-none bg-white shadow-xl shadow-[#8A9A8A]/5">
                            <CardContent className="p-4 sm:p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-[#EFEBE6] flex items-center justify-center text-[#8A9A8A] shrink-0">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-serif text-base sm:text-lg font-bold text-[#2A2A2A] truncate">{appt.client_name}</h3>
                                                {getStatusBadge(appt.status)}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <p className="text-[10px] font-medium text-[#4A4A4A] flex items-center gap-1">
                                                    <Phone className="h-2.5 w-2.5 text-[#8A9A8A]" /> {appt.client_phone}
                                                </p>
                                                <p className="text-[10px] font-medium text-[#4A4A4A] flex items-center gap-1">
                                                    <Clock className="h-2.5 w-2.5 text-[#8A9A8A]" />
                                                    {format(parseISO(appt.appointment_at), "d MMM 'à' HH:mm", { locale: fr })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full text-blue-500 hover:bg-blue-50"
                                            onClick={() => window.open(`tel:${appt.client_phone}`)}
                                        >
                                            <Phone className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-8 w-8 rounded-full text-emerald-500 hover:bg-emerald-50", appt.status === 'confirmed' && "bg-emerald-50")}
                                            onClick={() => handleUpdateStatus(appt.id, 'confirmed')}
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-8 w-8 rounded-full text-rose-500 hover:bg-rose-50", appt.status === 'denied' && "bg-rose-50")}
                                            onClick={() => handleUpdateStatus(appt.id, 'denied')}
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {!loading && filteredAppointments.length === 0 && (
                        <div className="text-center py-16 opacity-30 italic text-sm">Fin du flux</div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Appointment;
