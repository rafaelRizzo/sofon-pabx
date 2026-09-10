import { type Company } from "@/hooks/use-companies"
import { type CreateUserForm, type User } from "@/hooks/use-users"

export type CompanySelectProps = {
    companies: Company[]
    value: string[]
    onChange: (companyIds: string[]) => void
    className?: string
}

export type UserFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: User | null
    onSave: (form: CreateUserForm) => Promise<boolean>
}

export type UsersTableProps = {
    users: User[]
    loading: boolean
    onEdit: (user: User) => void
    onDelete: (user: User) => void
}
