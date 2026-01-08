import type { CreateUserDTO, UpdateUserDTO } from "../../routes/user/schema/user.schema"

// Simulando um banco de dados em memória
const users: Array<{ id: string; name: string; email: string }> = []

export class UserService {
  static async list() {
    return users
  }

  static async create(data: CreateUserDTO) {
    const user = {
      id: crypto.randomUUID(),
      ...data,
    }
    users.push(user)
    return user
  }

  static async getById(id: string) {
    return users.find(user => user.id === id) || null
  }

  static async update(id: string, data: UpdateUserDTO) {
    const user = users.find(u => u.id === id)
    if (!user) return null

    // Garante que apenas name e email sejam atualizados
    if (data.name) user.name = data.name
    if (data.email) user.email = data.email

    return user
  }

  static async delete(id: string) {
    const index = users.findIndex(user => user.id === id)
    if (index === -1) return false

    users.splice(index, 1)
    return true
  }
}