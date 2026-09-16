'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Mail, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import type { Tag } from '@/types';

type ChannelType = 'email' | 'sms';

interface ChannelCampaignPageProps {
  channel: ChannelType;
  title: string;
  subtitle: string;
  subjectLabel: string;
  placeholderSubject: string;
  placeholderMessage: string;
}

export function ChannelCampaignPage({
  channel,
  title,
  subtitle,
  subjectLabel,
  placeholderSubject,
  placeholderMessage,
}: ChannelCampaignPageProps) {
  const router = useRouter();
  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [previewRecipients, setPreviewRecipients] = useState<Array<{ name: string; value: string }>>([]);
  const [allRecipients, setAllRecipients] = useState<Array<{ name: string; value: string }>>([]);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [sending, setSending] = useState(false);
  const [lastSentLabel, setLastSentLabel] = useState<string | null>(null);

  const icon = useMemo(
    () =>
      channel === 'email' ? (
        <Mail className="h-5 w-5 text-emerald-500" />
      ) : (
        <Smartphone className="h-5 w-5 text-sky-500" />
      ),
    [channel],
  );

  useEffect(() => {
    const defaults = {
      email: {
        name: 'Campaña por Email',
        subject: 'Novedades de Andalabot',
        message:
          'Hola {{name}}, te compartimos información importante sobre nuestra nueva oferta y novedades del mes.',
      },
      sms: {
        name: 'Campaña por SMS',
        subject: '',
        message:
          'Hola {{name}}, este es un mensaje de ejemplo para tu campaña de SMS de Andalabot.',
      },
    } as const;

    const values = defaults[channel];
    setCampaignName(values.name);
    setCampaignSubject(values.subject);
    setCampaignMessage(values.message);
  }, [channel]);

  useEffect(() => {
    async function fetchTags() {
      const supabase = createClient();
      const { data } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });
      setAvailableTags(data ?? []);
    }

    fetchTags();
  }, []);

  async function handleSendCampaign() {
    const recipients = allRecipients.length > 0 ? allRecipients : previewRecipients;

    if (!recipients.length) {
      toast.error('No hay destinatarios disponibles para enviar la campaña.');
      return;
    }

    if (channel === 'email' && !campaignSubject.trim()) {
      toast.error('Agrega un asunto antes de enviar la campaña por email.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        channel,
        recipients: recipients.map((recipient) => recipient.value),
        subject: campaignSubject,
        message: campaignMessage,
      };

      const res = await fetch('/api/broadcasts/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo enviar la campaña.');
      }

      const stamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSentLabel(stamp);
      toast.success(
        channel === 'email'
          ? `Campaña de email enviada a ${recipients.length} contactos.`
          : `Campaña de SMS enviada a ${recipients.length} contactos.`,
      );
    } catch (error) {
      console.error('[ChannelCampaignPage] send campaign failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'No se pudo enviar la campaña.',
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    async function fetchRecipients() {
      const supabase = createClient();
      let query = supabase
        .from('contacts')
        .select('id, name, email, phone', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (selectedTagIds.length > 0) {
        const { data: tagged } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', selectedTagIds);

        const contactIds = Array.from(
          new Set((tagged ?? []).map((row) => row.contact_id)),
        );

        if (contactIds.length === 0) {
          setPreviewRecipients([]);
          setTotalRecipients(0);
          return;
        }

        query = query.in('id', contactIds);
      }

      if (channel === 'email') {
        query = query.not('email', 'is', null).neq('email', '');
      } else {
        query = query.not('phone', 'is', null).neq('phone', '');
      }

      const { data, count } = await query;
      const mapped = (data ?? []).map((contact) => ({
        name: contact.name || 'Sin nombre',
        value:
          channel === 'email'
            ? contact.email || 'Sin email'
            : contact.phone || 'Sin teléfono',
      }));

      setAllRecipients(mapped);
      setPreviewRecipients(mapped.slice(0, 8));
      setTotalRecipients(count ?? mapped.length);
    }

    fetchRecipients();
  }, [channel, selectedTagIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => router.push('/broadcasts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-muted p-2">{icon}</div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border bg-card/80">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Ejemplo de campaña conectada a contactos actuales del CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Destinatarios</div>
              <div className="mt-2 text-3xl font-bold text-foreground">{totalRecipients}</div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Canal</div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                {icon}
                <span>{channel === 'email' ? 'Email' : 'SMS'}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Estado</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-amber-500">
                <CheckCircle2 className="h-4 w-4" />
                {lastSentLabel ? `Enviado a las ${lastSentLabel}` : 'Listo para enviar'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Segmentación</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'tagged', label: 'Etiquetas' },
              ].map((option) => {
                const active = selectedTagIds.length === 0 && option.value === 'all';
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (option.value === 'all') {
                        setSelectedTagIds([]);
                        return;
                      }
                      setSelectedTagIds((prev) => (prev.length > 0 ? [] : prev));
                    }}
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

          {availableTags.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Etiquetas</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
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
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nombre de la campaña</label>
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </div>

          {channel === 'email' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{subjectLabel}</label>
              <Input
                value={campaignSubject}
                onChange={(e) => setCampaignSubject(e.target.value)}
                placeholder={placeholderSubject}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Mensaje</label>
            <Textarea
              value={campaignMessage}
              onChange={(e) => setCampaignMessage(e.target.value)}
              rows={7}
              placeholder={placeholderMessage}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Vista previa</label>
              <span className="text-xs text-muted-foreground">{previewRecipients.length} contactos</span>
            </div>
            <div className="max-h-52 space-y-2 overflow-auto rounded-lg border border-border bg-muted/20 p-2">
              {previewRecipients.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay destinatarios para esta configuración.</p>
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push('/broadcasts')}>
              Volver
            </Button>
            <Button variant="secondary" disabled>
              Guardar borrador
            </Button>
            <Button onClick={handleSendCampaign} disabled={sending || (allRecipients.length === 0 && previewRecipients.length === 0)}>
              {sending ? 'Enviando...' : 'Enviar campaña'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
