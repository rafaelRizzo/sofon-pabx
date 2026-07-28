import { useState } from "react"
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { toast } from "sonner"

import { apiError } from "@/lib/api"

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                // mutations já tratam seu próprio erro (toast.loading -> success/error) em cada
                // hook, então esse handler cobre só queries: hoje uma falha de carregamento
                // (useQuery) não mostra nada pro usuário, só falha silenciosa
                queryCache: new QueryCache({
                    onError: (error, query) => {
                        if (query.meta?.suppressErrorToast) return
                        toast.error(apiError(error, "Erro ao carregar dados"))
                    },
                }),
                defaultOptions: {
                    queries: {
                        retry: false,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    )

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {import.meta.env.DEV && (
                <ReactQueryDevtools
                    initialIsOpen={false}
                    buttonPosition="bottom-left"
                />
            )}
        </QueryClientProvider>
    )
}
