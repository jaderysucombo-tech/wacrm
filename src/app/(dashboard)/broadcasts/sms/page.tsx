import { ChannelCampaignPage } from '@/components/broadcasts/channel-campaign-page';

export default function BroadcastSmsPage() {
  return (
    <ChannelCampaignPage
      channel="sms"
      title="Difusión por SMS"
      subtitle="Ejemplo de campaña orientada a contactos con teléfono disponible."
      subjectLabel="Título del SMS"
      placeholderSubject="Recordatorio importante"
      placeholderMessage="Escribe el texto del mensaje SMS que quieres enviar a tus contactos..."
    />
  );
}
