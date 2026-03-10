import crypto from 'crypto'

const MOLTBOOK_BASE_URL = 'https://www.moltbook.com/api/v1'

export interface MoltbookAgent {
    name: string
    karma: number
    description: string
}

/**
 * Dev mode: when no MOLTBOOK_BOT_API_KEY is set in env, return a stub agent
 * derived from the provided API key string. This lets the full stack
 * work end-to-end without a real Moltbook account.
 */
function devAgent(apiKey: string): MoltbookAgent {
    const hash = crypto
        .createHash('sha256')
        .update(apiKey)
        .digest('hex')
        .slice(0, 8)
    return {
        name: `dev-agent-${hash}`,
        karma: 100,
        description: 'Dev mode stub agent',
    }
}

export async function getAgent(apiKey: string): Promise<MoltbookAgent> {
    // Dev mode: no real Moltbook API key configured
    if (!process.env.MOLTBOOK_BOT_API_KEY) {
        return devAgent(apiKey)
    }

    const res = await fetch(`${MOLTBOOK_BASE_URL}/agents/me`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Moltbook API error: ${res.status}`)
    }

    const { data } = await res.json()
    return {
        name: data.name,
        karma: data.karma ?? 0,
        description: data.description ?? '',
    }
}
