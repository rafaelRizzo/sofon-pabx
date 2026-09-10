import {
    type RouteDestination,
    type RouteDestinationType,
} from "@/components/RouteDestination/route-destination-field"

export type RouteDestinationFieldProps = {
    value: RouteDestination
    onChange: (destination: RouteDestination) => void
    companyId: string
    className?: string
    allowedTypes?: readonly RouteDestinationType[]
}
