import { config as dotenvConfig } from 'dotenv'
import path from 'path'
dotenvConfig()

export const UNIREP_ADDRESS = process.env.UNIREP_ADDRESS
export const APP_ADDRESS = process.env.APP_ADDRESS
export const ETH_PROVIDER_URL = process.env.ETH_PROVIDER_URL
export const PRIVATE_KEY = process.env.PRIVATE_KEY

export const DB_PATH = process.env.DB_PATH ?? ':memory:'

export const config = {
    // Chain
    provider: process.env.ETH_PROVIDER_URL || 'http://localhost:8545',
    privateKey:
        process.env.PRIVATE_KEY ||
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',

    // Contracts (set after deploy)
    unirepAddress: process.env.UNIREP_ADDRESS || '',
    karmaBridgeAddress: process.env.KARMA_BRIDGE_ADDRESS || '',

    // Database
    dbPath:
        process.env.DB_PATH || path.join(__dirname, '..', 'anonbook.db'),

    // Server
    port: parseInt(process.env.PORT || '3000'),

    // Identity encryption key
    encryptionKey:
        process.env.ENCRYPTION_KEY || 'dev-key-change-in-production',
}
