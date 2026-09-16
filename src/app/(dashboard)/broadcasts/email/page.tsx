import { ChannelCampaignPage } from '@/components/broadcasts/channel-campaign-page';

export default function BroadcastEmailPage() {
  return (
    <ChannelCampaignPage
      channel="email"
      title="Difusión por Email"
      subtitle="Ejemplo de campaña orientada a contactos con correo disponible."
      subjectLabel="Asunto del email"
      placeholderSubject="Novedades de Andalabot"
      placeholderMessage="Escribe el contenido del correo que quieres enviar a tus contactos..."
    />
  );
}
