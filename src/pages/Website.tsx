import { useEffect, useMemo, useState } from 'react';
import { format, isBefore, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  PhoneCall,
  Sparkles,
  Star,
  Menu,
  X,
  Instagram,
  ChevronRight,
  ArrowRight,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const clinic = {
  name: 'Dermadoc',
  location: 'Cite 08maib1945, bt17a, Bab Ezzouar, Alger',
  phone: '0554 02 97 32',
  mapsUrl:
    'https://www.google.com/maps/place/Dermadoc+clinic/@36.7330258,3.1823368,17z/data=!3m1!4b1!4m6!3m5!1s0x128e51b9024248bb:0x43393ad9f6d0a5d0!8m2!3d36.7330258!4d3.1849117!16s%2Fg%2F11yqq_fn1g?entry=ttu&g_ep=EgoyMDI2MDQyMS4wIKXMDSoASAFQAw%3D%3D',
};

const services = [
  { name: 'Dermatologie Médicale', icon: Sparkles },
  { name: 'Médecine Esthétique', icon: Star },
  { name: 'Laser & Épilation', icon: Sparkles },
  { name: 'Photothérapie LED', icon: Sparkles },
  { name: 'Détatouage', icon: Sparkles },
  { name: 'Soins du Visage', icon: Star },
];

const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00'
];

