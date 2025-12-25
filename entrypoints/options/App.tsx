import { ShadowProvider } from '@/integrations/shadow/ShadowProvider'
import { ThemeProvider } from '@/integrations/theme/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OptionsContent } from './OptionsContent'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

export function App(props: { container: HTMLElement }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ShadowProvider container={props.container}>
        <ThemeProvider>
          <Toaster richColors={true} closeButton={true} />
          <OptionsContent />
        </ThemeProvider>
      </ShadowProvider>
    </QueryClientProvider>
  )
}
