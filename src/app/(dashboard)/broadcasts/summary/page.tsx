'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, Mail, MessageSquareText, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { getContactChannelStats } from '@/lib/broadcast-channels';

export default function BroadcastSummaryPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalContacts: 0,
    contactsWithEmail: 0,
    contactsWithPhone: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      const { data } = await supabase.from('contacts').select('email, phone');
      setStats(getContactChannelStats(data ?? []));
    }

    fetchStats();
  }, []);

  const channels = [
    {
      name: 'WhatsApp',
      count: stats.contactsWithPhone,
      icon: MessageSquareText,
      tint: 'text-primary bg-primary/10',
      note: 'Comunicaciones directas y masivas',
    },
    {
      name: 'Email',
      count: stats.contactsWithEmail,
      icon: Mail,
      tint: 'text-emerald-500 bg-emerald-500/10',
      note: 'Campañas con correos disponibles',
    },
    {
      name: 'SMS',
      count: stats.contactsWithPhone,
      icon: Smartphone,
      tint: 'text-sky-500 bg-sky-500/10',
      note: 'Mensajes cortos para contacto móvil',
    },
  ];

  const draftCampaigns = [
    { channel: 'WhatsApp', status: 'Activo', accent: 'text-primary' },
    { channel: 'Email', status: 'Ejemplo', accent: 'text-emerald-500' },
    { channel: 'SMS', status: 'Ejemplo', accent: 'text-sky-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => router.push('/broadcasts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-muted p-2">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Resumen de campañas</h1>
              <p className="text-sm text-muted-foreground">Vista general por canal de envío</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {channels.map(({ name, count, icon: Icon, tint, note }) => (
          <Card key={name} className="border-border bg-card/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-2 ${tint}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">{name}</CardTitle>
                </div>
              </div>
              <CardDescription>{note}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-foreground">{count}</div>
              <p className="mt-1 text-sm text-muted-foreground">contactos elegibles</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card/80">
        <CardHeader>
          <CardTitle>Estado del canal</CardTitle>
          <CardDescription>Previsualización general de los módulos activos</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {draftCampaigns.map(({ channel, status, accent }) => (
              <div
                key={channel}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-foreground">{channel}</p>
                  <p className="text-xs text-muted-foreground">Conectado a contactos actuales</p>
                </div>
                <span className={`text-xs font-medium ${accent}`}>{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
