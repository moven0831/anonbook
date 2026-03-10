import BetterSqlite3 from 'better-sqlite3'

export interface Identity {
    agentName: string
    encryptedIdentity: string
    identityCommitment: string
    createdAt: string
}

export interface Post {
    id: number
    title: string
    content: string
    tier: string
    timestamp: string
    proofHash: string
    publicSignals: string
    proof: string
}

export interface PostInput {
    title: string
    content: string
    tier: string
    proofHash: string
    publicSignals: string
    proof: string
}

export interface GetPostsOptions {
    limit: number
    cursor?: number
    tier?: string
}

export interface Database {
    saveIdentity(
        agentName: string,
        encryptedIdentity: string,
        identityCommitment: string
    ): void
    getIdentity(agentName: string): Identity | null
    savePost(post: PostInput): number
    getPosts(options: GetPostsOptions): Post[]
}

export function createDb(dbPath: string): Database {
    const db = new BetterSqlite3(dbPath)
    db.pragma('journal_mode = WAL')

    // Create tables — never joined (privacy boundary)
    db.exec(`
    CREATE TABLE IF NOT EXISTS identities (
      agentName TEXT PRIMARY KEY,
      encryptedIdentity TEXT NOT NULL,
      identityCommitment TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

    db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tier TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      proofHash TEXT NOT NULL,
      publicSignals TEXT NOT NULL,
      proof TEXT NOT NULL
    )
  `)

    const insertIdentity = db.prepare(
        'INSERT INTO identities (agentName, encryptedIdentity, identityCommitment) VALUES (?, ?, ?)'
    )

    const selectIdentity = db.prepare(
        'SELECT * FROM identities WHERE agentName = ?'
    )

    const insertPost = db.prepare(
        'INSERT INTO posts (title, content, tier, proofHash, publicSignals, proof) VALUES (?, ?, ?, ?, ?, ?)'
    )

    return {
        saveIdentity(agentName, encryptedIdentity, identityCommitment) {
            insertIdentity.run(agentName, encryptedIdentity, identityCommitment)
        },

        getIdentity(agentName) {
            return (selectIdentity.get(agentName) as Identity) ?? null
        },

        savePost(post) {
            const result = insertPost.run(
                post.title,
                post.content,
                post.tier,
                post.proofHash,
                post.publicSignals,
                post.proof
            )
            return Number(result.lastInsertRowid)
        },

        getPosts({ limit, cursor, tier }) {
            let sql = 'SELECT * FROM posts'
            const params: any[] = []
            const conditions: string[] = []

            if (cursor) {
                conditions.push('id < ?')
                params.push(cursor)
            }
            if (tier) {
                conditions.push('tier = ?')
                params.push(tier)
            }
            if (conditions.length) {
                sql += ' WHERE ' + conditions.join(' AND ')
            }
            sql += ' ORDER BY id DESC LIMIT ?'
            params.push(limit)

            return db.prepare(sql).all(...params) as Post[]
        },
    }
}
