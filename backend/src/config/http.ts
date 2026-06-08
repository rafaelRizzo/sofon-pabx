import axios from 'axios'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT || '10000', 10)

export const httpClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json',
    },
})