const Website = () => {
  const isMobile = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [introStage, setIntroStage] = useState<'showing' | 'fading' | 'hidden'>('showing');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Keep intro visible for 4.5s (UI/UX loading phase), then fade out for 1s
    const timer1 = setTimeout(() => setIntroStage('fading'), 4300);
    const timer2 = setTimeout(() => setIntroStage('hidden'), 5300);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);

  const bookingSummary = useMemo(() => {
    if (!selectedDate || !selectedTime) return null;
    return `${format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })} à ${selectedTime}`;
  }, [selectedDate, selectedTime]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName.trim() || !phone.trim() || !selectedDate || !selectedTime) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setIsSubmitting(true);

    try {
      const [hours, minutes] = selectedTime.split(':');
      const appointmentAt = new Date(selectedDate);
      appointmentAt.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await (supabase as any)
        .from('website')
        .insert([{
          client_name: fullName,
          client_phone: phone,
          appointment_at: appointmentAt.toISOString(),
          status: 'scheduled',
          notes: 'Source: Website'
        }]);

      if (error) throw error;

      setIsSubmitted(true);
      toast.success('Demande enregistrée avec succès');
    } catch (error) {
      console.error('Error submitting appointment:', error);
      toast.error('Erreur lors de la réservation. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFEBE6] text-[#2A2A2A] font-sans selection:bg-[#8A9A8A]/30 overflow-x-hidden">
      {/* Intro Overlay - Premium 5s Experience */}
      {introStage !== 'hidden' && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#EFEBE6] transition-opacity duration-1000",
            introStage === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <div className="flex flex-col items-center justify-center h-full w-full max-w-lg px-6 gap-12">
            <div className="relative animate-fade-in flex flex-col items-center gap-10">
              <img
                src="/Untitled-1.png"
                alt="Dermadoc Logo"
                className="h-24 sm:h-32 opacity-90 animate-float"
                style={{ animationDuration: '4s' }}
              />
              <div className="text-center space-y-6 animate-slide-up" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
                <h2 className="flex flex-col text-[#2A2A2A]">
                  <span className="font-serif text-xl sm:text-3xl font-light tracking-widest uppercase mb-2">Bienvenue chez</span>
                  <span className="font-serif text-[4.5rem] sm:text-[7rem] leading-[0.8] font-bold tracking-tighter lowercase">dermadoc</span>
                </h2>
                <p className="font-serif text-xl sm:text-3xl text-[#4A4A4A] italic font-light opacity-90">
                  L'excellence dermatologique & esthétique <br /> au cœur d'Alger
                </p>
              </div>
            </div>

            {/* Elegant minimalist loading line */}
            <div className="w-48 h-[1px] bg-[#8A9A8A]/20 mt-8 overflow-hidden rounded-full animate-fade-in" style={{ animationDelay: '1.2s', animationFillMode: 'both' }}>
              <div className="h-full bg-[#2A2A2A] animate-pan" style={{ width: '40%', animationDuration: '1.5s' }} />
            </div>
          </div>
        </div>
      )}
      {/* Glassmorphic Nav */}
      <nav className="fixed top-6 left-1/2 z-50 -translate-x-1/2 w-[90%] max-w-5xl rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-6 py-3 sm:px-8">
        <div className="flex items-center justify-center gap-3 py-1">
          <img src="/Untitled-1.png" className="h-6 sm:h-8 w-auto brightness-0 invert opacity-80" alt="Logo" />
          <span className="font-serif text-lg font-bold tracking-tight text-white uppercase">DERMADOC</span>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#EFEBE6] pt-32 px-8 flex flex-col gap-6 text-3xl font-serif text-[#2A2A2A] md:hidden animate-fade-in">
          <a href="#" onClick={() => setIsMenuOpen(false)}>La Clinique <span className="text-sm opacity-50 block">العيادة</span></a>
          <a href="#services" onClick={() => setIsMenuOpen(false)}>Nos Services <span className="text-sm opacity-50 block">خدماتنا</span></a>
          <a href="#booking" onClick={() => setIsMenuOpen(false)}>Réservation <span className="text-sm opacity-50 block">الحجز</span></a>
          <a href="#" onClick={() => setIsMenuOpen(false)}>Contact <span className="text-sm opacity-50 block">اتصل بنا</span></a>
        </div>
      )}

      {/* Hero Section - Smooth Panning */}
      <section className="relative h-screen w-full overflow-hidden">
        <div className="relative h-full w-full">
          <img
            src="/Screenshot 2026-04-24 033808.png"
            alt="Clinic Hero"
            className="absolute h-full w-full object-cover grayscale-[0.2] sepia-[0.1] animate-pan"
          />
          <div className="absolute inset-0 bg-black/5" />
        </div>

        {/* Large Overlapping Content */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white text-center px-6">
          <div className="space-y-12 sm:space-y-16 animate-slide-up">
            <h1 className="font-serif text-[6rem] sm:text-[15rem] md:text-[22rem] lg:text-[30rem] leading-[0.8] font-bold tracking-tighter select-none drop-shadow-2xl">
              dermadoc
            </h1>
            <div className="space-y-10 sm:space-y-12">
              <p className="font-serif text-2xl sm:text-4xl md:text-5xl font-light italic tracking-tight opacity-95 max-w-[90vw] sm:max-w-4xl mx-auto leading-tight whitespace-nowrap">
                L'excellence dermatologique & esthétique au cœur d'Alger
              </p>
              <div className="pt-4 sm:pt-8">
                <Button asChild className="h-16 sm:h-20 px-10 sm:px-16 rounded-full bg-white text-[#2A2A2A] text-lg sm:text-xl font-medium hover:bg-[#8A9A8A] hover:text-white transition-all shadow-2xl border-none">
                  <a href="#booking" className="flex items-center gap-2">
                    <span>Réserver maintenant</span>
                    <span className="opacity-70 text-sm">/ احجز الآن</span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-12 sm:py-16">




        {/* Big Text Section */}
        <section className="relative py-16 sm:py-24 border-t border-[#8A9A8A]/10 text-center">
          <h2 className="font-serif text-[15vw] leading-[0.8] font-bold tracking-tighter text-[#8A9A8A]/20 select-none">
            everything clinic
          </h2>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full space-y-4 px-6">
            <h3 className="font-serif text-3xl sm:text-5xl font-light">Dermatologie & <br /> Esthétique</h3>
            <p className="max-w-md mx-auto text-xs sm:text-sm text-[#4A4A4A] font-light">
              Nos techniciens spécialisés utilisent des protocoles avancés pour garantir des résultats visibles tout en respectant l'intégrité de votre barrière cutanée.
            </p>
          </div>
        </section>

        {/* Combined Booking Section */}
        <section id="booking" className="grid gap-16 lg:grid-cols-[1fr_minmax(400px,0.8fr)] items-start pt-20 text-center">
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="font-serif text-5xl sm:text-7xl font-light leading-tight">
                Planifiez votre <br /><span className="italic">visite</span>
                <span className="block text-2xl sm:text-3xl mt-4 opacity-40">خطط لزيارتك</span>
              </h2>
              <p className="max-w-md mx-auto text-sm sm:text-base text-[#4A4A4A] font-light">
                Réservez votre consultation d'exception en quelques instants. Notre service de conciergerie vous contactera afin de finaliser votre rendez-vous.
              </p>
            </div>


          </div>

          <Card className="overflow-hidden rounded-[2rem] sm:rounded-[3rem] border-none bg-white shadow-2xl shadow-[#8A9A8A]/10">
            <CardContent className="p-8 sm:p-12">
              {!isSubmitted ? (
                <form className="space-y-8" onSubmit={handleSubmit}>
                  <div className="space-y-2 text-center">
                    <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8A9A8A]">Nom Complet / الاسم الكامل</Label>
                    <Input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="bg-transparent border-0 border-b border-[#8A9A8A]/20 px-0 rounded-none h-10 text-base text-center focus-visible:ring-0 focus-visible:border-[#8A9A8A] transition-all placeholder:text-gray-300"
                      placeholder="Votre nom complet"
                      required
                    />
                  </div>
                  <div className="space-y-2 text-center">
                    <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8A9A8A]">Téléphone / رقم الهاتف</Label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="bg-transparent border-0 border-b border-[#8A9A8A]/20 px-0 rounded-none h-10 text-base text-center focus-visible:ring-0 focus-visible:border-[#8A9A8A] transition-all placeholder:text-gray-300"
                      placeholder="05XX XX XX XX"
                      required
                    />
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8A9A8A]">Date de Consultation / تاريخ الاستشارة</Label>
                      <div className="flex justify-center bg-[#8A9A8A]/5 rounded-3xl p-4">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => isBefore(date, startOfDay(new Date()))}
                          className="bg-transparent"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 text-center">
                      <Label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8A9A8A]">Heure Souhaitée / الوقت المفضل</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {timeSlots.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedTime(t)}
                            className={cn(
                              "h-10 rounded-xl text-xs transition-all border",
                              selectedTime === t ? "bg-[#8A9A8A] border-[#8A9A8A] text-white" : "bg-white border-[#8A9A8A]/10 text-[#2A2A2A] hover:bg-[#8A9A8A]/5"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="h-20 sm:h-16 w-full rounded-full bg-[#2A2A2A] text-white text-lg font-medium hover:bg-[#8A9A8A] transition-all shadow-xl shadow-black/5 flex-col sm:flex-row gap-1 sm:gap-2">
                    <span>{isSubmitting ? 'Traitement en cours...' : 'Confirmer la Demande'}</span>
                  </Button>
                </form>
              ) : (
                <div className="text-center py-12 space-y-8 animate-fade-in">
                  <div className="mx-auto h-20 w-20 rounded-full bg-[#8A9A8A]/10 flex items-center justify-center text-[#8A9A8A]">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div className="space-y-6">
                    <h3 className="font-serif text-4xl">Nous vous remercions. <span className="block mt-2 text-2xl opacity-60">شكراً لك</span></h3>
                    <p className="text-[#4A4A4A] leading-relaxed max-w-md mx-auto">
                      Notre équipe de conciergerie vous contactera au <strong>{phone}</strong> pour confirmer votre rendez-vous d'exception du {bookingSummary}.
                      <span className="block mt-4 opacity-70">سيتصل بك فريقنا لتأكيد موعدك</span>
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setIsSubmitted(false)} className="rounded-full border-[#8A9A8A] text-[#8A9A8A] px-10 h-12">
                    Nouvelle Réservation / حجز آخر
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer - Sage Aesthetic */}
      <footer className="bg-white py-16 text-center">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-12 sm:grid-cols-2 border-b border-[#EFEBE6] pb-12 mb-12">
            <div className="space-y-6 flex flex-col items-center">
              <span className="font-serif text-4xl font-bold tracking-tighter">dermadoc</span>
              <p className="text-xs text-[#7A7A7A] leading-relaxed max-w-[280px]">
                Dermatologie et médecine esthétique de prestige au cœur de Bab Ezzouar.
              </p>
            </div>
            <div className="space-y-6 flex flex-col items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#8A9A8A]">Réseaux Sociaux / الشبكات الاجتماعية</h4>
              <div className="flex justify-center gap-6">
                <a href="https://instagram.com/dermadoc_clinic" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
                  <Instagram className="h-5 w-5 text-[#2A2A2A] hover:text-[#8A9A8A] transition-colors" />
                </a>
                <a href="https://wa.me/213554029732" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
                  <MessageCircle className="h-5 w-5 text-[#2A2A2A] hover:text-[#8A9A8A] transition-colors" />
                </a>
              </div>
            </div>
          </div>

          {/* Maps Card */}
          <div className="mb-12 flex justify-center">
            <a
              href={clinic.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block w-full max-w-2xl overflow-hidden rounded-[2.5rem] bg-[#8A9A8A]/5 border border-[#8A9A8A]/10 p-1.5 transition-all hover:bg-[#8A9A8A]/10 hover:border-[#8A9A8A]/20"
            >
              <div className="relative aspect-[21/9] w-full overflow-hidden rounded-[2.2rem] bg-[#E5E1DC]">
                {/* Stylized Map Placeholder - High End Look */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#8A9A8A] shadow-lg transition-transform duration-500">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <p className="font-serif text-xl sm:text-2xl font-bold tracking-tighter text-[#2A2A2A] uppercase">
                      Découvrez Dermadoc
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-[#8A9A8A]">{clinic.location}</p>
                  </div>
                  {/* Abstract Grid Overlay */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#8A9A8A 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />
                </div>
              </div>
            </a>
          </div>

          <p className="text-[10px] uppercase tracking-[0.4em] text-[#A0A0A0]">
            &copy; {new Date().getFullYear()} Dermadoc Clinic.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Website;
