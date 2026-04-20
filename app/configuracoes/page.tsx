import { RiSettings3Line } from "@remixicon/react"
import { PlaceholderView } from "@/components/placeholder-view"

export default function ConfiguracoesPage() {
  return (
    <PlaceholderView
      breadcrumb="/configuracoes"
      title="Configurações"
      icon={RiSettings3Line}
      description="API keys, preferências de geração e tema — em breve."
    />
  )
}
