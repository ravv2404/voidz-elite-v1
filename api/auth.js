export default async function handler(req, res) {
    // 1. Konfigurasi Awal
    const BIN_ID = "69488300ae596e708fa93e3d";
    const MASTER_KEY = process.env.JSONBIN_KEY; 

    // Header Keamanan & CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ msg: "Gunakan POST, babi!" });

    if (!MASTER_KEY) return res.status(500).json({ success: false, msg: "ENV_KEY_MISSING" });

    try {
        // 2. Ambil Data dari JSONBin
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { "X-Master-Key": MASTER_KEY, "X-Bin-Meta": "false" }
        });

        if (!response.ok) return res.status(500).json({ success: false, msg: "JSONBIN_ERROR" });
        
        let db = await response.json();
        const { action, username, password, newData } = req.body;

        // 3. FITUR AUTO-NUKE (Hapus user expired tiap ada request)
        const now = Date.now();
        let changed = false;
        for (const u in db) {
            if (db[u].role !== "owner" && db[u].exp !== "LIFETIME" && now > db[u].exp) {
                delete db[u];
                changed = true;
            }
        }

        // 4. LOGIKA: LOGIN
        if (action === 'login') {
            if (changed) { // Update DB jika ada yang di-nuke
                await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
                    method: 'PUT',
                    headers: { "Content-Type": "application/json", "X-Master-Key": MASTER_KEY },
                    body: JSON.stringify(db)
                });
            }

            const user = db[username];
            if (user && user.pw === password) {
                return res.status(200).json({ success: true, user: { name: username, ...user }, fullDB: db });
            }
            return res.status(401).json({ success: false, msg: "ID/KEY SALAH" });
        }

        // 5. LOGIKA: UPDATE (GENERATE/DELETE)
        if (action === 'update') {
            const updateRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
                method: 'PUT',
                headers: { "Content-Type": "application/json", "X-Master-Key": MASTER_KEY },
                body: JSON.stringify(newData)
            });
            if (updateRes.ok) return res.status(200).json({ success: true });
            return res.status(500).json({ success: false, msg: "UPDATE_FAILED" });
        }

    } catch (e) {
        return res.status(500).json({ success: false, msg: e.message });
    }
    }
