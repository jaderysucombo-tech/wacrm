'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Radio,
  Plus,
  Loader2,
  Mail,
  MessageSquareText,
  Smartphone,
} from 'lucide-react';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { getBroadcastStatus } from '@/lib/broadcast-status';
import { getContactChannelStats } from '@/lib/broadcast-channels';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Poll cadence while any broadcast is sending. Kept modest so we don't
 * beat on Supabase — the aggregate trigger in migration 003 keeps
 * counts consistent; we just need to surface the freshest snapshot.
 */
const POLL_INTERVAL_MS = 5_000;

function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  /** Tailwind bg class for the fill, e.g. "bg-primary" */
  color: string;
}) {
  const pct = percent(value, total);
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {pct}%
      </span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const router = useRouter();
  const t = useTranslations('Broadcasts.page');
  const tStatus = useTranslations('Broadcasts.status');
  const canCreate = useCan('send-messages');
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactStats, setContactStats] = useState({
    totalContacts: 0,
    contactsWithEmail: 0,
    contactsWithPhone: 0,
  });
  const [channelModal, setChannelModal] = useState<
    'whatsapp' | 'email' | 'sms' | null
  >(null);
  const [segmentMode, setSegmentMode] = useState<
    'all' | 'tagged' | 'missing-email' | 'missing-phone'
  >('all');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [previewRecipients, setPreviewRecipients] = useState<
    Array<{ name: string; value: string }>
  >([]);
  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');

  // Used to kick off polling only while something is actively sending.
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchContactStats() {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('contacts')
        .select('email, phone');

      if (fetchError) throw fetchError;
      setContactStats(getContactChannelStats(data ?? []));
    } catch {
      setContactStats({ totalContacts: 0, contactsWithEmail: 0, contactsWithPhone: 0 });
    }
  }

  async function fetchBroadcasts() {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBroadcasts(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBroadcasts();
    fetchContactStats();
  }, []);

  useEffect(() => {
    if (!channelModal) {
      setCampaignName('');
      setCampaignSubject('');
      setCampaignMessage('');
      setSelectedTagIds([]);
      setSegmentMode('all');
      setPreviewRecipients([]);
      return;
    }

    const channelDefaults = {
      whatsapp: {
        name: 'Campaña de WhatsApp',
        subject: '',
        message:
          'Hola {{name}}, te informamos sobre nuestra nueva promoción y queremos mantenernos en contacto.',
      },
      email: {
        name: 'Campaña de Email',
        subject: 'Novedades de Andalabot',
        message:
          'Hola {{name}}, te compartimos información importante sobre nuestros servicios y promociones actuales.',
      },
      sms: {
        name: 'Campaña de SMS',
        subject: '',
        message:
          'Hola {{name}}, este es un mensaje de ejemplo para tu campaña de SMS.',
      },
    } as const;

    const defaults = channelDefaults[channelModal];
    setCampaignName(defaults.name);
    setCampaignSubject(defaults.subject);
    setCampaignMessage(defaults.message);
    setSelectedTagIds([]);
    setSegmentMode('all');

    async function loadChannelAudience() {
      const supabase = createClient();
      const { data: tagsData } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });
      setAvailableTags(tagsData ?? []);

      let contactQuery = supabase
        .from('contacts')
        .select('id, name, email, phone')
        .order('created_at', { ascending: false })
        .limit(200);

      if (segmentMode === 'tagged') {
        const { data: taggedContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', selectedTagIds);

        const contactIds = Array.from(
          new Set((taggedContacts ?? []).map((row) => row.contact_id)),
        );

        if (contactIds.length === 0) {
          setPreviewRecipients([]);
          return;
        }

        contactQuery = contactQuery.in('id', contactIds);
      }

      if (segmentMode === 'missing-email' && channelModal === 'email') {
        contactQuery = contactQuery.or('email.is.null,email.eq.""');
      }

      if (segmentMode === 'missing-phone' && (channelModal === 'sms' || channelModal === 'whatsapp')) {
        contactQuery = contactQuery.or('phone.is.null,phone.eq.""');
      }

      if (channelModal === 'email' && segmentMode === 'all') {
        contactQuery = contactQuery.not('email', 'is', null).neq('email', '');
      }

      if ((channelModal === 'sms' || channelModal === 'whatsapp') && segmentMode === 'all') {
        contactQuery = contactQuery.not('phone', 'is', null).neq('phone', '');
      }

      const { data: contacts } = await contactQuery;
      const mapped = (contacts ?? [])
        .slice(0, 5)
        .map((contact) => ({
          name: contact.name || 'Sin nombre',
          value:
            channelModal === 'email'
              ? contact.email || 'Sin email'
              : contact.phone || 'Sin teléfono',
        }));

      setPreviewRecipients(mapped);
    }

    loadChannelAudience();
  }, [channelModal]);

  useEffect(() => {
    if (!channelModal) return;

    async function updatePreview() {
      const supabase = createClient();
      let contactQuery = supabase
        .from('contacts')
        .select('id, name, email, phone', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (segmentMode === 'tagged') {
        const { data: taggedContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', selectedTagIds);

        const contactIds = Array.from(
          new Set((taggedContacts ?? []).map((row) => row.contact_id)),
        );

        if (contactIds.length === 0) {
          setPreviewRecipients([]);
          return;
        }

        contactQuery = contactQuery.in('id', contactIds);
      }

      if (segmentMode === 'missing-email' && channelModal === 'email') {
        contactQuery = contactQuery.or('email.is.null,email.eq.""');
      }

      if (segmentMode === 'missing-phone' && (channelModal === 'sms' || channelModal === 'whatsapp')) {
        contactQuery = contactQuery.or('phone.is.null,phone.eq.""');
      }

      if (channelModal === 'email' && segmentMode === 'all') {
        contactQuery = contactQuery.not('email', 'is', null).neq('email', '');
      }

      if ((channelModal === 'sms' || channelModal === 'whatsapp') && segmentMode === 'all') {
        contactQuery = contactQuery.not('phone', 'is', null).neq('phone', '');
      }

      const { data: contacts, count } = await contactQuery;

      const mapped = (contacts ?? [])
        .slice(0, 5)
        .map((contact) => ({
          name: contact.name || 'Sin nombre',
          value:
            channelModal === 'email'
              ? contact.email || 'Sin email'
              : contact.phone || 'Sin teléfono',
        }));

      setPreviewRecipients(mapped);
      if (typeof count === 'number') {
        if (channelModal === 'email') {
          setContactStats((prev) => ({ ...prev, contactsWithEmail: count }));
        } else {
          setContactStats((prev) => ({ ...prev, contactsWithPhone: count }));
        }
      }
    }

    updatePreview();
  }, [channelModal, segmentMode, selectedTagIds]);

  const anySending = useMemo(
    () => broadcasts.some((b) => b.status === 'sending'),
    [broadcasts],
  );

  useEffect(() => {
    function startPolling() {
      if (pollTimer.current) return;
      pollTimer.current = setInterval(fetchBroadcasts, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (!pollTimer.current) return;
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }

    // Pause polling while the tab is hidden — keeps Supabase cold when
    // the user is away, and ensures a fresh fetch the moment they
    // refocus so they don't see stale data on return.
    function handleVisibilityChange() {
      if (!anySending) return;
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchBroadcasts();
        startPolling();
      }
    }

    if (anySending && document.visibilityState === 'visible') {
      startPolling();
    } else {
      stopPolling();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [anySending]);

  const modalAudienceCount =
    previewRecipients.length > 0 || selectedTagIds.length > 0
      ? Math.max(
          previewRecipients.length,
          channelModal === 'email'
            ? contactStats.contactsWithEmail
            : contactStats.contactsWithPhone,
        )
      : channelModal === 'email'
        ? contactStats.contactsWithEmail
        : contactStats.contactsWithPhone;

  const modalTitle =
    channelModal === 'email'
      ? 'Difusión por Email'
      : channelModal === 'sms'
        ? 'Difusión por SMS'
        : 'Difusión por WhatsApp';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top indeterminate progress bar: only visible while a broadcast
          is mid-send. Pure CSS animation so no extra deps. */}
      {anySending && (
        <div
          role="progressbar"
          aria-label={t('broadcastInProgress')}
          className="broadcast-indeterminate fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-muted"
        >
          <div className="broadcast-indeterminate-bar h-0.5 bg-primary" />
          <style jsx>{`
            .broadcast-indeterminate-bar {
              width: 33%;
              transform: translateX(-100%);
              animation: broadcast-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1)
                infinite;
            }
            @keyframes broadcast-slide {
              0% {
                transform: translateX(-100%);
              }
              100% {
                transform: translateX(400%);
              }
            }
          `}</style>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <GatedButton
          canAct={canCreate}
          gateReason="create broadcasts"
          onClick={() => router.push('/broadcasts/new')}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t('newBroadcast')}
        </GatedButton>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Radio className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">WhatsApp</CardTitle>
                </div>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                Activo
              </span>
            </div>
            <CardDescription>Usando contactos actuales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="text-3xl font-bold text-foreground">
              {contactStats.contactsWithPhone}
            </div>
            <div className="text-sm text-muted-foreground">
              contactos con WhatsApp listo para difundir
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/broadcasts/whatsapp')}
            >
              Crear difusión
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Difusión por Email</CardTitle>
              </div>
            </div>
            <CardDescription>Canal activo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="text-3xl font-bold text-foreground">
              {contactStats.contactsWithEmail}
            </div>
            <div className="text-sm text-muted-foreground">
              contactos con correo disponible para campaña por email
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push('/broadcasts/email')}
            >
              Crear difusión
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-sky-500/10 p-2 text-sky-500">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Difusión por SMS</CardTitle>
              </div>
            </div>
            <CardDescription>Canal activo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="text-3xl font-bold text-foreground">
              {contactStats.contactsWithPhone}
            </div>
            <div className="text-sm text-muted-foreground">
              contactos con teléfono disponible para campaña por SMS
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push('/broadcasts/sms')}
            >
              Crear difusión
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
          <span>
            Módulos conectados a los contactos actuales del CRM y listos para campañas reales por WhatsApp, Email y SMS.
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push('/broadcasts/summary')}>
          Ver resumen
        </Button>
      </div>

      <Dialog open={channelModal !== null} onOpenChange={(open) => !open && setChannelModal(null)}>
        <DialogContent className="border-border bg-popover sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              Ejemplo de campaña sin envío real. Se usa la base actual de contactos del CRM.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Destinatarios</span>
                <span className="font-semibold text-foreground">{modalAudienceCount}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Segmentación</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'tagged', label: 'Etiquetas' },
                  {
                    value: 'missing-email',
                    label: channelModal === 'email' ? 'Sin email' : 'Sin email',
                  },
                  {
                    value: 'missing-phone',
                    label: channelModal === 'sms' || channelModal === 'whatsapp' ? 'Sin teléfono' : 'Sin teléfono',
                  },
                ].map((option) => {
                  const active = segmentMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSegmentMode(option.value as typeof segmentMode)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {segmentMode === 'tagged' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Etiquetas</label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No hay etiquetas disponibles.
                    </span>
                  ) : (
                    availableTags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setSelectedTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id],
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            selected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {tag.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nombre de la campaña</label>
              <Input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Nombre del envío"
              />
            </div>

            {channelModal !== 'sms' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {channelModal === 'email' ? 'Asunto del email' : 'Título del mensaje'}
                </label>
                <Input
                  value={campaignSubject}
                  onChange={(event) => setCampaignSubject(event.target.value)}
                  placeholder={
                    channelModal === 'email'
                      ? 'Novedades de Andalabot'
                      : 'Actualización importante'
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mensaje</label>
              <Textarea
                value={campaignMessage}
                onChange={(event) => setCampaignMessage(event.target.value)}
                rows={6}
                placeholder={
                  channelModal === 'email'
                    ? 'Escribe el contenido del correo...' 
                    : channelModal === 'sms'
                      ? 'Escribe el texto del SMS...' 
                      : 'Escribe el mensaje de WhatsApp...'
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-foreground">Vista previa</label>
                <span className="text-xs text-muted-foreground">
                  {previewRecipients.length} contactos
                </span>
              </div>

              <div className="max-h-40 space-y-2 overflow-auto rounded-lg border border-border bg-muted/20 p-2">
                {previewRecipients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay destinatarios para esta combinación.
                  </p>
                ) : (
                  previewRecipients.map((recipient, index) => (
                    <div
                      key={`${recipient.name}-${recipient.value}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs"
                    >
                      <span className="font-medium text-foreground">{recipient.name}</span>
                      <span className="truncate text-muted-foreground">{recipient.value}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelModal(null)}>
              Cancelar
            </Button>
            <Button variant="secondary" disabled>
              Guardar borrador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {broadcasts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card">
          <Radio className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t('noBroadcastsYet')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('createFirst')}
          </p>
          <GatedButton
            canAct={canCreate}
            gateReason="create broadcasts"
            onClick={() => router.push('/broadcasts/new')}
            className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('newBroadcast')}
          </GatedButton>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">{t('table.name')}</TableHead>
                <TableHead className="hidden text-muted-foreground md:table-cell">{t('table.template')}</TableHead>
                <TableHead className="hidden text-right text-muted-foreground sm:table-cell">
                  {t('table.recipients')}
                </TableHead>
                <TableHead className="hidden text-muted-foreground lg:table-cell">{t('table.delivery')}</TableHead>
                <TableHead className="hidden text-muted-foreground lg:table-cell">{t('table.read')}</TableHead>
                <TableHead className="text-muted-foreground">{t('table.status')}</TableHead>
                <TableHead className="hidden text-muted-foreground sm:table-cell">{t('table.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((broadcast) => {
                const status = getBroadcastStatus(broadcast.status);
                return (
                  <TableRow
                    key={broadcast.id}
                    className="cursor-pointer border-border hover:bg-muted/50"
                    onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                  >
                    <TableCell className="font-medium text-foreground">
                      {broadcast.name}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {broadcast.template_name}
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                      {broadcast.total_recipients}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.delivered_count}
                        total={broadcast.total_recipients}
                        color="bg-primary"
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.read_count}
                        total={broadcast.total_recipients}
                        color="bg-blue-500"
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                      >
                        {status.pulse && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                          </span>
                        )}
                        {tStatus(status.label)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {new Date(broadcast.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
