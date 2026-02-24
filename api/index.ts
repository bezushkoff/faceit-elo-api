import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { nick } = req.query;

  if (!nick || typeof nick !== 'string') {
    return res.status(400).json({ error: 'No nickname provided' });
  }

  try {
    const apiKey = process.env.FACEIT_KEY;
    if (!apiKey) return res.status(500).json({ error: 'No FACEIT_KEY' });

    // 1️⃣ Получаем игрока
    const playerRes = await fetch(
      `https://open.faceit.com/data/v4/players?nickname=${nick}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!playerRes.ok) return res.status(404).json({ error: 'Player not found' });

    const playerData: any = await playerRes.json();
    const playerId: string = playerData.player_id;
    const currentElo: number = playerData.games?.cs2?.faceit_elo || 0;

    // 2️⃣ Получаем последние 20 матчей
    const matchesRes = await fetch(
      `https://open.faceit.com/data/v4/players/${playerId}/history?game=cs2&limit=20`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const matchesData: any = await matchesRes.json();
    const matches: any[] = matchesData.items || [];

    const todayDate = new Date().toISOString().split("T")[0];

    let win = 0;
    let lose = 0;
    let eloDiff = 0;

    for (const match of matches) {
      if (!match.finished_at || !match.match_id) continue;

      const matchDate = new Date(match.finished_at * 1000)
        .toISOString()
        .split("T")[0];

      if (matchDate !== todayDate) continue; // только сегодняшние

      try {
        const statsRes = await fetch(
          `https://open.faceit.com/data/v4/matches/${match.match_id}/stats`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );

        if (!statsRes.ok) continue;

        const statsData: any = await statsRes.json();
        const teams: any[] = statsData.teams || [];
        const players: any[] = teams.flatMap(team => team.players || []);
        const me: any = players.find(p => p.player_id === playerId);
        if (!me) continue;

        const result = me.player_stats?.Result;
        if (result === "1") win++;
        else if (result === "0") lose++;

        const before = Number(me.player_stats?.Elo_Before || 0);
        const after = Number(me.player_stats?.Elo_After || 0);
        eloDiff += after - before;

      } catch {
        continue; // если stats не отдал данные, пропускаем
      }
    }

    const eloDiffFormatted = eloDiff > 0 ? `+${eloDiff}` : `${eloDiff}`;

    const formatted = `Elo: ${currentElo} | Today → Win: ${win} Lose: ${lose} Elo: ${eloDiffFormatted}`;

    return res.status(200).send(formatted);

  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error');
  }
}
