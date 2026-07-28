import { Link } from "@tanstack/react-router"
import { HouseIcon, PhoneOffIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function NotFoundPage() {
    return (
        <div className="flex min-h-svh items-center justify-center p-6">
            <Card className="w-full max-w-sm">
                <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <PhoneOffIcon className="size-5" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <h1 className="text-sm font-semibold">
                            Ramal não encontrado
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            A página que você tentou discar não existe ou foi
                            movida.
                        </p>
                    </div>

                    <Link
                        to="/"
                        className={buttonVariants({ className: "w-full" })}
                    >
                        <HouseIcon />
                        Voltar ao início
                    </Link>
                </CardContent>
            </Card>
        </div>
    )
}
