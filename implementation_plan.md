# Plan: Merge Appointments and Completed Clients in the Patients Directory

Currently, the Patients directory on the `/rendezvous` page only shows patients who have recorded completed visits (`completed_clients` table). We will modify the code to combine the records from both the completed visits and the calendar appointments (`appointments` table) so that all patients appear in the list.

## User Review Required

> [!NOTE]
> * Patients who only have appointments (and no completed visits) will display a status label: `Rendez-vous uniquement` (Appointment only) under their name.
> * The "Dernière visite" column will display `Dernier RDV` with the date of their latest appointment if no completed visits exist.

---

## Proposed Changes

### Rendez-vous Directory

#### [MODIFY] [Rendezvous.tsx](file:///c:/Users/admin/Desktop/passevite-dermadoc/src/pages/Rendezvous.tsx)
We will perform the following updates in `Rendezvous.tsx`:
1. Add a `filteredAppointments` memo to filter the app's loaded appointments in memory using the search bar input.
2. Update the `groupedPatients` memo to combine unique completed clients with search-filtered appointments, maintaining a clean deduplicated structure.
3. Update the UI rendering of the patient cards to correctly handle cases where a patient has no completed visits (displaying `Rendez-vous uniquement` and `Dernier RDV` instead of falling back to today's date).

##### 1. Define `filteredAppointments` and Update `groupedPatients` Memos
```typescript
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
```

##### 2. Update Patient Card Rendering in the Directory
```tsx
                                    groupedPatients.map(patient => (
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
```

---

## Verification Plan

### Automated Tests
- Run `npm run lint` to check for syntax and type issues.

### Manual Verification
1. Open the app locally using `npm run dev`.
2. Go to `/rendezvous` -> Patients section.
3. Verify that patients who only have appointments (and zero completed visits) now appear in the list with the tag `Rendez-vous uniquement`.
4. Open their patient dossier and verify that their appointment history is loaded correctly.
