import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueue, QueueEntry } from '@/hooks/useQueue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Phone, Plus, LogOut, ChevronRight, ChevronLeft, Users, Clock, CheckCircle, XCircle, MessageCircle, Pencil, Trash2, UserCheck, Calendar as CalendarIcon, DollarSign, ShoppingCart, Sparkles, Lock, Unlock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';


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


const QueueItem = React.memo(({ entry, index, onEdit, onDelete, onNext }: { entry: QueueEntry; index: number; onEdit: (e: QueueEntry) => void; onDelete: (id: string) => void; onNext: (e: QueueEntry) => void }) => {
  const stateColors = {
    U: 'bg-destructive text-destructive-foreground',
    N: 'bg-primary text-primary-foreground',
    R: 'bg-foreground text-background',
  };
  const stateLabels = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow gpu">
      <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <span className="text-xs sm:text-sm font-bold text-primary">{index + 1}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm sm:text-base text-foreground">{entry.client_id}</span>
              {entry.patient_name && (
                <span className="text-sm font-medium text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
                  · {entry.patient_name}
                </span>
              )}
              <Badge variant="outline" className={`${stateColors[entry.state]} text-xs px-1.5 py-0`}>
                {stateLabels[entry.state]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              equipe {entry.doctor?.name || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <a href={`tel:${entry.phone}`} className="text-primary flex items-center justify-center p-1.5 hover:bg-secondary/50 rounded-full transition-colors" title="Appeler">
              <Phone className="h-5 w-5" />
            </a>
            <a
              href={`sms:${entry.phone}?body=${encodeURIComponent("Clinique DermaDoc : votre tour arrive bientôt.\nVous pouvez suivre le nombre de patients avant vous ici :\nhttps://passevite-dermadoc.vercel.app/client\nدوركم سيأتي قريبًا.")}`}
              className="text-primary flex items-center justify-center p-1.5 hover:bg-secondary/50 rounded-full transition-colors"
              title="Envoyer un SMS"
            >
              <MessageCircle className="h-5 w-5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => onEdit(entry)}
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer le patient ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera {entry.client_id} de la file d'attente. Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <Button
            size="sm"
            onClick={() => onNext(entry)}
            className="gap-1 shrink-0 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">Suivant</span> <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

const Accueil = () => {
  const { user, signOut } = useAuth();
  const { entries, inCabinetEntries, activeSession, doctors, loading, openSession, closeSession, addClient, callClient, completeClient, getStats, updateClient, deleteClient, updateCompletedClient, deleteCompletedClient } = useQueue();

  // Manager Auth for editing today's clients
  const [isManagerAuthorized, setIsManagerAuthorized] = useState(false);
  const [managerPassword, setManagerPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Edit Completed Client State
  const [editCompletedClient, setEditCompletedClient] = useState<any>(null);
  const [showEditCompletedModal, setShowEditCompletedModal] = useState(false);
  const [ecName, setEcName] = useState('');
  const [ecTreatment, setEcTreatment] = useState('');
  const [ecTotal, setEcTotal] = useState('');
  const [ecPaid, setEcPaid] = useState('');
  const [ecNotes, setEcNotes] = useState('');

  const handleVerifyManager = () => {
    if (managerPassword === 'admin123') {
      setIsManagerAuthorized(true);
      setShowPasswordDialog(false);
      setManagerPassword('');
      toast.success('Mode édition activé');
    } else {
      toast.error('Mot de passe incorrect');
    }
  };

  const fetchTodayClients = async () => {
    try {
      setLoadingTodayClients(true);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const nextStart = new Date(start);
      nextStart.setDate(nextStart.getDate() + 1);
      const { data } = await supabase
        .from('completed_clients')
        .select('*, doctor:doctors(name)')
        .gte('completed_at', start.toISOString())
        .lt('completed_at', nextStart.toISOString())
        .order('completed_at', { ascending: false });
      setTodayClients(data || []);
    } catch (err) {
      console.error('Error fetching today clients', err);
      setTodayClients([]);
    } finally {
      setLoadingTodayClients(false);
    }
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [todayClients, setTodayClients] = useState<any[]>([]);
  const [loadingTodayClients, setLoadingTodayClients] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [editEntry, setEditEntry] = useState<QueueEntry | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editPatientName, setEditPatientName] = useState('');
  const [editState, setEditState] = useState<'U' | 'N' | 'R'>('N');
  const [editDoctorId, setEditDoctorId] = useState('');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');

  // Quick Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  // Channel Choice Modal
  const [showChannelChoice, setShowChannelChoice] = useState(false);
  const [lastCompletedPatient, setLastCompletedPatient] = useState<{ name: string; phone: string; treatment: string } | null>(null);

  const doctorsScrollRef = useRef<HTMLDivElement>(null);

  const scrollDoctors = (direction: 'left' | 'right') => {
    if (doctorsScrollRef.current) {
      const scrollAmount = 150;
      doctorsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Add client form
  const [newPhone, setNewPhone] = useState('');
  const [newPatientName, setNewPatientName] = useState('');
  const [newState, setNewState] = useState<'U' | 'N' | 'R'>('N');
  const [newDoctorId, setNewDoctorId] = useState('');
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
  const [foundAppointments, setFoundAppointments] = useState<any[]>([]);
  const [patientSuggestions, setPatientSuggestions] = useState<any[]>([]);
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);

  // Complete form
  const [clientName, setClientName] = useState('');
  const [treatment, setTreatment] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [tranchePaid, setTranchePaid] = useState('');
  const [totalPaidPreviously, setTotalPaidPreviously] = useState(0);
  const [completeNotes, setCompleteNotes] = useState('');
  const [historyTreatments, setHistoryTreatments] = useState<Array<{ treatment: string; totalAmount: number; totalPaid: number }>>([]);
  const [selectedHistoryTreatment, setSelectedHistoryTreatment] = useState<string | null>(null);

  const [hasNextAppt, setHasNextAppt] = useState(false);
  const [nextApptDate, setNextApptDate] = useState<Date | undefined>(undefined);
  const [nextApptTime, setNextApptTime] = useState('09:00');
  const [nextApptDoctorId, setNextApptDoctorId] = useState('');
  const [nextApptNote, setNextApptNote] = useState('');

  // Treatments list (load from localStorage to allow adding custom treatments)
  const [treatmentsList, setTreatmentsList] = useState<string[]>(TREATMENTS);
  const [showTreatmentSuggestions, setShowTreatmentSuggestions] = useState(false);


  // Memoize statistics to avoid recalculating on every render
  const stats = useMemo(() => getStats(), [entries, inCabinetEntries, getStats]);

  // Load persisted treatments from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pv_treatments');
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          // Merge with default treatments preserving uniqueness
          const merged = Array.from(new Set([...parsed, ...TREATMENTS]));
          setTreatmentsList(merged);
        }
      }
    } catch (err) {
      // ignore
    }
  }, []);

  // Memoize statistics by doctor
  const doctorStats = useMemo(() => {
    return doctors.map(doctor => {
      const doctorEntries = entries.filter(e => e.doctor_id === doctor.id);
      return {
        ...doctor,
        waitingCount: doctorEntries.length
      };
    });
  }, [doctors, entries]);


  const handleOpenSession = async () => {
    if (!user) return;
    const { error } = await openSession(user.id);
    if (error) toast.error('Erreur lors de l\'ouverture de la séance');
    else toast.success('Nouvelle séance ouverte');
  };

  const handleCloseSession = async () => {
    // Check if there are clients in waiting list or in-cabinet
    if (entries.length > 0 || inCabinetEntries.length > 0) {
      const waitingCount = entries.length;
      const inCabinetCount = inCabinetEntries.length;
      toast.error(
        `Impossible de fermer la séance avec ${waitingCount + inCabinetCount} patient(s) en attente (${waitingCount} en file d'attente, ${inCabinetCount} au cabinet)`
      );
      return;
    }

    const { error } = await closeSession();
    if (error) toast.error('Erreur lors de la fermeture de la séance');
    else toast.success('Séance fermée avec succès');
  };

  const handleAddClient = async () => {
    if (!newPhone.trim() || !newDoctorId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await addClient(newPhone, newState, newDoctorId, newPatientName, linkedAppointmentId || undefined);
    if (error) {
      if ((error as any).code === '23505') {
        toast.error('Ce numéro de téléphone est déjà dans la file d\'attente');
      } else {
        toast.error('Erreur lors de l\'ajout');
      }
    }
    else {
      toast.success('Patient ajouté à la file');
      setShowAddModal(false);
      setNewPhone('');
      setNewPatientName('');
      setNewState('N');
      setNewDoctorId('');
      setLinkedAppointmentId(null);
    }
  };

  // Search for existing patients (from completed_clients) when in Nouveau state and typing phone only
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const searchPatients = async () => {
        const hasEnoughPhoneChars = newPhone.trim().length >= 3;

        if (newState === 'N' && hasEnoughPhoneChars) {
          try {
            const { data } = await supabase
              .from('completed_clients')
              .select('client_name, phone, doctor:doctors(name)')
              .ilike('phone', `%${newPhone.trim()}%`)
              .order('completed_at', { ascending: false })
              .limit(10);

            // Deduplicate by phone + name
            const seen = new Set<string>();
            const unique = (data || []).filter((item: any) => {
              const key = `${item.phone}||${item.client_name}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setPatientSuggestions(unique);
            setShowPatientSuggestions(unique.length > 0);
          } catch (err) {
            console.error('Error searching patients:', err);
            setPatientSuggestions([]);
            setShowPatientSuggestions(false);
          }
        } else {
          setPatientSuggestions([]);
          setShowPatientSuggestions(false);
        }
      };

      searchPatients();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [newPhone, newState]);

  // Search for appointment when phone, name or state changes with debounce
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      const searchAppointments = async () => {
        // Only search if we are in Rendez-vous state and have enough characters
        const hasEnoughChars = (newPhone.trim().length >= 3 || newPatientName.trim().length >= 2);

        if (newState === 'R' && hasEnoughChars && !linkedAppointmentId) {
          const today = new Date();
          const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();

          let orConditions = [];
          if (newPhone.trim().length >= 3) orConditions.push(`client_phone.ilike.%${newPhone.trim()}%`);
          if (newPatientName.trim().length >= 2) orConditions.push(`client_name.ilike.%${newPatientName.trim()}%`);

          const { data } = await supabase
            .from('appointments')
            .select('id, client_name, client_phone, doctor_id, appointment_at, status')
            .neq('status', 'attended')
            .neq('status', 'denied')
            .or(orConditions.join(','))
            .gte('appointment_at', start)
            .order('appointment_at', { ascending: true })
            .limit(5);

          if (data && data.length > 0) {
            setFoundAppointments(data);
          } else {
            setFoundAppointments([]);
          }
        } else {
          setFoundAppointments([]);
          if (newState !== 'R') setLinkedAppointmentId(null);
        }
      };

      searchAppointments();
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [newPhone, newPatientName, newState, linkedAppointmentId]);

  const handleNext = async (entry: QueueEntry) => {
    // Call client - move from waiting to in_cabinet
    const { error } = await callClient(entry.id);
    if (error) {
      toast.error('Erreur lors de l\'appel du patient');
    } else {
      toast.success(`Patient ${entry.client_id} appelé au cabinet`);
    }
  };

  const handleCompleteClick = async (entry: QueueEntry) => {
    // Open completion form for in-cabinet client
    setSelectedEntry(entry);
    setClientName(entry.patient_name || '');

    // Fetch history for pre-filling
    try {
      // Only load previous treatments when this entry is a Rendez-vous (R).
      if (entry.state === 'R') {
        const { data: history } = await (await import('@/integrations/supabase/client')).supabase
          .from('completed_clients')
          .select('*')
          .eq('phone', entry.phone)
          .order('completed_at', { ascending: false });

        if (history && history.length > 0) {
          // Aggregate history per treatment: sum paid tranches and keep latest total_amount for that treatment
          const map = new Map<string, { totalPaid: number; totalAmount: number; lastDate: number }>();
          history.forEach((item: any) => {
            const key = item.treatment || '—';
            const existing = map.get(key) || { totalPaid: 0, totalAmount: 0, lastDate: 0 };
            existing.totalPaid += (item.tranche_paid || 0);
            const ts = new Date(item.completed_at).getTime();
            if (!existing.lastDate || ts > existing.lastDate) {
              existing.totalAmount = item.total_amount || 0;
              existing.lastDate = ts;
            }
            map.set(key, existing);
          });

          const treatmentsArr = Array.from(map.entries()).map(([treatment, v]) => ({
            treatment,
            totalAmount: v.totalAmount || 0,
            totalPaid: v.totalPaid || 0,
          }));

          setHistoryTreatments(treatmentsArr);
          // Prefill with the most recent treatment if available
          const first = treatmentsArr[0];
          if (first) {
            setTreatment(first.treatment);
            setTotalAmount(first.totalAmount?.toString() || '');
            setTotalPaidPreviously(first.totalPaid || 0);
            setSelectedHistoryTreatment(first.treatment);
          } else {
            setTreatment('');
            setTotalAmount('');
            setTotalPaidPreviously(0);
            setSelectedHistoryTreatment(null);
          }
          setTranchePaid('');
        } else {
          setHistoryTreatments([]);
          setTreatment('');
          setTotalAmount('');
          setTotalPaidPreviously(0);
          setTranchePaid('');
          setSelectedHistoryTreatment(null);
        }
      } else {
        // New patient: do not show or prefill any previous totals
        setHistoryTreatments([]);
        setTreatment('');
        setTotalAmount('');
        setTotalPaidPreviously(0);
        setTranchePaid('');
        setSelectedHistoryTreatment(null);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setHistoryTreatments([]);
      setTreatment('');
      setTotalAmount('');
      setTotalPaidPreviously(0);
      setTranchePaid('');
      setSelectedHistoryTreatment(null);
    }

    setCompleteNotes('');
    setHasNextAppt(false);
    setNextApptDate(undefined);
    setNextApptTime('09:00');
    setNextApptDoctorId(entry.doctor_id);
    setNextApptNote('');
    setShowCompleteModal(true);

  };

  const handleComplete = async () => {
    if (!selectedEntry || !user || !clientName.trim() || !treatment) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await completeClient(
      selectedEntry.id,
      clientName,
      treatment,
      parseFloat(totalAmount) || 0,
      parseFloat(tranchePaid) || 0,
      user.id,
      completeNotes
    );
    if (error) toast.error('Erreur');
    else {
      if (hasNextAppt && nextApptDate) {
        const [hours, minutes] = nextApptTime.split(':');
        const appointmentAt = new Date(nextApptDate);
        appointmentAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        await (await import('@/integrations/supabase/client')).supabase
          .from('appointments')
          .insert({
            client_phone: selectedEntry.phone,
            client_name: clientName.trim(),
            doctor_id: nextApptDoctorId,
            appointment_at: appointmentAt.toISOString(),
            status: 'scheduled',
            notes: nextApptNote.trim() || null
          });

        toast.success('Rendez-vous programmé');
      }


      // Prepare data for the choice modal
      setLastCompletedPatient({
        name: clientName,
        phone: selectedEntry!.phone,
        treatment: treatment
      });

      toast.success('Patient traité avec succès');

      // Show choice modal instead of direct redirect
      setShowCompleteModal(false);
      setShowChannelChoice(true);

      // Persist new treatment for suggestions if it's not already present
      try {
        const trimmed = treatment.trim();
        if (trimmed && !treatmentsList.find(t => t.toLowerCase() === trimmed.toLowerCase())) {
          const newList = [trimmed, ...treatmentsList];
          setTreatmentsList(newList);
          try { localStorage.setItem('pv_treatments', JSON.stringify(newList)); } catch (e) { /* ignore */ }
        }
      } catch (err) {
        // ignore
      }

      setShowCompleteModal(false);
    }
  };

  const handleEdit = (entry: QueueEntry) => {
    setEditEntry(entry);
    setEditPhone(entry.phone);
    setEditPatientName(entry.patient_name || '');
    setEditState(entry.state);
    setEditDoctorId(entry.doctor_id);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editEntry || !editPhone.trim() || !editDoctorId) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    const { error } = await updateClient(editEntry.id, {
      phone: editPhone.trim(),
      patient_name: editPatientName.trim(),
      state: editState,
      doctor_id: editDoctorId,
    });
    if (error) toast.error('Erreur lors de la modification');
    else {
      toast.success('Patient modifié avec succès');
      setShowEditModal(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    const { error } = await deleteClient(entryId);
    if (error) toast.error('Erreur lors de la suppression');
    else toast.success('Patient supprimé');
  };

  const handleAddExpense = async () => {
    if (!expenseAmount || !expenseDesc) {
      toast.error('Veuillez remplir le montant et la description');
      return;
    }
    setSavingExpense(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        amount: parseFloat(expenseAmount),
        description: expenseDesc,
        date: format(new Date(), 'yyyy-MM-dd'),
        created_by: user?.id
      });
      if (error) throw error;
      toast.success('Dépense ajoutée avec succès');
      setExpenseAmount('');
      setExpenseDesc('');
      setShowExpenseModal(false);
    } catch (err) {
      toast.error('Erreur lors de l\'ajout de la dépense');
    } finally {
      setSavingExpense(false);
    }
  };

  const filtered = useMemo(() => {
    return entries.filter(e => {
      const matchesDoctor = doctorFilter === 'all' || e.doctor_id === doctorFilter;
      return matchesDoctor;
    });
  }, [entries, doctorFilter]);

  const stateColors = {
    U: 'bg-destructive text-destructive-foreground',
    N: 'bg-primary text-primary-foreground',
    R: 'bg-foreground text-background',
  };

  const stateLabels = { U: 'Urgence', N: 'Nouveau', R: 'Rendez-vous' };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Chargement de la séance...</p>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="flex items-center justify-between p-3 sm:p-4 border-b">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground italic">PasseVite</h1>
            <p className="text-[10px] text-muted-foreground uppercase">le soin qui passe</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm text-center border-0 shadow-lg">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-secondary flex items-center justify-center mx-auto">
                <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">Bienvenue</h2>
                <p className="text-sm text-muted-foreground mt-1">Aucune séance active</p>
              </div>
              <Button onClick={handleOpenSession} className="w-full h-12 text-base">
                Ouvrir une nouvelle séance
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-3 sm:p-4 border-b sticky top-0 bg-background z-10">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-foreground italic leading-none">PasseVite</h1>
          <p className="text-[10px] text-muted-foreground truncate uppercase">le soin qui passe</p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 mx-auto">
          <Button onClick={async () => {
            await fetchTodayClients();
            setShowTodayModal(true);
          }} variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-[11px] font-black uppercase">Terminer</Button>
          <Button asChild variant="secondary" size="sm" className="h-8 px-2 sm:px-3 text-[11px] font-black uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary/20 border-0 rounded-full sm:rounded-md shadow-none">
            <Link to="/accueil/factures/ajouter">
              <ShoppingCart className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Facture</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-[11px] font-black uppercase tracking-widest bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10 rounded-full sm:rounded-md shadow-none" onClick={() => setShowExpenseModal(true)}>
            <DollarSign className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Dépense</span>
          </Button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link to="/rendezvous">
            <Button variant="outline" size="sm" className="hidden sm:flex h-8 px-3 text-[11px] font-black uppercase tracking-widest">
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Rendez-vous
            </Button>
            <Button variant="outline" size="icon" className="sm:hidden h-8 w-8 rounded-full">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </Link>


          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="hidden sm:flex h-8 px-3 text-[11px] font-black uppercase tracking-widest" disabled={entries.length > 0 || inCabinetEntries.length > 0}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Fermer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="sm:hidden h-8 w-8 rounded-full" disabled={entries.length > 0 || inCabinetEntries.length > 0}>
                <XCircle className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)]">
              <AlertDialogHeader>
                <AlertDialogTitle>Fermer la séance ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {entries.length > 0 || inCabinetEntries.length > 0 ? (
                    <span className="text-destructive">
                      Impossible de fermer la séance : {entries.length + inCabinetEntries.length} patient(s) en attente
                      ({entries.length} en file d'attente, {inCabinetEntries.length} au cabinet).
                      Veuillez traiter ou supprimer tous les patients avant de fermer la séance.
                    </span>
                  ) : (
                    'Cette action va fermer la séance actuelle. La file d\'attente sera remise à zéro et l\'écran TV sera réinitialisé.'
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleCloseSession} disabled={entries.length > 0 || inCabinetEntries.length > 0}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8"><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      {/* Today's completed clients modal (Terminer) */}
      <Dialog open={showTodayModal} onOpenChange={setShowTodayModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(100vh-4rem)] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Clients traités aujourd'hui</DialogTitle>
              {!isManagerAuthorized ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-primary"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modifier</span>
                </Button>
              ) : (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1">
                  <Unlock className="h-3.5 w-3.5" /> Mode Manager
                </Badge>
              )}
            </div>
          </DialogHeader>
          <div className="relative">
            <div className="max-h-[calc(100vh-28rem)] overflow-y-auto space-y-3 py-2 pr-2">
              {loadingTodayClients ? (
                <div className="flex items-center justify-center p-6">
                  <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : todayClients.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Aucun client traité aujourd'hui.</div>
              ) : (
                <div className="space-y-2">
                  {todayClients.map((c: any) => (
                    <Card key={c.id} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-foreground">{c.client_name}</div>
                            <div className="text-xs text-muted-foreground">{c.phone} · {c.doctor?.name || '—'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{(c.total_amount || 0).toLocaleString()} DZD</div>
                            <div className="text-xs text-muted-foreground">Payé: {(c.tranche_paid || 0).toLocaleString()} DZD</div>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground flex items-center justify-between">
                          <div>Traitement: {c.treatment}</div>
                          {isManagerAuthorized && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setEditCompletedClient(c);
                                  setEcName(c.client_name);
                                  setEcTreatment(c.treatment);
                                  setEcTotal(c.total_amount.toString());
                                  setEcPaid(c.tranche_paid.toString());
                                  setEcNotes(c.notes || '');
                                  setShowEditCompletedModal(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer ce traitement ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action supprimera le record du client {c.client_name} pour le traitement {c.treatment}.
                                      Les statistiques financières seront impactées.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground"
                                      onClick={async () => {
                                        const { error } = await deleteCompletedClient(c.id);
                                        if (error) toast.error('Erreur');
                                        else {
                                          toast.success('Supprimé');
                                          fetchTodayClients();
                                        }
                                      }}
                                    >
                                      Supprimer
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                        {c.notes && <div className="mt-1 text-xs text-muted-foreground italic">Note: {c.notes}</div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            {isManagerAuthorized && (
              <Button variant="outline" onClick={() => setIsManagerAuthorized(false)} className="flex-1">
                Désactiver Mode Manager
              </Button>
            )}
            <Button onClick={() => setShowTodayModal(false)} className={isManagerAuthorized ? 'flex-1' : 'w-full'}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-[320px]">
          <DialogHeader>
            <DialogTitle>Accès Manager</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">Veuillez entrer le mot de passe manager pour modifier les traitements.</p>
            <Input
              type="password"
              placeholder="Mot de passe"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerifyManager()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Annuler</Button>
            <Button onClick={handleVerifyManager}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Completed Client Modal */}
      <Dialog open={showEditCompletedModal} onOpenChange={setShowEditCompletedModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le traitement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom du patient</label>
              <Input value={ecName} onChange={e => setEcName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Traitement</label>
              <Input value={ecTreatment} onChange={e => setEcTreatment(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Total (DZD)</label>
                <Input type="number" value={ecTotal} onChange={e => setEcTotal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payé (DZD)</label>
                <Input type="number" value={ecPaid} onChange={e => setEcPaid(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input value={ecNotes} onChange={e => setEcNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCompletedModal(false)}>Annuler</Button>
            <Button onClick={async () => {
              const { error } = await updateCompletedClient(editCompletedClient.id, {
                client_name: ecName,
                treatment: ecTreatment,
                total_amount: parseFloat(ecTotal) || 0,
                tranche_paid: parseFloat(ecPaid) || 0,
                notes: ecNotes
              });
              if (error) toast.error('Erreur');
              else {
                toast.success('Modifié');
                setShowEditCompletedModal(false);
                fetchTodayClients();
              }
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Stats by Doctor - carousel with navigation */}
      <div className="relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 shadow-md rounded-full"
            onClick={() => scrollDoctors('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 shadow-md rounded-full"
            onClick={() => scrollDoctors('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div
          ref={doctorsScrollRef}
          className="flex gap-2 p-3 sm:p-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {doctorStats.map(ds => {
            return (
              <Card
                key={ds.id}
                className="border-0 shadow-sm shrink-0 w-28 sm:w-40 snap-start cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setDoctorFilter(doctorFilter === ds.id ? 'all' : ds.id)}
              >
                <CardContent className="p-3 sm:p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground mb-1 truncate">{ds.name}</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">{ds.waitingCount}</p>
                  <p className="text-xs text-muted-foreground">en attente</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* In Cabinet Section */}
      {inCabinetEntries.length > 0 && (
        <div className="p-3 sm:p-4 pb-0">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-orange-500" />
            Au cabinet ({inCabinetEntries.length})
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {inCabinetEntries.map(entry => (
              <Card
                key={entry.id}
                className="border-orange-200 bg-orange-50 shrink-0 w-40 sm:w-48 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCompleteClick(entry)}
              >
                <CardContent className="p-3 text-center">
                  <p className="font-bold text-lg text-orange-700">{entry.client_id}</p>
                  <p className="text-xs font-medium text-orange-800 truncate">{entry.patient_name || '—'}</p>
                  <p className="text-xs text-orange-600 truncate">{entry.doctor?.name || '—'}</p>
                  <p className="text-xs text-orange-500 mt-1">Cliquer pour finaliser</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 p-3 sm:p-4 space-y-2 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun patient en attente</p>
          </div>
        ) : (
          filtered.map((entry, index) => (
            <QueueItem
              key={entry.id}
              entry={entry}
              index={index}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onNext={handleNext}
            />
          ))
        )}
      </div>

      {/* FAB to add client */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6">
        <Button
          size="lg"
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>


      {/* Add Client Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Select value={newState} onValueChange={(v) => setNewState(v as 'N' | 'R')}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="État" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="N">🟢 Nouveau</SelectItem>
                <SelectItem value="R">🔵 Rendez-vous</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Nom du patient"
              value={newPatientName}
              onChange={(e) => {
                setNewPatientName(e.target.value);
                setLinkedAppointmentId(null); // Clear link if user manually changes name
              }}
              className="h-11 sm:h-12"
            />
            {linkedAppointmentId && (
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 py-1.5 flex items-center gap-1.5">
                <CalendarIcon className="h-3 w-3" /> Rendez-vous lié
              </Badge>
            )}
            <Input
              placeholder="Numéro de téléphone"
              value={newPhone}
              onChange={(e) => {
                setNewPhone(e.target.value);
                setLinkedAppointmentId(null);
              }}
              type="tel"
              className="h-11 sm:h-12"
            />

            {showPatientSuggestions && patientSuggestions.length > 0 && newState === 'N' && !linkedAppointmentId && (
              <div className="space-y-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-1.5 px-1">
                  <Sparkles className="h-3 w-3" /> Patients existants :
                </p>
                <div className="flex flex-col gap-1.5">
                  {patientSuggestions.map((patient, idx) => (
                    <Button
                      key={`${patient.phone}-${patient.client_name}-${idx}`}
                      variant="outline"
                      size="sm"
                      className="justify-start h-auto py-2.5 px-3 text-left border-emerald-100 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-all rounded-lg group"
                      onClick={() => {
                        setNewPatientName(patient.client_name);
                        setNewPhone(patient.phone);
                        if (patient.doctor?.name) {
                          const doc = doctors.find(d => d.name === patient.doctor.name);
                          if (doc) setNewDoctorId(doc.id);
                        }
                        setPatientSuggestions([]);
                        setShowPatientSuggestions(false);
                        toast.success(`Patient sélectionné : ${patient.client_name}`);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-900 truncate">{patient.client_name}</p>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-emerald-50 text-emerald-600">
                              Existant
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                            <span>{patient.phone}</span>
                            {patient.doctor?.name && (
                              <>
                                <span>•</span>
                                <span className="truncate">{patient.doctor.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {foundAppointments.length > 0 && !linkedAppointmentId && (
              <div className="space-y-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1.5 px-1">
                  <Sparkles className="h-3 w-3" /> Suggestions (Avenir) :
                </p>
                <div className="flex flex-col gap-1.5">
                  {foundAppointments.map((appt) => {
                    const apptDate = new Date(appt.appointment_at);
                    const isToday = apptDate.toDateString() === new Date().toDateString();

                    return (
                      <Button
                        key={appt.id}
                        variant="outline"
                        size="sm"
                        className="justify-start h-auto py-2.5 px-3 text-left border-blue-100 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all rounded-lg group"
                        onClick={() => {
                          setNewPatientName(appt.client_name);
                          setNewPhone(appt.client_phone);
                          setNewDoctorId(appt.doctor_id);
                          setLinkedAppointmentId(appt.id);
                          setFoundAppointments([]);
                          toast.success(`Patient lié : ${appt.client_name}`);
                        }}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isToday ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                            <CalendarIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-slate-900 truncate">{appt.client_name}</p>
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${isToday ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                {isToday ? "Aujourd'hui" : format(apptDate, 'dd/MM')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                              <span>{appt.client_phone}</span>
                              <span>•</span>
                              <span className="truncate">{doctors.find(d => d.id === appt.doctor_id)?.name || '...'}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-blue-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            <Select value={newDoctorId} onValueChange={setNewDoctorId}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleAddClient} className="w-full h-11 sm:h-12">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Client Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finaliser · {selectedEntry?.client_id}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-3 sm:space-y-4 pb-2">
              <Input
                placeholder="Nom du client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="h-11 sm:h-12"
              />
              <div className="relative">
                <Input
                  placeholder="Traitement"
                  value={treatment}
                  onChange={(e) => {
                    setTreatment(e.target.value);
                    setShowTreatmentSuggestions(true);
                  }}
                  onFocus={() => setShowTreatmentSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTreatmentSuggestions(false), 150)}
                  className="h-11 sm:h-12"
                />
                {showTreatmentSuggestions && (
                  <div className="absolute left-0 right-0 mt-1 bg-card border rounded-lg overflow-hidden shadow-lg max-h-40 overflow-auto z-50">
                    {treatmentsList
                      .filter(t => {
                        const q = treatment.trim().toLowerCase();
                        if (!q) return false;
                        return t.toLowerCase().includes(q);
                      })
                      .slice(0, 8)
                      .map(s => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setTreatment(s); setShowTreatmentSuggestions(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-secondary/50"
                        >
                          {s}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <Input
                placeholder="Montant total (DZD)"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                type="number"
                className="h-11 sm:h-12"
              />
              {historyTreatments.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Historique des traitements :</p>
                  <div className="flex flex-col gap-2">
                    {historyTreatments.map(ht => (
                      <Button
                        key={ht.treatment}
                        variant={selectedHistoryTreatment === ht.treatment ? 'secondary' : 'outline'}
                        size="sm"
                        className="justify-between"
                        onClick={() => {
                          setSelectedHistoryTreatment(ht.treatment);
                          setTreatment(ht.treatment);
                          setTotalAmount(ht.totalAmount?.toString() || '');
                          setTotalPaidPreviously(ht.totalPaid || 0);
                        }}
                      >
                        <span className="truncate">{ht.treatment}</span>
                        <span className="text-xs">{(ht.totalPaid || 0).toLocaleString()} / {(ht.totalAmount || 0).toLocaleString()} DZD</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                totalPaidPreviously > 0 && (
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center">
                    <span className="text-xs font-medium text-emerald-800">Déjà payé (total history):</span>
                    <span className="text-sm font-bold text-emerald-700">{totalPaidPreviously.toLocaleString()} DZD</span>
                  </div>
                )
              )}
              <Input
                placeholder="Tranche payée aujourd'hui (DZD)"
                value={tranchePaid}
                onChange={(e) => setTranchePaid(e.target.value)}
                type="number"
                className="h-11 sm:h-12"
              />
              <div className="grid grid-cols-1 gap-4">
                <Input
                  placeholder="Note (optionnelle)"
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  className="h-11 sm:h-12"
                />
              </div>

              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="next-appt"
                  checked={hasNextAppt}
                  onCheckedChange={(checked) => setHasNextAppt(checked === true)}
                />
                <label
                  htmlFor="next-appt"
                  className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Prendre un rendez-vous ?
                </label>
              </div>

              {hasNextAppt && (
                <div className="space-y-3 p-3 bg-secondary/30 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-10 px-3">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {nextApptDate ? format(nextApptDate, 'dd/MM/yy', { locale: fr }) : <span>Choisir...</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={nextApptDate} onSelect={setNextApptDate} locale={fr} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Heure</label>
                      <Input type="time" value={nextApptTime} onChange={(e) => setNextApptTime(e.target.value)} className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Equipe</label>
                    <Select value={nextApptDoctorId} onValueChange={setNextApptDoctorId}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Equipe" /></SelectTrigger>
                      <SelectContent>
                        {doctors.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Motif du rendez-vous</label>
                    <Input
                      placeholder="Motif (optionnel)"
                      value={nextApptNote}
                      onChange={(e) => setNextApptNote(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleComplete} className="w-full h-11 sm:h-12">Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Edit Client Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le patient · {editEntry?.client_id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Input
              placeholder="Nom du patient"
              value={editPatientName}
              onChange={(e) => setEditPatientName(e.target.value)}
              className="h-11 sm:h-12"
            />
            <Input
              placeholder="Numéro de téléphone"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              type="tel"
              className="h-11 sm:h-12"
            />
            <Select value={editState} onValueChange={(v) => setEditState(v as 'U' | 'N' | 'R')}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="État" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="U">🔴 Urgence</SelectItem>
                <SelectItem value="N">🟢 Nouveau</SelectItem>
                <SelectItem value="R">🔵 Rendez-vous</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editDoctorId} onValueChange={setEditDoctorId}>
              <SelectTrigger className="h-11 sm:h-12"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} className="w-full h-11 sm:h-12">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Expense Modal */}
      <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              Nouvelle Dépense Rapide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Montant (DZD)</label>
              <Input
                placeholder="ex: 1500"
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="h-12 text-lg font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Description / Motif</label>
              <Input
                placeholder="Café, Fournitures, Réparations..."
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                className="h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddExpense} disabled={savingExpense} className="w-full h-12 text-sm font-black uppercase tracking-widest bg-destructive hover:bg-destructive/90 text-white border-0">
              {savingExpense ? "Enregistrement..." : "Confirmer la dépense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Choice Modal */}
      <Dialog open={showChannelChoice} onOpenChange={setShowChannelChoice}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-3xl">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">Envoyer l'Avis ?</h3>
              <p className="text-sm text-muted-foreground px-4">
                Comment souhaitez-vous envoyer le questionnaire de satisfaction à <span className="font-bold text-primary">{lastCompletedPatient?.name}</span> ?
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 gap-3">
            <Button
              className="h-14 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white border-0 shadow-md font-bold text-md gap-3"
              onClick={() => {
                if (!lastCompletedPatient) return;
                const msg = `Bonjour ${lastCompletedPatient.name}, avez-vous aimé votre traitement "${lastCompletedPatient.treatment}" à la clinique DermaDoc ?\n\nLaissez-nous votre avis ici : https://passevite-dermadoc.vercel.app/review?phone=${lastCompletedPatient.phone}`;
                // Clean phone number (remove leading zero and add +213 for Algeria)
                let cleanPhone = lastCompletedPatient.phone.replace(/\s+/g, '');
                if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.substring(1);
                else if (!cleanPhone.startsWith('213')) cleanPhone = '213' + cleanPhone;

                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                setShowChannelChoice(false);
              }}
            >
              <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </Button>

            <Button
              variant="outline"
              className="h-14 rounded-2xl border-2 hover:bg-secondary/50 font-bold text-md gap-3"
              onClick={() => {
                if (!lastCompletedPatient) return;
                const msg = `Bonjour ${lastCompletedPatient.name}, avez-vous aimé votre traitement "${lastCompletedPatient.treatment}" à la clinique DermaDoc ?\n\nLaissez-nous votre avis ici : https://passevite-dermadoc.vercel.app/review?phone=${lastCompletedPatient.phone}`;
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                const smsLink = `sms:${lastCompletedPatient.phone}${isIOS ? '&' : '?'}body=${encodeURIComponent(msg)}`;
                window.location.href = smsLink;
                setShowChannelChoice(false);
              }}
            >
              <Phone className="h-6 w-6 text-primary" />
              SMS Classique
            </Button>

            <Button
              variant="ghost"
              className="h-10 rounded-xl text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-widest mt-2"
              onClick={() => setShowChannelChoice(false)}
            >
              Plus tard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accueil;
