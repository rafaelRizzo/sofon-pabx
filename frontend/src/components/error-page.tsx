import { Link } from "@tanstack/react-router"
import { HouseIcon, RefreshCwIcon, ServerCrashIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
import { Card, CardContent } from "@/components/ui/card"

const CHUNK_LOAD_ERROR_PATTERN =
    /fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i

export function ErrorPage({
    error,
    reset,
}: {
    error: unknown
    reset?: () => void
}) {
    const message = error instanceof Error ? error.message : String(error)
    const isChunkLoadError = CHUNK_LOAD_ERROR_PATTERN.test(message)

    return (
        <div className="flex min-h-svh items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <ServerCrashIcon className="size-5" />
                    </div>

                    {isChunkLoadError ? (
                        <div className="flex flex-col gap-1">
                            <h1 className="text-sm font-semibold">
                                Nova versão disponível
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                O painel foi atualizado e essa página ficou
                                desatualizada. Recarregue pra continuar.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <h1 className="text-sm font-semibold">
                                Algo deu errado
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Não foi possível carregar esta página. Tente
                                novamente ou volte ao início.
                            </p>
                        </div>
                    )}

                    <div className="flex w-full gap-2">
                        {isChunkLoadError ? (
                            <Button
                                className="flex-1"
                                onClick={() => window.location.reload()}
                            >
                                <RefreshCwIcon />
                                Recarregar página
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => reset?.()}
                                >
                                    <RefreshCwIcon />
                                    Tentar novamente
                                </Button>
                                <Link
                                    to="/"
                                    className={buttonVariants({
                                        className: "flex-1",
                                    })}
                                >
                                    <HouseIcon />
                                    Início
                                </Link>
                            </>
                        )}
                    </div>

                    {!isChunkLoadError && (
                        <details className="group w-full text-left">
                            <summary className="cursor-pointer text-[0.6875rem] text-muted-foreground select-none hover:text-foreground">
                                Detalhes técnicos
                            </summary>
                            <pre className="mt-2 max-h-32 overflow-auto rounded-md border border-border/70 bg-muted/40 p-2 text-[0.6875rem] text-destructive">
                                <code>{message}</code>
                            </pre>
                        </details>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
