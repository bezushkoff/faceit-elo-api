import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).send('No nickname provided');
  }

  const apiKey = process.env.FACEIT_KEY;
  if (!apiKey) return res.status(500).send('FACEIT_KEY not set');

  try {
    // 1️⃣ Получаем данные игрока
    const playerRes = await fetch(`https://open.faceit.com/data/v4/players?nickname=${nick}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!playerRes.ok) return res.status(404).send('Player not found');
    const playerData: any = await playerRes.json();
    const cs = playerData.games?.cs2 || playerData.games?.csgo;
    if (!cs) return res.status(404).send('CS game not found');

    const playerId = playerData.player_id;
    const currentElo = cs.faceit_elo;

    // 2️⃣ Получаем последние 10 матчей
    const historyRes = await fetch(`https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&limit=10`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const historyData: any = await historyRes.json();
    const matches: any[] = historyData.items || [];

    const today = new Date().toISOString().split('T')[0];
    let win = 0, lose = 0, eloDiff = 0;

    for (const match of matches) {
      if (!match.finished_at || !match.match_id) continue;

      const matchDate = new Date(match.finished_at * 1000).toISOString().split('T')[0];
      if (matchDate !== today) continue;

      try {
        const statsRes = await fetch(`https://open.faceit.com/data/v4/matches/${match.match_id}/stats`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!statsRes.ok) continue;

        const statsData: any = await statsRes.json();
        const teams: any[] = statsData.teams || [];
        const players: any[] = teams.flatMap(t => t.players || []);
        const me: any = players.find(p => p.player_id === playerId);
        if (!me || !me.player_stats) continue;

        const result = me.player_stats.Result;
        const before = Number(me.player_stats.Elo_Before || 0);
        const after = Number(me.player_stats.Elo_After || 0);

        if (result === '1') win++;
        else if (result === '0') lose++;

        eloDiff += after - before;
      } catch {
        continue;
      }
    }

    const eloDiffFormatted = eloDiff > 0 ? `+${eloDiff}` : `${eloDiff}`;
    const output = `Elo: ${currentElo} | Today → Win: ${win} Lose: ${lose} Elo: ${eloDiffFormatted}`;

    return res.status(200).send(output);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
}
