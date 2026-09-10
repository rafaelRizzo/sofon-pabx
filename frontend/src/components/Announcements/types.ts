import { type Announcement, type AnnouncementForm } from "@/hooks/use-announcements"

export type AnnouncementFormDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    announcement: Announcement | null
    // true enquanto o registro ainda está sendo buscado por id (ver EditNodeDialog) - nesse caso
    // `announcement` também é null, mas não significa "criação": mostra skeleton em vez do form
    loading?: boolean
    companyId: string
    onSave: (form: AnnouncementForm) => Promise<boolean>
    onDelete?: () => void
}

export type AnnouncementsTableProps = {
    announcements: Announcement[]
    loading: boolean
    companySelected: boolean
    onPlay: (announcement: Announcement) => void
    onEdit: (announcement: Announcement) => void
    onDelete: (announcement: Announcement) => void
}
